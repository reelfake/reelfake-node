import { Model, QueryTypes } from 'sequelize';
import sequelize from '../sequelize.config';
export * from './fieldMap';

export const ITEMS_COUNT_PER_PAGE_FOR_TEST = 50;

export function getRandomNumber(digits: number) {
  if (digits <= 0) {
    throw new Error('Digits must be greater than 0');
  }

  return Math.floor(Math.random() * Number('9'.padEnd(digits + 1, '0'))) + 10000;
}

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

export async function queryMovieObject(id: number) {
  const result = await sequelize.query(
    `SELECT id, imdb_id AS "imdbId", title, original_title AS "originalTitle", 
    overview, runtime, release_date AS "releaseDate",
    (SELECT ARRAY_AGG(g.genre_name) FROM genre AS g JOIN UNNEST(genre_ids) AS gid ON g.id = gid) AS genres,
    (SELECT ARRAY_AGG(c.iso_country_code) FROM country AS c JOIN UNNEST(origin_country_ids) AS cid ON c.id = cid) AS "countriesOfOrigin",
    (SELECT l.iso_language_code FROM movie_language AS l WHERE l.id = language_id) AS language,
    movie_status AS "movieStatus", popularity, budget, revenue, rating_average AS "ratingAverage", rating_count AS "ratingCount", 
    poster_url AS "posterUrl", rental_rate AS "rentalRate", rental_duration AS "rentalDuration"
    FROM movie WHERE id = ${id}`,
    {
      type: QueryTypes.SELECT,
      raw: true,
      plain: false,
    }
  );
  if (result.length > 0) {
    return result[0];
  }
  return result;
}

export async function getRowsCount(tableName: string, where?: string): Promise<number> {
  try {
    const whereClause = where ? ' WHERE ' + where : '';
    const result = await sequelize.query<{ count: number }>(`SELECT count(*) FROM ${tableName}${whereClause}`, {
      type: QueryTypes.SELECT,
      raw: false,
      plain: false,
    });
    return Number(result[0].count);
  } catch (err) {
    console.log('getRowsCount -> ', err);
    return -1;
  }
}
