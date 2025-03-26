import { Model, QueryTypes } from 'sequelize';
import sequelize from '../sequelize.config';
export * from './fieldMap';

export const ITEMS_COUNT_PER_PAGE_FOR_TEST = 50;

export async function cleanUserTable() {
  await sequelize.query('DELETE FROM public.user');
}

export async function execQuery(
  queryText: string,
  fieldMap: Record<string, string> = {},
  excludeTimestamps: boolean = true
) {
  let result: object[] | undefined = undefined;
  try {
    result = await sequelize.query(queryText, {
      type: QueryTypes.SELECT,
      raw: true,
      plain: false,
      fieldMap,
    });
  } catch (err) {
    console.log(err);
  }

  if (!result) {
    return [] as Array<{ [key: string]: string }>;
  }

  if (excludeTimestamps === false) {
    return result as Array<{ [key: string]: string }>;
  }

  for (const row of result) {
    if ('rowNumber' in row) {
      delete row['rowNumber'];
    }

    if ('tmdbId' in row) {
      delete row['tmdbId'];
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

export async function queryMovieObject(id: number, fieldMap: Record<string, string>) {
  const result = await sequelize.query(`SELECT * FROM v_movie WHERE id = ${id}`, {
    type: QueryTypes.SELECT,
    raw: true,
    plain: false,
    fieldMap,
  });
  if (result.length > 0) {
    return result[0];
  }
  return result;
}

export async function getRowsCount(tableName: string, where?: string): Promise<number> {
  try {
    const whereClause = where ? ' WHERE ' + where : '';
    const result = await sequelize.query<{ count: number }>(
      `SELECT count(*) FROM ${tableName}${whereClause}`,
      {
        type: QueryTypes.SELECT,
        raw: false,
        plain: false,
      }
    );
    return Number(result[0].count);
  } catch (err) {
    console.log('getRowsCount -> ', err);
    return -1;
  }
}
