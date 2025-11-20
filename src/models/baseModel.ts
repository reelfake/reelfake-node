import { Model, QueryTypes, WhereOptions } from 'sequelize';
import { AppError } from '../utils';

class BaseModel extends Model {
  public static async getTotalRowsCount(id: number | undefined = undefined) {
    if (!this.sequelize) {
      throw new AppError(`Unable to get the instance of sequelize from  model ${this.name}`, 500);
    }

    const tableName = this.getTableName();
    const queryText = id ? `SELECT count(id) FROM ${tableName} WHERE id = ${id};` : `SELECT count(id) FROM ${tableName};`;
    const countResult = await this.sequelize.query<{ [key: string]: number }>(queryText, {
      type: QueryTypes.SELECT,
      plain: true,
      raw: true,
    });

    if (!countResult?.count && !countResult?.['count(id)']) {
      throw new AppError(`Failed to query the total rows count from ${tableName} table`, 500);
    }

    return Number(countResult.count);
  }

  public static async isResourceExist(id: number) {
    if (!this.sequelize) {
      throw new AppError(`Unable to get the instance of sequelize from  model ${this.name}`, 500);
    }

    const tableName = this.getTableName();
    const queryText = `SELECT id FROM ${tableName} WHERE id = ${id};`;
    const queryResult = await this.sequelize.query<{ [key: string]: number }>(queryText, {
      type: QueryTypes.SELECT,
      plain: true,
      raw: true,
    });

    if (!queryResult || !queryResult.id || isNaN(queryResult.id)) {
      return false;
    }

    return true;
  }
}

export default BaseModel;
