import type { Sequelize } from 'sequelize';

export async function testDbConnection(sequelize: Sequelize) {
  try {
    await sequelize.authenticate();
    console.log('Connection to the database has been established successfully.');
  } catch (error: unknown) {
    console.log('Error connecting to the database:', error);
  }
}

export async function closeDbConnection(sequelize: Sequelize) {
  try {
    await sequelize.close();
    console.log('Connection to the database has been closed successfully.');
  } catch (error: unknown) {
    console.log('Error closing the database connection:', error);
  }
}

export function getDbConnectionProps(isUsersDatabase: boolean) {
  const prefix = isUsersDatabase && process.env.NODE_ENV !== 'test' ? 'REELFAKE_USERS_' : '';

  const db = process.env[`${prefix}DB_NAME`];
  const user = process.env[`${prefix}DB_USER`];
  const password = process.env[`${prefix}DB_PASSWORD`];
  const host = process.env[`${prefix}DB_HOST`];
  const port = process.env[`${prefix}DB_PORT`];

  return { db, user, password, host, port };
}
