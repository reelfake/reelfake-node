import dotenv from 'dotenv';

const envName = process.env.NODE_ENV;

if (envName === 'development') {
  dotenv.config({ path: `${process.cwd()}/.env.dev` });
}

if (envName === 'test') {
  dotenv.config({ path: `${process.cwd()}/.env.test` });
}

import { Sequelize } from 'sequelize';
import pg from 'pg';
import { envVars } from './constants';

const db = envVars.db;
const user = envVars.user;
const password = envVars.password;
const host = envVars.host;
const port = envVars.port;

if (!db || !user || !password || !host || !port) {
  throw new Error('Missing environment variables required for connecting to the database');
}

const enableLogs = envVars.enableSequelizeLogs;

const sequelize = new Sequelize(db, user, password, {
  host,
  port,
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
