import sequelize from './sequelize.config';
import { closeDbConnection } from './utils';

export default async function () {
  await closeDbConnection(sequelize);
}
