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

const db = process.env['DB_NAME'];
const user = process.env['DB_USER'];
const password = process.env['DB_PASSWORD'];
const host = process.env['DB_HOST'];
const port = process.env['DB_PORT'];

if (!db || !user || !password || !host || !port) {
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

export default sequelize;
