import dotenv from 'dotenv';

let envName = '';

switch (process.env.NODE_ENV) {
  case 'production':
    envName = 'prod';
    break;
  case 'development':
    envName = 'dev';
    break;
  case 'test':
    envName = 'test';
    break;
  default:
    throw new Error('App environment not found');
}

dotenv.config({ path: `${process.cwd()}/.env.${envName}` });

import { Sequelize } from 'sequelize';
import pg from 'pg';
import { getDbConnectionProps } from './utils';

const dbConnectionProps = getDbConnectionProps();
const { db, usersDb, user, password, host, port } = dbConnectionProps;

if (!db || !usersDb || !user || !password || !host || !port) {
  throw new Error('Missing environment variables required for connecting to the database');
}

const enableLogs = process.env.ENABLE_SEQUELIZE_LOGS === 'true';

const sequelize = new Sequelize(db, user, password, {
  host,
  port: parseInt(port, 10),
  dialect: 'postgres',
  dialectModule: pg,
  pool: {
    min: 2,
    max: 10,
    acquire: 10000,
    idle: 20000,
  },
  sync: { alter: false, force: false },
  logging: enableLogs,
});

export const sequelize_users = new Sequelize(usersDb, user, password, {
  host,
  port: parseInt(port, 10),
  dialect: 'postgres',
  dialectModule: pg,
  pool: {
    min: 2,
    max: 10,
    acquire: 10000,
    idle: 20000,
  },
  sync: { alter: false, force: false },
  logging: enableLogs,
});

if (envName !== 'test') {
  sequelize
    .authenticate()
    .then(() => console.log(`[${envName}] Successfully connected to postgres db...`))
    .catch((err) => console.log('Db connection error', err));
}

export default sequelize;
