import type { Connection, Table } from '@lancedb/lancedb';
import { connect, Index } from '@lancedb/lancedb';
import type { Loaded } from '@mikro-orm/postgresql';
import { Field, FixedSizeList, Float32, Schema, Utf8 } from 'apache-arrow';
import OpenAI from 'openai';
import type { Board } from '@/entities/board';
import { EmailMessage } from '@/entities/email-message';
import { ENV } from '@/utils/env';
import { Logger } from '@/utils/logger';

const S3_PREFIX_EMBEDDINGS = 'embeddings';
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSION = 1536;

const SEARCH_REFINE_FACTOR = 5; // Rerank the top 5 results using exact cosine similarity after the initial approximate search
const SEARCH_MAX_DISTANCE = 0.6; // Maximum cosine distance for search results (0.0 = identical, 1.0 = orthogonal, >1.0 = opposite)

const INDEX_REBUILD_THRESHOLD = 0.2; // Rebuild the index if the number of vectors increases by 20% or more since the last build
const INDEX_MIN_ROW_COUNT = 256; // Minimum number of vectors required to create an index
const INDEX_ROWS_PER_PARTITION = 1_048_576; // Default number of rows per partition for HNSW index
const INDEX_EF_CONSTRUCTION = 150; //Default HNSW index construction quality parameter (higher = better recall, slower build)

interface EmbeddingRecord extends Record<string, unknown> {
  id: string;
  entity: string;
  vector: number[];
}

const ARROW_SCHEMA = new Schema([
  new Field('id', new Utf8()),
  new Field('entity', new Utf8()),
  new Field('vector', new FixedSizeList(EMBEDDING_DIMENSION, new Field('item', new Float32()))),
]);

export class EmbeddingService {
  private static openai = new OpenAI({ apiKey: ENV.OPENAI_EMBEDDINGS_API_KEY });
  private static connection: Connection | null = null;
  private static indexMetadata = new Map<string, { rowCount: number }>();

  static async indexEmailMessages(board: Loaded<Board>, emailMessages: Loaded<EmailMessage>[]) {
    if (emailMessages.length === 0) return;

    const tableName = `${board.id}_records`;
    const table = await EmbeddingService.getTable(tableName);

    const records: EmbeddingRecord[] = [];
    for (const emailMessage of emailMessages) {
      const text = EmailMessage.toIndex(emailMessage);
      const vector = await EmbeddingService.generateEmbedding(text);
      records.push({ id: emailMessage.id, entity: 'EmailMessage', vector });
    }

    await table.add(records);
    await EmbeddingService.ensureIndexExists(tableName);
  }

  static async searchSemantic(board: Loaded<Board>, query: string, { limit = 10 }: { limit?: number } = {}) {
    const tableName = `${board.id}_records`;
    const table = await EmbeddingService.getTable(tableName);

    const queryVector = await EmbeddingService.generateEmbedding(query);

    const results = await table
      .vectorSearch(queryVector)
      .distanceType('cosine')
      .distanceRange(0.0, SEARCH_MAX_DISTANCE)
      .select(['id', 'entity', '_distance'])
      .limit(limit)
      .refineFactor(SEARCH_REFINE_FACTOR)
      .toArray();

    return results.map((result) => ({
      id: result.id as string,
      entity: result.entity as string,
      distance: result._distance as number,
    }));
  }

  private static async getConnection() {
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

      EmbeddingService.connection = await connect(`s3://${ENV.S3_BUCKET}/${S3_PREFIX_EMBEDDINGS}`, {
        storageOptions,
      });
    }
    return EmbeddingService.connection;
  }

  private static async getTable(tableName: string): Promise<Table> {
    const connection = await EmbeddingService.getConnection();
    const tableNames = await connection.tableNames();

    if (tableNames.includes(tableName)) {
      return await connection.openTable(tableName);
    }

    return await connection.createEmptyTable(tableName, ARROW_SCHEMA, { mode: 'create' });
  }

  private static async generateEmbedding(text: string): Promise<number[]> {
    const response = await EmbeddingService.openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      encoding_format: 'float',
    });

    return response.data[0]!.embedding;
  }

  private static async ensureIndexExists(tableName: string) {
    const table = await EmbeddingService.getTable(tableName);
    const rowCount = await table.countRows();

    if (rowCount < INDEX_MIN_ROW_COUNT) {
      Logger.info(`[EMBEDDING] Skipping index: insufficient vectors (${rowCount} < ${INDEX_MIN_ROW_COUNT})`);
      return;
    }

    const metadata = EmbeddingService.indexMetadata.get(tableName);
    const shouldRebuild = metadata && rowCount >= metadata.rowCount * (1 + INDEX_REBUILD_THRESHOLD);

    try {
      if (shouldRebuild) {
        Logger.info(
          `[EMBEDDING] Rebuilding index for ${tableName}: row count increased by ${INDEX_REBUILD_THRESHOLD * 100}+% (${metadata.rowCount} → ${rowCount})`,
        );
      }

      await table.createIndex('vector', {
        config: Index.hnswSq({
          numPartitions: Math.max(1, Math.floor(rowCount / INDEX_ROWS_PER_PARTITION)),
          efConstruction: INDEX_EF_CONSTRUCTION,
          distanceType: 'cosine',
        }),
        replace: shouldRebuild,
      });
      EmbeddingService.indexMetadata.set(tableName, { rowCount });
    } catch (error) {
      if (!shouldRebuild) {
        Logger.info(`[EMBEDDING] Index may already exist for ${tableName}:`, error);
        EmbeddingService.indexMetadata.set(tableName, { rowCount });
      } else {
        throw error;
      }
    }
  }
}
