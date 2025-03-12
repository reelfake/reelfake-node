import { Model, QueryTypes } from 'sequelize';
import sequelize from '../sequelize.config';
export * from './fieldMap';

export async function execQuery(queryText: string, fieldMap: Record<string, string>) {
  const result = await sequelize.query(queryText, {
    type: QueryTypes.SELECT,
    raw: true,
    plain: false,
    fieldMap,
  });

  return result as Array<{ [key: string]: string }>;
}

export async function getRowsCount(tableName: string, where?: string) {
  const whereClause = where ? ' WHERE ' + where : '';
  const result = await sequelize.query<{ count: number }>(
    `SELECT count(*) FROM ${tableName}${whereClause}`,
    {
      type: QueryTypes.SELECT,
      raw: false,
      plain: false,
    }
  );
  return result[0].count;
}
