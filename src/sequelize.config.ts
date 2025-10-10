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
import { getDbConnectionProps } from './utils';

const dbConnectionProps = getDbConnectionProps(false);
const { db, user, password, host, port } = dbConnectionProps;

if (!db || !user || !password || !host || !port) {
  throw new Error('Missing environment variables required for connecting to the database');
}

const dbConnectionPropsForUsersDb = getDbConnectionProps(true);
const {
  db: reelfake_users_db,
  host: reelfake_users_db_host,
  user: reelfake_users_db_user,
  password: reelfake_users_db_password,
  port: reelfake_users_db_port,
} = dbConnectionPropsForUsersDb;

if (
  !reelfake_users_db ||
  !reelfake_users_db_user ||
  !reelfake_users_db_password ||
  !reelfake_users_db_host ||
  !reelfake_users_db_port
) {
  throw new Error('Missing environment variables required for connecting to the reelfake users database');
}

const enableLogs = process.env.ENABLE_SEQUELIZE_LOGS === 'true';

const sequelize = new Sequelize(db, user, password, {
  host,
  port: parseInt(port, 10),
  dialect: 'postgres',
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

export const sequelize_users =
  process.env.NODE_ENV === 'test'
    ? sequelize
    : new Sequelize(reelfake_users_db, reelfake_users_db_user, reelfake_users_db_password, {
        host: reelfake_users_db_host,
        port: parseInt(reelfake_users_db_port, 10),
        dialect: 'postgres',
        pool: {
          min: 2,
          max: 10,
          acquire: 10000,
          idle: 20000,
        },
      });

export default sequelize;
