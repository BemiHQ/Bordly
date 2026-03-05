import type { Connection, Table } from '@lancedb/lancedb';
import { connect, Index } from '@lancedb/lancedb';
import { Field, FixedSizeBinary, FixedSizeList, Float32, Schema, Timestamp, TimeUnit, Utf8 } from 'apache-arrow';
import OpenAI from 'openai';
import { Comment } from '@/entities/comment';
import { EmailMessage } from '@/entities/email-message';
import { CommentService } from '@/services/comment.service';
import { EmailMessageService } from '@/services/email-message.service';
import { ENV } from '@/utils/env';
import { reportError } from '@/utils/error-tracking';
import { mapBy } from '@/utils/lists';
import { Logger } from '@/utils/logger';

const S3_PREFIX_EMBEDDINGS = 'embeddings';
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSION = 1536;

const SEARCH_REFINE_FACTOR = 5; // Rerank the top 5 results using exact cosine similarity after the initial approximate search
const SEARCH_MAX_DISTANCE = 0.6; // Maximum cosine distance for search results (0.0 = identical, 1.0 = orthogonal, >1.0 = opposite)

const INDEX_MIN_ROW_COUNT = 256; // Minimum number of vectors required to create an index
const INDEX_ROWS_PER_PARTITION = 1_048_576; // Default number of rows per partition for HNSW index
const INDEX_EF_CONSTRUCTION = 150; //Default HNSW index construction quality parameter (higher = better recall, slower build)

interface EmbeddingRecord extends Record<string, unknown> {
  id: Buffer;
  entity: string;
  board_card_id: Buffer;
  vector: number[];
  updated_at: Date;
}

const ARROW_SCHEMA = new Schema([
  new Field('id', new FixedSizeBinary(16)),
  new Field('entity', new Utf8()),
  new Field('board_card_id', new FixedSizeBinary(16)),
  new Field('vector', new FixedSizeList(EMBEDDING_DIMENSION, new Field('item', new Float32()))),
  new Field('updated_at', new Timestamp(TimeUnit.MILLISECOND)),
]);

export class EmbeddingService {
  private static openai = new OpenAI({ apiKey: ENV.OPENAI_EMBEDDINGS_API_KEY });
  private static connection: Connection | null = null;

  static async upsertRecords(
    boardId: string,
    { entity, ids, boardCardId }: { entity: 'EmailMessage' | 'Comment'; ids: string[]; boardCardId: string },
  ) {
    if (ids.length === 0) return;

    const tableName = `${boardId}_records`;
    const table = await EmbeddingService.getOrCreateTable(tableName);
    const existingRecordById = mapBy(
      (
        await table
          .query()
          .where(`id IN (${ids.map((id) => EmbeddingService.uuidToQuotedHex(id)).join(', ')}) AND entity = '${entity}'`)
          .select(['id', 'updated_at'])
          .toArray()
      ).map((record) => ({
        id: EmbeddingService.bufferToUuid(record.id),
        updatedAt: new Date(record.updated_at),
      })),
      (record) => record.id,
    );

    const records: EmbeddingRecord[] = [];

    if (entity === 'EmailMessage') {
      const emailMessages = await EmailMessageService.findByIds(ids, { populate: ['gmailAttachments'] });
      for (const emailMessage of emailMessages) {
        const existingUpdatedAt = existingRecordById[emailMessage.id]?.updatedAt;
        if (existingUpdatedAt && emailMessage.updatedAt.getTime() === existingUpdatedAt.getTime()) continue;

        const text = EmailMessage.toIndex(emailMessage);
        const vector = await EmbeddingService.generateEmbedding(text);
        records.push({
          id: EmbeddingService.uuidToBuffer(emailMessage.id),
          entity: 'EmailMessage',
          board_card_id: EmbeddingService.uuidToBuffer(boardCardId),
          vector,
          updated_at: emailMessage.updatedAt,
        });
      }
    } else {
      const comments = await CommentService.findByIds(ids, { populate: ['user'] });

      for (const comment of comments) {
        const existingUpdatedAt = existingRecordById[comment.id]?.updatedAt;
        if (existingUpdatedAt && comment.updatedAt.getTime() === existingUpdatedAt.getTime()) continue;

        const text = Comment.toIndex(comment);
        const vector = await EmbeddingService.generateEmbedding(text);
        records.push({
          id: EmbeddingService.uuidToBuffer(comment.id),
          entity: 'Comment',
          board_card_id: EmbeddingService.uuidToBuffer(boardCardId),
          vector,
          updated_at: comment.updatedAt,
        });
      }
    }

    if (records.length > 0) {
      await table.mergeInsert('id').whenMatchedUpdateAll().whenNotMatchedInsertAll().execute(records);
      await EmbeddingService.ensureIndexesExist(tableName);
      Logger.info(`[EMBEDDING] Upserted ${records.length} records for entity ${entity}`);
    }
  }

