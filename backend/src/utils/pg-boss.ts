import { PgBoss } from 'pg-boss';
import { ENV } from '@/utils/env';

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
