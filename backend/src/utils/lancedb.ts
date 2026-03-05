import { Index, connect as lancedbConnect, type Table } from '@lancedb/lancedb';
import { ENV } from '@/utils/env';
import { Logger } from '@/utils/logger';

const INDEX_VECTOR_MIN_ROW_COUNT = 256; // Minimum number of vectors required to create an index
const INDEX_ROWS_PER_PARTITION = 1_048_576; // Default number of rows per partition for HNSW index
const INDEX_EF_CONSTRUCTION = 150; // Default HNSW index construction quality parameter (higher = better recall, slower build)

export enum IndexType {
  BTREE = 'BTREE',
  FTS = 'FTS',
  HNSW = 'HNSW',
}

export const uuidToBuffer = (uuid: string) => {
  return Buffer.from(uuid.replace(/-/g, ''), 'hex');
};

export const uuidToQuotedHex = (uuid: string) => {
  return `X'${uuidToBuffer(uuid).toString('hex')}'`;
};

export const bufferToUuid = (buffer: Buffer) => {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const hex = buf.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const ensureIndexesExist = async ({
  table,
  indexes,
}: {
  table: Table;
  indexes: { [column: string]: IndexType };
}) => {
  const rowCount = await table.countRows();

  let hasAllIndexes = true;
  for (const [column, indexType] of Object.entries(indexes)) {
    if (indexType === IndexType.BTREE) {
      try {
        await table.createIndex(column, { config: Index.btree(), replace: false });
        Logger.info(`[INDEX] Created BTree index on '${column}' for ${table.name}`);
      } catch (error) {
        if (error instanceof Error && error.message.includes('already exists')) {
          Logger.info(`[INDEX] BTree index on '${column}' already exist for ${table.name}`);
        } else {
          throw error;
        }
      }
    } else if (indexType === IndexType.FTS) {
      try {
        await table.createIndex(column, { config: Index.fts(), replace: false });
        Logger.info(`[INDEX] Created FTS index on '${column}' for ${table.name}`);
      } catch (error) {
        if (error instanceof Error && error.message.includes('already exists')) {
          Logger.info(`[INDEX] BTree index on '${column}' already exist for ${table.name}`);
        } else {
          throw error;
        }
      }
    } else if (indexType === IndexType.HNSW) {
      if (rowCount < INDEX_VECTOR_MIN_ROW_COUNT) {
        hasAllIndexes = false;
        Logger.info(`[INDEX] Skipping indexes: insufficient vectors (${rowCount} < ${INDEX_VECTOR_MIN_ROW_COUNT})`);
        continue;
      }
      try {
        await table.createIndex('vector', {
          config: Index.hnswSq({
            numPartitions: Math.max(1, Math.floor(rowCount / INDEX_ROWS_PER_PARTITION)),
            efConstruction: INDEX_EF_CONSTRUCTION,
            distanceType: 'cosine',
          }),
          replace: false,
        });
        Logger.info(`[INDEX] Created vector index for ${table.name}`);
      } catch (error) {
        if (error instanceof Error && error.message.includes('already exists')) {
          Logger.info(`[INDEX] BTree index on '${column}' already exist for ${table.name}`);
        } else {
          throw error;
        }
      }
    }
  }

  return hasAllIndexes;
};

export const connect = async (s3Prefix: string) => {
  const storageOptions: Record<string, string> = {
    aws_access_key_id: ENV.S3_ACCESS_KEY_ID,
    aws_secret_access_key: ENV.S3_SECRET_ACCESS_KEY,
    region: ENV.S3_REGION,
  };
  if (ENV.S3_ENDPOINT) {
    storageOptions.endpoint = ENV.S3_ENDPOINT;
    storageOptions.allow_http = ENV.S3_ENDPOINT.startsWith('http://') ? 'true' : 'false';
  }
  return lancedbConnect(`s3://${ENV.S3_BUCKET}/${s3Prefix}`, { storageOptions });
};
