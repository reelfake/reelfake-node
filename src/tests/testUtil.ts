import { QueryTypes } from 'sequelize';
import sequelize from '../sequelize.config';
export * from './fieldMap';
import { MovieActorPayload } from '../types';

export const ITEMS_COUNT_PER_PAGE_FOR_TEST = 50;

export function getRandomNumberBetween(start: number, end: number) {
  return Math.floor(Math.random() * (end - start) + start);
}

export function getRandomNumber(digits: number) {
  if (digits <= 0) {
    throw new Error('Digits must be greater than 0');
  }

  return Math.floor(Math.random() * Number('9'.padEnd(digits + 1, '0'))) + 10000;
}

export function getRandomChoice(choices: string[]) {
  return choices[getRandomNumberBetween(0, choices.length)];
}

export function getRandomCharacters(length: number = 5, firstCharUpperCase: boolean = true) {
  const letters = [
    'a',
    'b',
    'c',
    'd',
    'e',
    'f',
    'g',
    'h',
    'i',
    'j',
    'k',
    'l',
    'm',
    'n',
    'o',
    'p',
    'q',
    'r',
    's',
    't',
    'u',
    'v',
    'w',
    'x',
    'y',
    'z',
  ];

  let chars = '';
  while (chars.length < length) {
    const randomIndex = getRandomNumberBetween(0, letters.length);
    const randomChar = letters[randomIndex];
    chars += randomChar;
  }

  if (firstCharUpperCase) {
    chars = `${chars[0].toUpperCase()}${chars.substring(1)}`;
  }

  return chars;
}

export function getRandomEmail() {
  return `${getRandomCharacters()}${getRandomCharacters()}${Math.ceil(Math.random() * 1000)}@example.com`;
}

export function getRandomAddressLine() {
  return `${Math.ceil(Math.random() * 1000)} ${getRandomCharacters()} Street`;
}

export function getRandomPostalCode() {
  return `${getRandomNumberBetween(0, 2)}${getRandomCharacters(5)}${getRandomNumberBetween(0, 2)}`;
}

export function getRandomDate(yearFrom: number, yearTo: number) {
  const randomYear = getRandomNumberBetween(yearFrom, yearTo);
  const randomMonth: number = getRandomNumberBetween(1, 13);
  const randomDayOfMonth = getRandomNumberBetween(1, 31);

  return `${randomYear}-${randomMonth < 10 ? '0' + randomMonth : randomMonth}-${randomDayOfMonth < 10 ? '0' + randomDayOfMonth : randomDayOfMonth}`;
}

export async function cleanUserTable() {
  await sequelize.query('DELETE FROM public.user');
}

export async function execQuery(
  queryText: string,
  fieldMap: Record<string, string> = {},
  excludeTimestamps: boolean = true,
  removeTmdbId: boolean = true
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

    if (removeTmdbId && 'tmdbId' in row) {
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

export const getRandomActors = async (count: number = 3): Promise<MovieActorPayload[]> => {
  const [highestTmdbIdQueryResult] = await execQuery(`
    SELECT MAX(tmdb_id) AS "highestTmdbId" FROM actor
  `);
  const highestTmdbId = Number(highestTmdbIdQueryResult.highestTmdbId) + 1;

  const randomActors = Array(count)
    .fill(undefined)
    .map((_, i) => ({
      tmdbId: highestTmdbId + i,
      imdbId: `nm${getRandomCharacters()}`,
      actorName: `${getRandomCharacters(10, true)} ${getRandomCharacters(15, true)}`,
      biography: '',
      birthday: new Date(getRandomDate(1950, 2010)),
      deathday: undefined,
      placeOfBirth: getRandomCharacters(),
      popularity: Number((Math.random() * 10).toFixed(4)),
      profilePictureUrl: `https://image.tmdb.org/t/p/w500/${getRandomCharacters(27, false)}.jpg`,
      characterName: `${getRandomCharacters(10, true)} ${getRandomCharacters(15, true)}`,
      castOrder: getRandomNumberBetween(100, 200),
    }));

  return randomActors;
};
