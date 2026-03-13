import type { Connection, Table } from '@lancedb/lancedb';
import { Field, FixedSizeBinary, FixedSizeList, Float32, Schema, Timestamp, TimeUnit, Utf8 } from 'apache-arrow';
import OpenAI from 'openai';
import type { Board } from '@/entities/board';
import { Comment } from '@/entities/comment';
import { EmailMessage } from '@/entities/email-message';
import { BoardCardService } from '@/services/board-card.service';
import { CommentService } from '@/services/comment.service';
import { EmailMessageService } from '@/services/email-message.service';
import { ENV } from '@/utils/env';
import { reportError } from '@/utils/error-tracking';
import { bufferToUuid, connect, ensureIndexesExist, IndexType, uuidToBuffer, uuidToQuotedHex } from '@/utils/lancedb';
import { mapBy } from '@/utils/lists';
import { Logger } from '@/utils/logger';

const S3_PREFIX_INDEXES = 'indexes';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSION = 1536;
const EMBEDDING_MAX_TOKENS = 8191; // Maximum input tokens for text-embedding-3-small
const EMBEDDING_CHARS_PER_TOKEN = 4; // Average characters per token for English text

const SEARCH_REFINE_FACTOR = 5; // Rerank the top 5 results using exact cosine similarity after the initial approximate search
const SEARCH_MAX_DISTANCE = 0.6; // Maximum cosine distance for search results (0.0 = identical, 1.0 = orthogonal, >1.0 = opposite)

interface IndexRecord extends Record<string, unknown> {
  id: Buffer;
  entity: 'EmailMessage' | 'Comment';
  board_card_id: Buffer;
  board_card_last_event_at: Date;
  board_card_subject: string;
  text: string;
  vector: number[];
  updated_at: Date;
}

const ARROW_SCHEMA = new Schema([
  new Field('id', new FixedSizeBinary(16)),
  new Field('entity', new Utf8()),
  new Field('board_card_id', new FixedSizeBinary(16)),
  new Field('board_card_last_event_at', new Timestamp(TimeUnit.MILLISECOND)),
  new Field('board_card_subject', new Utf8()),
  new Field('text', new Utf8()),
  new Field('vector', new FixedSizeList(EMBEDDING_DIMENSION, new Field('item', new Float32()))),
  new Field('updated_at', new Timestamp(TimeUnit.MILLISECOND)),
]);

const INDEXES = {
  id: IndexType.BTREE,
  board_card_id: IndexType.BTREE,
  text: IndexType.FTS,
  vector: IndexType.HNSW,
};

export class IndexService {
  private static openai = new OpenAI({ apiKey: ENV.OPENAI_EMBEDDINGS_API_KEY });
  private static connection: Connection | null = null;
  private static hasAllIndexesCache = false;

