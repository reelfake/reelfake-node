import sequelize from './sequelize.config';
import { testDbConnection } from './utils';

export default async function () {
  try {
    await testDbConnection(sequelize);
  } catch (err) {
    const error = err as Error;
    if (error.name === 'SequelizeConnectionRefusedError') {
      console.error('\nError connecting to the database\n');
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}
