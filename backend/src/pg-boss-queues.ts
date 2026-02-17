import { RequestContext } from '@mikro-orm/postgresql';
import type { Job, Queue } from 'pg-boss';

import { EmailMessageService } from '@/services/email-message.service';
import { GmailAccountService } from '@/services/gmail-account.service';
import { orm } from '@/utils/orm';
import { pgBossInstance } from '@/utils/pg-boss';

export const QUEUES = {
  CREATE_INITIAL_EMAIL_MESSAGES: 'create-initial-email-messages',
  CREATE_NEW_EMAIL_MESSAGES: 'create-new-email-messages',
  SCHEDULER_CREATE_NEW_EMAIL_MESSAGES: 'scheduler-create-new-email-messages',
} as const;

interface QueueDataMap {
  [QUEUES.CREATE_INITIAL_EMAIL_MESSAGES]: { gmailAccountId: string };
  [QUEUES.CREATE_NEW_EMAIL_MESSAGES]: { gmailAccountId: string };
  [QUEUES.SCHEDULER_CREATE_NEW_EMAIL_MESSAGES]: {};
}

const CONFIG_BY_QUEUE = {
  [QUEUES.CREATE_INITIAL_EMAIL_MESSAGES]: {
    options: { retryLimit: 5, retryDelay: 5, retryBackoff: true, policy: 'standard' },
    handler: async (job) => {
      const { gmailAccountId } = job.data;
      await EmailMessageService.createInitialEmailMessages(gmailAccountId);
    },
  },
  [QUEUES.CREATE_NEW_EMAIL_MESSAGES]: {
    options: { retryLimit: 5, retryDelay: 5, retryBackoff: true, policy: 'standard' },
    handler: async (job) => {
      const { gmailAccountId } = job.data;
      await EmailMessageService.createNewEmailMessages(gmailAccountId);
    },
  },
  [QUEUES.SCHEDULER_CREATE_NEW_EMAIL_MESSAGES]: {
    options: { policy: 'exclusive' },
    handler: async () => {
      const gmailAccounts = await GmailAccountService.findAllAccounts();
      for (const gmailAccount of gmailAccounts) {
        await enqueue(QUEUES.CREATE_NEW_EMAIL_MESSAGES, { gmailAccountId: gmailAccount.id });
      }
    },
  },
} as {
  [Q in keyof QueueDataMap]: { options: Omit<Queue, 'name'>; handler: (job: Job<QueueDataMap[Q]>) => Promise<void> };
};

export const listenToQueues = async () => {
  const boss = await pgBossInstance();

  console.log('[PG-BOSS] Creating queues...');
  for (const queueName of Object.values(QUEUES)) {
    await boss.createQueue(queueName, CONFIG_BY_QUEUE[queueName].options);
  }

  console.log('[PG-BOSS] Setting up shedules...');
  await boss.schedule(QUEUES.SCHEDULER_CREATE_NEW_EMAIL_MESSAGES, '* * * * *');

  console.log('[PG-BOSS] Starting workers...');
  for (const queueName of Object.values(QUEUES)) {
    await startWorker(
      queueName,
      CONFIG_BY_QUEUE[queueName].handler as (job: Job<QueueDataMap[typeof queueName]>) => Promise<void>,
    );
  }
};

export const enqueue = async <Q extends keyof QueueDataMap>(queueName: Q, data: QueueDataMap[Q]) => {
  const boss = await pgBossInstance();
  const jobId = await boss.send(queueName, data);
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
        } catch (error) {
          console.error(`[PG-BOSS] Error processing job ${job.id} [queue=${queueName}]:`, error);
          throw error;
        }
      }
    });
  });
}
