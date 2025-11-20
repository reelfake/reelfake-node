import { QueryTypes } from 'sequelize';
import * as csv from 'fast-csv';
import fs from 'fs';
import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';
import sequelize from '../sequelize.config';
import { availableCountries, availableGenres } from '../constants';
import { MovieActorPayload } from '../types';

export const ITEMS_COUNT_PER_PAGE_FOR_TEST = 50;

const passwordMock = 'test1234';

function parseGenres(genres: string[]) {
  const genresCopy = [...genres];
  const genreIds = [];

  let genreName = genresCopy.shift();

  while (genreName) {
    const genreId = availableGenres[genreName.toUpperCase()];
    genreIds.push(genreId);
    genreName = genresCopy.shift();
  }

  return genreIds;
}

function parseCountries(countries: string[]) {
  const countriesCopy = [...countries];
  const countryIds = [];

  let countryName = countriesCopy.shift();

  while (countryName) {
    const genreId = availableCountries[countryName.toUpperCase()];
    countryIds.push(genreId);
    countryName = countriesCopy.shift();
  }

  return countryIds;
}

export function getRandomFirstName() {
  return faker.person.firstName();
}

export function getRandomLastName() {
  return faker.person.lastName();
}

export function getRandomNumberBetween(start: number, end: number) {
  return Math.floor(Math.random() * (end - start) + start);
}

export function getRandomNumber(digits: number) {
  return Number(faker.string.numeric({ length: digits }));
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

export function getRandomEmail(firstName?: string, lastName?: string) {
  return faker.internet.email({ provider: 'example.com', firstName, lastName });
}

export function getRandomPhoneNumber() {
  return faker.phone.number();
}

export function getRandomAddressLine() {
  return faker.location.streetAddress();
}

export function getRandomPostalCode() {
  return faker.location.zipCode();
}

export function getRandomDate(yearFrom: number, yearTo: number) {
  return faker.date.between({ from: `${yearFrom}-01-01T00:00:00.000Z`, to: `${yearTo}-01-01T00:00:00.000Z` });
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
      logging: false,
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
      castOrder: faker.number.int({ min: 100, max: 200 }),
    }));

  return randomActors;
};

export async function getStoreManagerCredential() {
  const [storeManager] = await execQuery(`
    SELECT staff.id, email
    FROM staff LEFT OUTER JOIN store ON staff.store_id = store.id
    WHERE store.store_manager_id = staff.id
    LIMIT 1
  `);

  const email = storeManager.email;

  const hashedPassword = await hashPassword(passwordMock);

  await execQuery(`
      UPDATE staff SET user_password = '${hashedPassword}' WHERE id = ${storeManager.id}
    `);

  return { email, password: passwordMock };
}

export async function getMultipleStaffCredentials(count: number) {
  const staffList = await execQuery(`
    SELECT staff.id, email
    FROM staff LEFT OUTER JOIN store ON staff.store_id = store.id
    WHERE store.store_manager_id <> staff.id AND staff.active = true
    LIMIT ${count}
  `);

  const credentials = [];

  for (const staff of staffList) {
    const email = staff.email;

    const hashedPassword = await hashPassword(passwordMock);

    await execQuery(`
      UPDATE staff SET user_password = '${hashedPassword}' WHERE id = ${staff.id}
    `);

    credentials.push({ email, password: passwordMock });
  }

  return credentials;
}

export async function getStaffCredential() {
  const [staff] = await execQuery(`
    SELECT staff.id, email
    FROM staff LEFT OUTER JOIN store ON staff.store_id = store.id
    WHERE store.store_manager_id <> staff.id AND staff.active = true
    LIMIT 1
  `);

  const email = staff.email;

  const hashedPassword = await hashPassword(passwordMock);

  await execQuery(`
      UPDATE staff SET user_password = '${hashedPassword}' WHERE id = ${staff.id}
    `);

  return { email, password: passwordMock };
}

export async function getCustomerCredential() {
  const [customer] = await execQuery(`
    SELECT id, email
    FROM customer WHERE active = true LIMIT 1
  `);

  const email = customer.email;

  const hashedPassword = await hashPassword(passwordMock);

  await execQuery(`
      UPDATE customer SET user_password = '${hashedPassword}' WHERE id = ${customer.id}
    `);

  return { email, password: passwordMock };
}

export async function hashPassword(password: string) {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  return hashedPassword;
}

export async function deleteRecords(ids: number[], tableName: string) {
  const queryText = `DELETE FROM ${tableName} WHERE id IN (${ids.join(',')})`;
  await sequelize.query(queryText, {
    type: QueryTypes.BULKDELETE,
    raw: true,
    plain: false,
  });
}

export async function deleteMoviesByTmdbId(tmdbIds: number[]) {
  const queryText = `DELETE FROM movie WHERE tmdb_id IN (${tmdbIds.join(',')})`;
  await sequelize.query(queryText, {
    type: QueryTypes.BULKDELETE,
    raw: true,
    plain: false,
  });
}

export async function readCsv(filePath: string) {
  const rows = await fs
    .createReadStream(filePath, { encoding: 'utf-8' })
    .pipe(csv.parse({ headers: true }))
    .toArray();

  const parsedRows = rows.map((r) => ({
    tmdbId: Number(r.tmdb_id),
    imdbId: r.imdb_id ? String(r.imdb_id) : null,
    title: String(r.title),
    originalTitle: String(r.original_title),
    overview: String(r.overview),
    runtime: Number(r.runtime),
    releaseDate: r.release_date,
    genres: (JSON.parse(r.genres.replaceAll("'", '"')) as string[]).sort(),
    countriesOfOrigin: JSON.parse(r.countries_of_origin.replaceAll("'", '"')) as string[],
    language: r.language,
    movieStatus: r.movie_status,
    popularity: parseFloat(r.popularity.toString()),
    budget: r.budget,
    revenue: r.revenue,
    ratingAverage: parseFloat(r.rating_average.toString()),
    ratingCount: Number(r.rating_count),
    posterUrl: String(r.poster_url),
    rentalRate: Number(r.rental_rate).toFixed(2),
  }));
  return parsedRows;
}

export async function getCsvRowsCount(filePath: string) {
  const rowsCount = (
    await fs
      .createReadStream(filePath, { encoding: 'utf-8' })
      .pipe(csv.parse({ headers: true }))
      .toArray()
  ).length;
}