  static async upsertRecords(
    boardId: string,
    { entity, ids, boardCardId }: { entity: 'EmailMessage' | 'Comment'; ids: string[]; boardCardId: string },
  ) {
    if (ids.length === 0) return;

    const tableName = `${boardId}_records`;
    const table = await IndexService.getOrCreateTable(tableName);
    const existingRecordById = mapBy(
      (
        await table
          .query()
          .where(`id IN (${ids.map((id) => uuidToQuotedHex(id)).join(', ')}) AND entity = '${entity}'`)
          .select(['id', 'updated_at'])
          .toArray()
      ).map((record) => ({
        id: bufferToUuid(record.id),
        updatedAt: new Date(record.updated_at),
      })),
      (record) => record.id,
    );

    const boardCard = await BoardCardService.findById({ id: boardId } as Board, { boardCardId });

    const records: IndexRecord[] = [];

    if (entity === 'EmailMessage') {
      const emailMessages = await EmailMessageService.findByIds(ids, { populate: ['gmailAttachments'] });
      for (const emailMessage of emailMessages) {
        const existingUpdatedAt = existingRecordById[emailMessage.id]?.updatedAt;
        if (existingUpdatedAt && emailMessage.updatedAt.getTime() === existingUpdatedAt.getTime()) continue;

        const text = EmailMessage.toIndex(emailMessage);
        const vector = await IndexService.generateEmbedding(text);
        records.push({
          id: uuidToBuffer(emailMessage.id),
          entity: 'EmailMessage',
          board_card_id: uuidToBuffer(boardCardId),
          board_card_last_event_at: boardCard.lastEventAt,
          board_card_subject: boardCard.subject,
          text,
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
        const vector = await IndexService.generateEmbedding(text);
        records.push({
          id: uuidToBuffer(comment.id),
          entity: 'Comment',
          board_card_id: uuidToBuffer(boardCardId),
          board_card_last_event_at: boardCard.lastEventAt,
          board_card_subject: boardCard.subject,
          text,
          vector,
          updated_at: comment.updatedAt,
        });
      }
    }

    if (records.length > 0) {
      await table.mergeInsert('id').whenMatchedUpdateAll().whenNotMatchedInsertAll().execute(records);
      await IndexService.ensureIndexesExist(table);
      Logger.info(`[INDEX] Upserted ${records.length} records for entity ${entity}`);
    }
  }

  static async deleteRecords(boardId: string, { entity, ids }: { entity: 'EmailMessage' | 'Comment'; ids: string[] }) {
    if (ids.length === 0) return;

    const tableName = `${boardId}_records`;
    const table = await IndexService.getOrCreateTable(tableName);

    await table.delete(`id IN (${ids.map((id) => uuidToQuotedHex(id)).join(', ')}) AND entity = '${entity}'`);
    Logger.info(`[INDEX] Deleted ${ids.length} records for entity ${entity}`);
  }

  static async deleteRecordsByBoardCards(boardId: string, { boardCardIds }: { boardCardIds: string[] }) {
    if (boardCardIds.length === 0) return;

    const tableName = `${boardId}_records`;
    const table = await IndexService.getOrCreateTable(tableName);

    await table.delete(`board_card_id IN (${boardCardIds.map((id) => uuidToQuotedHex(id)).join(', ')})`);
    Logger.info(`[INDEX] Deleted records for ${boardCardIds.length} board cards`);
  }

  static async deleteTable(boardId: string) {
    const tableName = `${boardId}_records`;
    const connection = await IndexService.getConnection();
    const tableNames = await connection.tableNames();

    if (tableNames.includes(tableName)) {
      await connection.dropTable(tableName);
      Logger.info(`[INDEX] Deleted table: ${tableName}`);
    }
  }

  static async compactTables() {
    const connection = await IndexService.getConnection();
    const tableNames = await connection.tableNames();

    if (tableNames.length === 0) {
      Logger.info('[INDEX] No tables to compact');
      return;
    }

    for (const tableName of tableNames) {
      try {
        const table = await connection.openTable(tableName);
        await table.optimize();
        Logger.info(`[INDEX] Compacted table: ${tableName}`);
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
      limit = SEARCH_REFINE_FACTOR * 2,
    }: { query: string; excludeBoardCardId?: string; limit?: number },
  ) {
    const tableName = `${boardId}_records`;
    const table = await IndexService.getOrCreateTable(tableName);
    const queryVector = await IndexService.generateEmbedding(query);
    const queryLimit = Math.max(limit, SEARCH_REFINE_FACTOR * 2);

    let search = table
      .vectorSearch(queryVector)
      .distanceType('cosine')
      .distanceRange(0.0, SEARCH_MAX_DISTANCE)
      .select(['id', 'entity', 'board_card_id', 'updated_at', '_distance'])
      .limit(queryLimit)
      .refineFactor(Math.ceil(queryLimit / 2));

    if (excludeBoardCardId) {
      search = search.where(`board_card_id != ${uuidToQuotedHex(excludeBoardCardId)}`);
    }

    const records = await search.toArray();

    const seenBoardCardIds = new Set<string>();
    return records
      .map((record) => ({
        id: bufferToUuid(record.id),
        entity: record.entity as string,
        boardCardId: bufferToUuid(record.board_card_id),
        updatedAt: new Date(record.updated_at),
        distance: record._distance as number,
      }))
      .sort((a, b) => a.distance - b.distance)
      .filter((record) => {
        if (seenBoardCardIds.has(record.boardCardId)) return false;
        seenBoardCardIds.add(record.boardCardId);
        return true;
      })
      .slice(0, limit);
  }

  static async searchFullText(boardId: string, { query, limit = 10 }: { query: string; limit?: number }) {
    const tableName = `${boardId}_records`;
    const table = await IndexService.getOrCreateTable(tableName);
    const queryLimit = limit * 2;

    const records = await table
      .search(query)
      .select([
        'id',
        'entity',
        'board_card_id',
        'board_card_last_event_at',
        'board_card_subject',
        'text',
        'updated_at',
        '_score',
      ])
      .limit(queryLimit)
      .toArray();

    const seenBoardCardIds = new Set<string>();
    return records
      .map((record) => ({
        id: bufferToUuid(record.id),
        entity: record.entity as string,
        boardCardId: bufferToUuid(record.board_card_id),
        boardCardLastEventAt: new Date(record.board_card_last_event_at),
        boardCardSubject: record.board_card_subject as string,
        text: record.text as string,
        updatedAt: new Date(record.updated_at),
        score: record._score as number,
      }))
      .filter((record) => {
        if (seenBoardCardIds.has(record.boardCardId)) return false;
        seenBoardCardIds.add(record.boardCardId);
        return true;
      })
      .slice(0, limit);
  }

  static async generateEmbedding(text: string): Promise<number[]> {
    const estimatedTokens = Math.ceil(text.length / EMBEDDING_CHARS_PER_TOKEN);

    let inputText = text;
    if (estimatedTokens > EMBEDDING_MAX_TOKENS) {
      const maxChars = EMBEDDING_MAX_TOKENS * EMBEDDING_CHARS_PER_TOKEN;
      inputText = text.substring(0, maxChars);
      reportError(
        `[INDEX] Text truncated for embedding: ${estimatedTokens} estimated tokens vs ${EMBEDDING_MAX_TOKENS} max tokens`,
      );
    }

    const response = await IndexService.openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: inputText,
      encoding_format: 'float',
    });

    return response.data[0]!.embedding;
  }

  static s3Prefix() {
    return S3_PREFIX_INDEXES;
  }

  // -------------------------------------------------------------------------------------------------------------------

  private static async getConnection() {
    if (!IndexService.connection) {
      IndexService.connection = await connect(IndexService.s3Prefix());
    }
    return IndexService.connection;
  }

  private static async getOrCreateTable(tableName: string): Promise<Table> {
    const connection = await IndexService.getConnection();
    const tableNames = await connection.tableNames();

    if (tableNames.includes(tableName)) {
      return await connection.openTable(tableName);
    }

    return await connection.createEmptyTable(tableName, ARROW_SCHEMA, { mode: 'create' });
  }

  private static async ensureIndexesExist(table: Table) {
    if (IndexService.hasAllIndexesCache) return;
    IndexService.hasAllIndexesCache = await ensureIndexesExist({ table, indexes: INDEXES });
  }
}
