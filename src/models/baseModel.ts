import { Model, QueryTypes } from 'sequelize';
import { AppError } from '../utils';

class BaseModel extends Model {
  public static async getTotalRowsCount() {
    if (!this.sequelize) {
      throw new AppError(`Unable to get the instance of sequelize from  model ${this.name}`, 500);
    }

    const tableName = this.getTableName();
    const countResult = await this.sequelize.query<{ [key: string]: number }>(
      `SELECT count(id) FROM ${tableName};`,
      {
        type: QueryTypes.SELECT,
        plain: true,
        raw: true,
      }
    );

    if (!countResult?.count && !countResult?.['count(id)']) {
      throw new AppError(`Failed to query the total rows count from ${tableName} table`, 500);
    }

    if (process.env.NODE_ENV === 'test') {
      return countResult['count(id)'];
    }

    return countResult.count;
  }
}

export default BaseModel;
