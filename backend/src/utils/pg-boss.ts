import { RequestContext } from '@mikro-orm/postgresql';
import { type Job, PgBoss } from 'pg-boss';
import { EmailMessageService } from '@/services/email-message.service';
import { GmailAccountService } from '@/services/gmail-account.service';
import { ENV } from '@/utils/env';
import { orm } from '@/utils/orm';

export const QUEUES = {
  CREATE_INITIAL_EMAIL_MESSAGES: 'create-initial-email-messages',
} as const;

export interface QueueDataMap {
  [QUEUES.CREATE_INITIAL_EMAIL_MESSAGES]: { gmailAccountId: string };
}

let bossInstance: PgBoss | null = null;

export const pgBossInstance = async () => {
  if (bossInstance) {
    return bossInstance;
  }

  const boss = new PgBoss({
    host: ENV.DB_HOSTNAME,
    port: ENV.DB_PORT,
    database: ENV.DB_DATABASE,
    user: ENV.DB_USERNAME,
    password: ENV.DB_PASSWORD,
    ssl: ENV.DB_SSL ? { rejectUnauthorized: false } : undefined,
  });

  await boss.start();
  bossInstance = boss;

  return boss;
};

export const closePgBoss = async () => {
  if (bossInstance) {
    await bossInstance.stop();
    bossInstance = null;
  }
};

export const listenToQueues = async () => {
  const boss = await pgBossInstance();

  await boss.createQueue(QUEUES.CREATE_INITIAL_EMAIL_MESSAGES, { retryLimit: 5, retryBackoff: true });

  await process(QUEUES.CREATE_INITIAL_EMAIL_MESSAGES, async (job) => {
    const { gmailAccountId } = job.data;
    const gmailAccount = await GmailAccountService.findById(gmailAccountId);
    await EmailMessageService.createInitialEmailMessages({ gmailAccount });
  });
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
