import { QueryTypes } from 'sequelize';
import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';
import sequelize from '../sequelize.config';
import { MovieActorPayload } from '../types';

export const ITEMS_COUNT_PER_PAGE_FOR_TEST = 50;

const passwordMock = 'test1234';

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

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(passwordMock, salt);

  await execQuery(`
      UPDATE staff SET user_password = '${hashedPassword}' WHERE id = ${storeManager.id}
    `);

  return { email, password: passwordMock };
}

export async function getStaffCredential() {
  const [staff] = await execQuery(`
    SELECT staff.id, email
    FROM staff LEFT OUTER JOIN store ON staff.store_id = store.id
    WHERE store.store_manager_id <> staff.id AND staff.active = true
    LIMIT 1
  `);

  const email = staff.email;

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(passwordMock, salt);

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

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(passwordMock, salt);

  await execQuery(`
      UPDATE customer SET user_password = '${hashedPassword}' WHERE id = ${customer.id}
    `);

  return { email, password: passwordMock };
}

export async function getUserCredential() {
  const [user] = await execQuery(`
    SELECT email, user_password as "userPassword"
    FROM public.user LIMIT 1
  `);

  const email = user.email;
  const password = user.userPassword;

  return { email, password };
}