  static async deleteRecords(boardId: string, { entity, ids }: { entity: 'EmailMessage' | 'Comment'; ids: string[] }) {
    if (ids.length === 0) return;

    const tableName = `${boardId}_records`;
    const table = await EmbeddingService.getOrCreateTable(tableName);

    await table.delete(
      `id IN (${ids.map((id) => EmbeddingService.uuidToQuotedHex(id)).join(', ')}) AND entity = '${entity}'`,
    );
    Logger.info(`[EMBEDDING] Deleted ${ids.length} records for entity ${entity}`);
  }

  static async deleteRecordsByBoardCards(boardId: string, { boardCardIds }: { boardCardIds: string[] }) {
    if (boardCardIds.length === 0) return;

    const tableName = `${boardId}_records`;
    const table = await EmbeddingService.getOrCreateTable(tableName);

    await table.delete(
      `board_card_id IN (${boardCardIds.map((id) => EmbeddingService.uuidToQuotedHex(id)).join(', ')})`,
    );
    Logger.info(`[EMBEDDING] Deleted records for ${boardCardIds.length} board cards`);
  }

  static async deleteTable(boardId: string) {
    const tableName = `${boardId}_records`;
    const connection = await EmbeddingService.getConnection();
    const tableNames = await connection.tableNames();

    if (tableNames.includes(tableName)) {
      await connection.dropTable(tableName);
      Logger.info(`[EMBEDDING] Deleted table: ${tableName}`);
    }
  }

  static async compactTables() {
    const connection = await EmbeddingService.getConnection();
    const tableNames = await connection.tableNames();

    if (tableNames.length === 0) {
      Logger.info('[EMBEDDING] No tables to compact');
      return;
    }

    for (const tableName of tableNames) {
      try {
        const table = await connection.openTable(tableName);
        await table.optimize();
        Logger.info(`[EMBEDDING] Compacted table: ${tableName}`);
      } catch (error) {
        reportError(error);
      }
    }
  }

  static async searchSemantic(
    boardId: string,
    {
      query,
      excludeBoardCardId,
      limit = SEARCH_REFINE_FACTOR,
    }: { query: string; excludeBoardCardId?: string; limit?: number },
  ) {
    const tableName = `${boardId}_records`;
    const table = await EmbeddingService.getOrCreateTable(tableName);
    const queryVector = await EmbeddingService.generateEmbedding(query);

    let search = table
      .vectorSearch(queryVector)
      .distanceType('cosine')
      .distanceRange(0.0, SEARCH_MAX_DISTANCE)
      .select(['id', 'entity', 'board_card_id', 'updated_at', '_distance'])
      .limit(limit)
      .refineFactor(SEARCH_REFINE_FACTOR);

    if (excludeBoardCardId) {
      search = search.where(`board_card_id != ${EmbeddingService.uuidToQuotedHex(excludeBoardCardId)}`);
    }

    const records = await search.toArray();

    return records
      .map((record) => ({
        id: EmbeddingService.bufferToUuid(record.id),
        entity: record.entity as string,
        boardCardId: EmbeddingService.bufferToUuid(record.board_card_id),
        updatedAt: new Date(record.updated_at),
        distance: record._distance as number,
      }))
      .sort((a, b) => a.distance - b.distance);
  }

