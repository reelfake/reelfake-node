import { Model, QueryTypes } from 'sequelize';
import sequelize from '../sequelize.config';
export * from './fieldMap';

export const ITEMS_COUNT_PER_PAGE_FOR_TEST = 50;

export async function execQuery(
  queryText: string,
  fieldMap: Record<string, string>,
  excludeTimestamps: boolean = true
) {
  const result = await sequelize.query(queryText, {
    type: QueryTypes.SELECT,
    raw: true,
    plain: false,
    fieldMap,
  });

  if (excludeTimestamps === false) {
    return result;
  }

  for (const row of result) {
    if ('rowNumber' in row) {
      delete row['rowNumber'];
    }

    if ('created_at' in row) {
      delete row['created_at'];
    }

    if ('updated_at' in row) {
      delete row['updated_at'];
    }
  }

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
