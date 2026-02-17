import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Migrator } from '@mikro-orm/migrations';
import { defineConfig } from '@mikro-orm/postgresql';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';

import { Env } from './utils/env';

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  dbName: Env.DB_DATABASE,
  user: Env.DB_USERNAME,
  password: Env.DB_PASSWORD,
  host: Env.DB_HOSTNAME,
  port: Env.DB_PORT,
  driverOptions: {
    connection: {
      ssl: Env.DB_SSL ? { rejectUnauthorized: false } : false,
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
