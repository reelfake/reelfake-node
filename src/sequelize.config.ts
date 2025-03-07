import dotenv from 'dotenv';
const envName = process.env.NODE_ENV || 'dev';
dotenv.config({ path: `.env.${envName}` });

import { Sequelize } from 'sequelize';
const db = process.env.NODE_ENV === 'test' ? 'test_db' : process.env.DB_NAME;
const user = process.env.NODE_ENV === 'test' ? 'test_user' : process.env.DB_USER;
const password = process.env.NODE_ENV === 'test' ? 'test_password' : process.env.DB_PASSWORD;
const host = process.env.NODE_ENV === 'test' ? 'test_host' : process.env.DB_HOST;
const port = process.env.NODE_ENV === 'test' ? '1234' : process.env.DB_PORT;

if (!db || !user || !password || !host || !port) {
  throw new Error('Missing environment variables required for connecting to the database');
}

const sequelize = new Sequelize(db, user, password, {
  host,
  port: parseInt(port, 10),
  dialect: process.env.NODE_ENV === 'test' ? 'sqlite' : 'postgres',
  pool: {
    min: 2,
    max: 10,
    acquire: 30000,
    idle: 10000,
  },
  logging: false,
  storage: process.env.NODE_ENV === 'test' ? `${process.cwd()}/src/tests/test_db` : undefined,
});

export async function testDbConnection() {
  try {
    await sequelize.authenticate();
    console.log('Connection to the database has been established successfully.');
  } catch (error: unknown) {
    console.log('Error connecting to the database:', error);
  }
}

export async function closeDbConnection() {
  try {
    await sequelize.close();
    console.log('Connection to the database has been closed successfully.');
  } catch (error: unknown) {
    console.log('Error closing the database connection:', error);
  }
}

export default sequelize;
