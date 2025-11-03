import type { Sequelize } from 'sequelize';

export async function testDbConnection(sequelize: Sequelize) {
  try {
    await sequelize.authenticate();
    if (process.env['ENABLE_SEQUELIZE_LOGS'] === 'true') {
      console.log('Connection to the database has been established successfully.');
    }

    const dialect = sequelize.getDialect();
    const dbName = sequelize.getDatabaseName();
    const dbVersion = await sequelize.databaseVersion();
    const tables = sequelize.modelManager.all.map((m) => m.tableName);

    return { dialect, dbName, dbVersion, tables };
  } catch (error: unknown) {
    if (process.env['ENABLE_SEQUELIZE_LOGS'] === 'true') {
      console.log('Error connecting to the database:', error);
    }
    throw error as Error;
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
