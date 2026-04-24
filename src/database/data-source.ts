import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';

const prefix = process.env.NODE_ENV === 'test' ? 'TEST_' : '';

// Prefer manual DATABASE_* when provided (this avoids Heroku's injected DATABASE_URL being used)
const preferManual =
  !!process.env[`${prefix}DATABASE_HOST`] &&
  !!process.env[`${prefix}DATABASE_NAME`] &&
  !!process.env[`${prefix}DATABASE_USERNAME`];

export const AppDataSource = new DataSource({
  type: process.env[`${prefix}DATABASE_TYPE`] as any,

  // IMPORTANT: only use DATABASE_URL if manual DATABASE_* is not set
  url: preferManual ? undefined : process.env[`${prefix}DATABASE_URL`],

  host: process.env[`${prefix}DATABASE_HOST`],
  port: process.env[`${prefix}DATABASE_PORT`]
    ? parseInt(process.env[`${prefix}DATABASE_PORT`]!, 10)
    : 5432,
  username: process.env[`${prefix}DATABASE_USERNAME`],
  password: process.env[`${prefix}DATABASE_PASSWORD`],
  database: process.env[`${prefix}DATABASE_NAME`],

  synchronize: process.env[`${prefix}DATABASE_SYNCHRONIZE`] === 'true',
  dropSchema: false,
  keepConnectionAlive: true,
  logging: process.env.NODE_ENV !== 'production',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
  cli: {
    entitiesDir: 'src',
    subscribersDir: 'subscriber',
  },
  extra: {
    max: process.env[`${prefix}DATABASE_MAX_CONNECTIONS`]
      ? parseInt(process.env[`${prefix}DATABASE_MAX_CONNECTIONS`]!, 10)
      : 100,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    query_timeout: 60000,
    statement_timeout: 60000,
    idle_in_transaction_session_timeout: 30000,

    // For Postgres, ssl should be under extra.ssl (pg driver reads it)
    ssl:
      process.env[`${prefix}DATABASE_SSL_ENABLED`] === 'true'
        ? {
            rejectUnauthorized:
              process.env[`${prefix}DATABASE_REJECT_UNAUTHORIZED`] === 'true',
            ca: process.env[`${prefix}DATABASE_CA`],
            key: process.env[`${prefix}DATABASE_KEY`],
            cert: process.env[`${prefix}DATABASE_CERT`],
          }
        : undefined,
  },
} as DataSourceOptions);
