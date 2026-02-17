import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Migrator } from '@mikro-orm/migrations';
import { defineConfig } from '@mikro-orm/postgresql';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';

import { ENV } from '@/utils/env';

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  dbName: ENV.DB_DATABASE,
  user: ENV.DB_USERNAME,
  password: ENV.DB_PASSWORD,
  host: ENV.DB_HOSTNAME,
  port: ENV.DB_PORT,
  driverOptions: {
    connection: {
      ssl: ENV.DB_SSL ? { rejectUnauthorized: false } : false,
    },
  },
  debug: true,
  metadataProvider: TsMorphMetadataProvider,
  entities: [join(CURRENT_DIR, './entities/**/*.js')],
  entitiesTs: [join(CURRENT_DIR, './entities/**/*.ts')],
  migrations: {
    path: join(CURRENT_DIR, './migrations'),
    pathTs: join(CURRENT_DIR, './migrations'),
  },
  extensions: [Migrator],
});
