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