  static async generateEmbedding(text: string): Promise<number[]> {
    const response = await EmbeddingService.openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      encoding_format: 'float',
    });

    return response.data[0]!.embedding;
  }

  static s3Prefix() {
    return S3_PREFIX_EMBEDDINGS;
  }

  static async getConnection() {
    if (!EmbeddingService.connection) {
      const storageOptions: Record<string, string> = {
        aws_access_key_id: ENV.S3_ACCESS_KEY_ID,
        aws_secret_access_key: ENV.S3_SECRET_ACCESS_KEY,
        region: ENV.S3_REGION,
      };
      if (ENV.S3_ENDPOINT) {
        storageOptions.endpoint = ENV.S3_ENDPOINT;
        storageOptions.allow_http = ENV.S3_ENDPOINT.startsWith('http://') ? 'true' : 'false';
      }

      EmbeddingService.connection = await connect(`s3://${ENV.S3_BUCKET}/${EmbeddingService.s3Prefix()}`, {
        storageOptions,
      });
    }
    return EmbeddingService.connection;
  }

  // -------------------------------------------------------------------------------------------------------------------

  private static async getOrCreateTable(tableName: string): Promise<Table> {
    const connection = await EmbeddingService.getConnection();
    const tableNames = await connection.tableNames();

    if (tableNames.includes(tableName)) {
      return await connection.openTable(tableName);
    }

    return await connection.createEmptyTable(tableName, ARROW_SCHEMA, { mode: 'create' });
  }

  private static async ensureIndexesExist(tableName: string) {
    const table = await EmbeddingService.getOrCreateTable(tableName);
    const rowCount = await table.countRows();

    if (rowCount < INDEX_MIN_ROW_COUNT) {
      Logger.info(`[EMBEDDING] Skipping indexes: insufficient vectors (${rowCount} < ${INDEX_MIN_ROW_COUNT})`);
      return;
    }

    await EmbeddingService.ensureScalarIndexesExist(table, tableName);
    await EmbeddingService.ensureVectorIndexExists(table, tableName, rowCount);
  }

  private static async ensureScalarIndexesExist(table: Table, tableName: string) {
    try {
      await table.createIndex('id', { config: Index.btree(), replace: false });
      Logger.info(`[EMBEDDING] Created BTree index on 'id' for ${tableName}`);
    } catch (error) {
      reportError(error);
      Logger.info(`[EMBEDDING] BTree index on 'id' may already exist for ${tableName}`);
    }

    try {
      await table.createIndex('board_card_id', { config: Index.btree(), replace: false });
      Logger.info(`[EMBEDDING] Created BTree index on 'board_card_id' for ${tableName}`);
    } catch (error) {
      reportError(error);
      Logger.info(`[EMBEDDING] BTree index on 'board_card_id' may already exist for ${tableName}`);
    }
  }

  private static async ensureVectorIndexExists(table: Table, tableName: string, rowCount: number) {
    try {
      await table.createIndex('vector', {
        config: Index.hnswSq({
          numPartitions: Math.max(1, Math.floor(rowCount / INDEX_ROWS_PER_PARTITION)),
          efConstruction: INDEX_EF_CONSTRUCTION,
          distanceType: 'cosine',
        }),
        replace: false,
      });
      Logger.info(`[EMBEDDING] Created vector index for ${tableName}`);
    } catch (error) {
      reportError(error);
      Logger.info(`[EMBEDDING] Vector index may already exist for ${tableName}`);
    }
  }

  private static uuidToBuffer(uuid: string): Buffer {
    return Buffer.from(uuid.replace(/-/g, ''), 'hex');
  }

  private static uuidToQuotedHex(uuid: string): string {
    return `X'${EmbeddingService.uuidToBuffer(uuid).toString('hex')}'`;
  }

  private static bufferToUuid(buffer: Buffer): string {
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    const hex = buf.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
}
