import { RequestContext } from '@mikro-orm/postgresql';
import type { Job, Queue } from 'pg-boss';
import { EmailMessageService } from '@/services/email-message.service';
import { EmbeddingService } from '@/services/embedding.service';
import { SenderEmailAddressService } from '@/services/sender-email-address.service';
import { reportError } from '@/utils/error-tracking';
import { orm } from '@/utils/orm';
import { pgBossInstance } from '@/utils/pg-boss';

const SCHEDULE_TZ = 'America/Los_Angeles';

export const QUEUES = {
  CREATE_INITIAL_EMAIL_MESSAGES: 'create-initial-email-messages',
  SYNC_EMAIL_ADDRESSES: 'sync-email-addresses',

  INDEX_ENTITY_RECORDS: 'index-entity-records',
  DELETE_INDEX_RECORDS: 'delete-index-records',
  COMPACT_INDEXES: 'compact-indexes',
} as const;

export enum IndexAction {
  UPSERT = 'upsert',
  DELETE = 'delete',
}

interface QueueDataMap {
  [QUEUES.CREATE_INITIAL_EMAIL_MESSAGES]: { boardId: string; boardAccountId: string };
  [QUEUES.SYNC_EMAIL_ADDRESSES]: {};
  [QUEUES.INDEX_ENTITY_RECORDS]: {
    boardId: string;
    entity: 'EmailMessage' | 'Comment';
    action: IndexAction;
    ids: string[];
    boardCardId?: string;
  };
  [QUEUES.DELETE_INDEX_RECORDS]: {
    boardId: string;
    boardCardIds?: string[];
    deleteTable?: boolean;
  };
  [QUEUES.COMPACT_INDEXES]: {};
}

const CONFIG_BY_QUEUE = {
  [QUEUES.CREATE_INITIAL_EMAIL_MESSAGES]: {
    options: { retryLimit: 5, retryDelay: 5, retryBackoff: true },
    schedule: null,
    handler: async (job) => {
      const { boardId, boardAccountId } = job.data;
      await EmailMessageService.createInitialBoardEmailMessages({ boardId, boardAccountId });
    },
  },
  [QUEUES.SYNC_EMAIL_ADDRESSES]: {
    options: { retryLimit: 3, retryDelay: 60, retryBackoff: true },
    schedule: '0 0 * * *',
    handler: async () => {
      await SenderEmailAddressService.syncEmailAddresses();
    },
  },
  [QUEUES.INDEX_ENTITY_RECORDS]: {
    options: { retryLimit: 3, retryDelay: 10, retryBackoff: true },
    sendOptions: { singletonKey: 'index-operation' },
    schedule: null,
    handler: async (job) => {
      const { boardId, boardCardId, entity, action, ids } = job.data;
      if (action === IndexAction.UPSERT) {
        if (!boardCardId) throw new Error('boardCardId is required for UPSERT action');
        await EmbeddingService.upsertRecords(boardId, { entity, ids, boardCardId });
      } else if (action === IndexAction.DELETE) {
        await EmbeddingService.deleteRecords(boardId, { entity, ids });
      }
    },
  },
  [QUEUES.DELETE_INDEX_RECORDS]: {
    options: { retryLimit: 3, retryDelay: 10, retryBackoff: true },
    sendOptions: { singletonKey: 'index-operation' },
    schedule: null,
    handler: async (job) => {
      const { boardId, boardCardIds, deleteTable } = job.data;
      if (deleteTable) {
        await EmbeddingService.deleteTable(boardId);
      } else {
        if (!boardCardIds?.length) throw new Error('boardCardIds is required for deleting index records');
        await EmbeddingService.deleteRecordsByBoardCards(boardId, { boardCardIds });
      }
    },
  },
  [QUEUES.COMPACT_INDEXES]: {
    options: { retryLimit: 2, retryDelay: 60, retryBackoff: true },
    schedule: '0 * * * *',
    handler: async () => {
      await EmbeddingService.compactTables();
    },
  },
} as {
  [Q in keyof QueueDataMap]: {
    options: Omit<Queue, 'name'>;
    sendOptions?: { singletonKey?: string };
    schedule: string | null;
    handler: (job: Job<QueueDataMap[Q]>) => Promise<void>;
  };
};

// ---------------------------------------------------------------------------------------------------------------------

export const listenToQueues = async () => {
  const boss = await pgBossInstance();

  // One-off queue migration
  const queueName = 'scheduled-create-new-email-messages';
  const queue = await boss.getQueue(queueName);
  if (queue) {
    console.log(`[PG-BOSS] Deleting queue "${queueName}"`);
    await boss.deleteQueue(queueName);
  }

  console.log('[PG-BOSS] Creating queues...');
  for (const queueName of Object.values(QUEUES)) {
    await boss.createQueue(queueName, CONFIG_BY_QUEUE[queueName].options);

    const schedule = CONFIG_BY_QUEUE[queueName].schedule;
    if (schedule) {
      console.log(`[PG-BOSS] Scheduling recurring job for "${queueName}" with "${schedule}"`);
      await boss.schedule(queueName, schedule, null, { tz: SCHEDULE_TZ });
    }
  }

  console.log(`[PG-BOSS] Starting workers...`);
  for (const queueName of Object.values(QUEUES)) {
    await startWorker(
      queueName,
      CONFIG_BY_QUEUE[queueName].handler as (job: Job<QueueDataMap[typeof queueName]>) => Promise<void>,
    );
  }
  console.log('[PG-BOSS] All workers started successfully');
};

export const enqueue = async <Q extends keyof QueueDataMap>(queueName: Q, data: QueueDataMap[Q]) => {
  const boss = await pgBossInstance();
  const { sendOptions } = CONFIG_BY_QUEUE[queueName];
  const jobId = await boss.send(queueName, data, sendOptions);
  console.log(`[PG-BOSS] Enqueued job ${jobId} [queue=${queueName}]`);
  return jobId;
};

async function startWorker<Q extends keyof QueueDataMap>(
  queueName: Q,
  jobHandler: (job: Job<QueueDataMap[Q]>) => Promise<void>,
) {
  const boss = await pgBossInstance();
  await boss.work(queueName, async (jobs: Job<QueueDataMap[Q]>[]) => {
    await RequestContext.create(orm.em, async () => {
      for (const job of jobs) {
        try {
          console.log(`[PG-BOSS] Processing job ${job.id} [queue=${queueName}]`);
          await jobHandler(job);
          console.log(`[PG-BOSS] Completed job ${job.id} [queue=${queueName}]`);
        } catch (error) {
          console.error(`[PG-BOSS] Error processing job ${job.id} [queue=${queueName}]:`, error);
          reportError(error);
          throw error;
        }
      }
    });
  });
  console.log(`[PG-BOSS] Worker started [queue=${queueName}]`);
}
