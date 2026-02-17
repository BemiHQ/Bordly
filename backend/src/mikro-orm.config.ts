import { Migrator } from '@mikro-orm/migrations';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';

import { Env } from './utils/env';

export default {
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
  entities: ['../dist/entities/**/*.js'],
  entitiesTs: ['entities/**/*.ts'],
  migrations: {
    path: '../dist/migrations',
    pathTs: 'migrations',
  },
  extensions: [Migrator],
};
