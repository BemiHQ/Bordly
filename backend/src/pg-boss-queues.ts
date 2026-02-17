import { RequestContext } from '@mikro-orm/postgresql';
import type { Job } from 'pg-boss';
import { EmailMessageService } from '@/services/email-message.service';
import { GmailAccountService } from '@/services/gmail-account.service';
import { orm } from '@/utils/orm';
import { pgBossInstance } from '@/utils/pg-boss';

export const QUEUES = {
  CREATE_INITIAL_EMAIL_MESSAGES: 'create-initial-email-messages',
} as const;

interface QueueDataMap {
  [QUEUES.CREATE_INITIAL_EMAIL_MESSAGES]: { gmailAccountId: string };
}

const JOB_HANDLER_BY_QUEUE = {
  [QUEUES.CREATE_INITIAL_EMAIL_MESSAGES]: async (job) => {
    const { gmailAccountId } = job.data;
    const gmailAccount = await GmailAccountService.findById(gmailAccountId);
    await EmailMessageService.createInitialEmailMessages({ gmailAccount });
  },
} as { [Q in keyof QueueDataMap]: (job: Job<QueueDataMap[Q]>) => Promise<void> };

export const listenToQueues = async () => {
  const boss = await pgBossInstance();

  for (const queueName of Object.values(QUEUES)) {
    await boss.createQueue(queueName, { retryLimit: 5, retryBackoff: true });
  }

  for (const queueName of Object.values(QUEUES)) {
    await process(queueName, JOB_HANDLER_BY_QUEUE[queueName]);
  }
};

export const enqueue = async <Q extends keyof QueueDataMap>(queueName: Q, data: QueueDataMap[Q]) => {
  const boss = await pgBossInstance();
  const jobId = await boss.send(queueName, data);
  console.log(`[PG-BOSS] Enqueued job ${jobId} [queue=${queueName}]`);
  return jobId;
};

async function process<Q extends keyof QueueDataMap>(
  queueName: Q,
  jobHandler: (job: Job<QueueDataMap[Q]>) => Promise<void>,
) {
  const boss = await pgBossInstance();
  await boss.work(queueName, async (jobs: Job<QueueDataMap[Q]>[]) => {
    await RequestContext.create(orm.em, async () => {
      for (const job of jobs) {
        await jobHandler(job);
      }
    });
  });
}
