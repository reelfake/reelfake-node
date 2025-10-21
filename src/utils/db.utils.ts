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

export function getDbConnectionProps() {
  const db = process.env['DB_NAME'];
  const usersDb = process.env['REELFAKE_USERS_DB_NAME'];
  const user = process.env['DB_USER'];
  const password = process.env['DB_PASSWORD'];
  const host = process.env['DB_HOST'];
  const port = process.env['DB_PORT'];

  return { db, usersDb, user, password, host, port };
}
