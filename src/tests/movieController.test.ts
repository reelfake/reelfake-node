import supertest from 'supertest';
import app from '../app';
import * as dbQuery from '../utils/dbQuery';
import {
  ITEMS_COUNT_PER_PAGE_FOR_TEST,
  execQuery,
  getRowsCount,
  getRandomNumber,
  getRandomCharacters,
  getRandomActors,
  getRandomDate,
  getStoreManagerCredential,
  getStaffCredential,
  getCustomerCredential,
} from './testUtil';
import { MovieActorPayload } from '../types';

describe('Movie Controller', () => {
  let cookie: string;
  const login = async (email: string, password: string) => {
    const loginResponse = await server.post('/api/v1/user/login').send({ email, password });
    cookie = loginResponse.get('Set-Cookie')?.at(0) || '';
  };

  const server = supertest(app);

  const getMoviePayload = async () => {
    const [highestTmdbIdQueryResult] = await execQuery(`
      SELECT MAX(tmdb_id) AS "highestTmdbId" FROM movie
    `);
    const highestTmdbId = highestTmdbIdQueryResult.highestTmdbId;
    const randomMovieTitle = `${getRandomCharacters(5)} ${getRandomCharacters(20)}`;

    return {
      tmdbId: highestTmdbId + 1,
      imdbId: `tt${getRandomNumber(4)}`,
      title: randomMovieTitle,
      originalTitle: randomMovieTitle,
      overview: 'Lorem Ipsum is simply dummy text of the printing and typesetting industry',
      runtime: 0,
      releaseDate: getRandomDate(1970, new Date().getFullYear()),
      genres: ['Action', 'Adventure', 'Thriller'],
      countriesOfOrigin: ['us'],
      language: 'en',
      movieStatus: 'Released',
      popularity: 11.6313,
      budget: '400000000',
      revenue: '0',
      ratingAverage: 0,
      ratingCount: 0,
      posterUrl: `https://image.tmdb.org/t/p/w500/${getRandomCharacters(27)}.jpg`,
      rentalRate: 15.99,
    };
  };

  afterEach(() => {
    jest.restoreAllMocks();
    cookie = '';
  });

  describe('GET /movies', () => {
    it('should return movies page by page', async () => {
      const startingPage = 1;
      const totalRows = await getRowsCount('movie');

      const iterations = 3;

      for (let i = startingPage; i < iterations + startingPage; i++) {
        const response = await server.get(`/api/v1/movies?pageNumber=${i}`);
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');

        const expectedMovies = await execQuery(`
          with expanded_movies as (
            SELECT ROW_NUMBER() OVER (ORDER BY m.id) AS "rowNumber", m.id, m.title, m.overview, m.runtime, 
            m.release_date AS "releaseDate", ARRAY_AGG(distinct g.genre_name) AS genres, 
            ARRAY_AGG(distinct c.iso_country_code) AS "countriesOfOrigin", ml.iso_language_code as language, m.popularity, 
            m.rating_average AS "ratingAverage", m.rating_count AS "ratingCount", m.poster_url AS "posterUrl",
            m.rental_rate AS "rentalRate"
            FROM movie AS m LEFT JOIN country AS c ON c.id = ANY(m.origin_country_ids)
            LEFT JOIN genre AS g ON g.id = ANY(m.genre_ids)
            LEFT JOIN movie_language ml ON m.language_id = ml.id
            GROUP BY m.id, ml.iso_language_code
            ORDER BY m.id
          )
          SELECT id, title, overview, runtime, "releaseDate", genres, "countriesOfOrigin", language,
          popularity, "ratingAverage", "ratingCount", "posterUrl", "rentalRate" FROM expanded_movies 
          WHERE "rowNumber" > ${(i - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST} limit 50;
        `);

        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: 50,
          totalItems: Number(totalRows),
          totalPages: Math.ceil(totalRows / 50),
        });
        expect(response.headers['rf-page-number']).toBe(`${i}`);
      }
    });

    it('should return for the correct page when jumping between pages', async () => {
      const pages = [3, 7, 4];
      const totalRows = await getRowsCount('movie');

      for (const page of pages) {
        const response = await server.get(`/api/v1/movies?pageNumber=${page}`);
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        const expectedMovies = await execQuery(`
          with expanded_movies as (
            SELECT ROW_NUMBER() OVER (ORDER BY m.id) AS "rowNumber", m.id, m.title, m.overview, m.runtime, 
            m.release_date AS "releaseDate", ARRAY_AGG(distinct g.genre_name) AS genres, 
            ARRAY_AGG(distinct c.iso_country_code) AS "countriesOfOrigin", ml.iso_language_code as language, m.popularity, 
            m.rating_average AS "ratingAverage", m.rating_count AS "ratingCount", m.poster_url AS "posterUrl",
            m.rental_rate AS "rentalRate"
            FROM movie AS m LEFT JOIN country AS c ON c.id = ANY(m.origin_country_ids)
            LEFT JOIN genre AS g ON g.id = ANY(m.genre_ids)
            LEFT JOIN movie_language ml ON m.language_id = ml.id
            GROUP BY m.id, ml.iso_language_code
            ORDER BY m.id
          )
          SELECT id, title, overview, runtime, "releaseDate", genres, "countriesOfOrigin", language,
          popularity, "ratingAverage", "ratingCount", "posterUrl", "rentalRate" FROM expanded_movies 
          WHERE "rowNumber" > ${(page - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST} limit 50;
        `);

        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: 50,
          totalItems: Number(totalRows),
          totalPages: Math.ceil(totalRows / 50),
        });
        expect(response.headers['rf-page-number']).toBe(`${page}`);
      }
    });

    it('GET /api/v1/movies?releaseYear=2020 should return movies release in 2020 with pagination support', async () => {
      const startingPage = 1;

      const totalRows = await getRowsCount('movie', "release_date BETWEEN '2020-01-01' AND '2020-12-31'");

      const iterations = 3;

      for (let i = startingPage; i < iterations + startingPage; i++) {
        const url = i > 1 ? `/api/v1/movies?releaseYear=2020&pageNumber=${i}` : '/api/v1/movies?releaseYear=2020';

        const response = await server.get(url);
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        const expectedMovies = await execQuery(`
          with expanded_movies as (
            SELECT ROW_NUMBER() OVER (ORDER BY release_date, m.id) AS "rowNumber", m.id, m.title, m.overview, m.runtime, 
            m.release_date AS "releaseDate", ARRAY_AGG(distinct g.genre_name) AS genres, 
            ARRAY_AGG(distinct c.iso_country_code) AS "countriesOfOrigin", ml.iso_language_code as language, m.popularity, 
            m.rating_average AS "ratingAverage", m.rating_count AS "ratingCount", m.poster_url AS "posterUrl",
            m.rental_rate AS "rentalRate"
            FROM movie AS m LEFT JOIN country AS c ON c.id = ANY(m.origin_country_ids)
            LEFT JOIN genre AS g ON g.id = ANY(m.genre_ids)
            LEFT JOIN movie_language ml ON m.language_id = ml.id
            GROUP BY m.id, ml.iso_language_code HAVING m.release_date BETWEEN '2020-01-01' AND '2020-12-31'
            ORDER BY release_date, m.id
          )
          SELECT id, title, overview, runtime, "releaseDate", genres, "countriesOfOrigin", language,
          popularity, "ratingAverage", "ratingCount", "posterUrl", "rentalRate" FROM expanded_movies 
          WHERE "rowNumber" > ${(i - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST} limit 50;
        `);

        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: 50,
          totalItems: Number(totalRows),
          totalPages: Math.ceil(totalRows / 50),
        });
      }
    });

    it('GET /api/v1/movies?releaseYear=2020 should return for the correct page when jumping between pages', async () => {
      const pages = [3, 7, 4];
      const totalRows = await getRowsCount('movie', "release_date BETWEEN '2020-01-01' AND '2020-12-31'");

      for (const page of pages) {
        const response = await server.get(`/api/v1/movies?releaseYear=2020&pageNumber=${page}`);
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        const expectedMovies = await execQuery(`
          with expanded_movies as (
            SELECT ROW_NUMBER() OVER (ORDER BY release_date, m.id) AS "rowNumber", m.id, m.title, m.overview, m.runtime, 
            m.release_date AS "releaseDate", ARRAY_AGG(distinct g.genre_name) AS genres, 
            ARRAY_AGG(distinct c.iso_country_code) AS "countriesOfOrigin", ml.iso_language_code as language, m.popularity, 
            m.rating_average AS "ratingAverage", m.rating_count AS "ratingCount", m.poster_url AS "posterUrl",
            m.rental_rate AS "rentalRate"
            FROM movie AS m LEFT JOIN country AS c ON c.id = ANY(m.origin_country_ids)
            LEFT JOIN genre AS g ON g.id = ANY(m.genre_ids)
            LEFT JOIN movie_language ml ON m.language_id = ml.id
            GROUP BY m.id, ml.iso_language_code HAVING m.release_date BETWEEN '2020-01-01' AND '2020-12-31'
            ORDER BY release_date, m.id
          )
          SELECT id, title, overview, runtime, "releaseDate", genres, "countriesOfOrigin", language,
          popularity, "ratingAverage", "ratingCount", "posterUrl", "rentalRate" FROM expanded_movies 
          WHERE "rowNumber" > ${(page - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST} limit 50;
        `);

        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: 50,
          totalItems: Number(totalRows),
          totalPages: Math.ceil(totalRows / 50),
        });
        expect(response.get('rf-page-number')).toBe(`${page}`);
      }
    });

    it('GET /api/v1/movies?releaseYear=2020&genres=... should return movies under given genres', async () => {
      const startingPage = 1;

      const totalRows = await getRowsCount(
        'movie',
        `release_date BETWEEN '2020-01-01' AND '2020-12-31' AND genre_ids @> '{1,2}'`
      );

      const iterations = 3;

      for (let i = startingPage; i < iterations + startingPage; i++) {
        const url =
          i > 1
            ? `/api/v1/movies?releaseYear=2020&genres=action,adventure&pageNumber=${i}`
            : '/api/v1/movies?releaseYear=2020&genres=action,adventure';

        const response = await server.get(url);

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        const expectedMovies = await execQuery(`
          with expanded_movies as (
            SELECT ROW_NUMBER() OVER (ORDER BY release_date, m.id) AS "rowNumber", m.id, m.title, m.overview, m.runtime, 
            m.release_date AS "releaseDate", ARRAY_AGG(distinct g.genre_name) AS genres, 
            ARRAY_AGG(distinct c.iso_country_code) AS "countriesOfOrigin", ml.iso_language_code as language, m.popularity, 
            m.rating_average AS "ratingAverage", m.rating_count AS "ratingCount", m.poster_url AS "posterUrl",
            m.rental_rate AS "rentalRate"
            FROM movie AS m LEFT JOIN country AS c ON c.id = ANY(m.origin_country_ids)
            LEFT JOIN genre AS g ON g.id = ANY(m.genre_ids)
            LEFT JOIN movie_language ml ON m.language_id = ml.id
            GROUP BY m.id, ml.iso_language_code HAVING ARRAY_AGG(g.genre_name) @> '{"Action", "Adventure"}' 
            AND m.release_date BETWEEN '2020-01-01' AND '2020-12-31'
            ORDER BY release_date, m.id
          )
          SELECT id, title, overview, runtime, "releaseDate", genres, "countriesOfOrigin", language,
          popularity, "ratingAverage", "ratingCount", "posterUrl", "rentalRate" FROM expanded_movies 
          WHERE "rowNumber" > ${(i - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST} limit 50;
        `);

        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: expectedMovies.length,
          totalItems: Number(totalRows),
          totalPages: Math.ceil(totalRows / ITEMS_COUNT_PER_PAGE_FOR_TEST),
        });
      }
    });

    it('GET /api/v1/movies?genres=... should return movies under given genres', async () => {
      const startingPage = 1;

      const totalRows = await getRowsCount('movie', `genre_ids @> '{1,2,17}'`);

      const iterations = 3;

      for (let i = startingPage; i < iterations + startingPage; i++) {
        const url =
          i > 1
            ? `/api/v1/movies?genres=action,adventure,thriller&pageNumber=${i}`
            : '/api/v1/movies?genres=action,adventure,thriller';

        const response = await server.get(url);
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        const expectedMovies = await execQuery(`
          with expanded_movies as (
            SELECT ROW_NUMBER() OVER (ORDER BY m.id) AS "rowNumber", m.id, m.title, m.overview, m.runtime, 
            m.release_date AS "releaseDate", ARRAY_AGG(distinct g.genre_name) AS genres, 
            ARRAY_AGG(distinct c.iso_country_code) AS "countriesOfOrigin", ml.iso_language_code as language, m.popularity, 
            m.rating_average AS "ratingAverage", m.rating_count AS "ratingCount", m.poster_url AS "posterUrl",
            m.rental_rate AS "rentalRate"
            FROM movie AS m LEFT JOIN country AS c ON c.id = ANY(m.origin_country_ids)
            LEFT JOIN genre AS g ON g.id = ANY(m.genre_ids)
            LEFT JOIN movie_language ml ON m.language_id = ml.id
            GROUP BY m.id, ml.iso_language_code HAVING ARRAY_AGG(g.genre_name) @> '{"Action", "Adventure", "Thriller"}' 
            ORDER BY m.id
          )
          SELECT id, title, overview, runtime, "releaseDate", genres, "countriesOfOrigin", language,
          popularity, "ratingAverage", "ratingCount", "posterUrl", "rentalRate" FROM expanded_movies 
          WHERE "rowNumber" > ${(i - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST} limit 50;
        `);

        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: ITEMS_COUNT_PER_PAGE_FOR_TEST,
          totalItems: Number(totalRows),
          totalPages: Math.ceil(totalRows / ITEMS_COUNT_PER_PAGE_FOR_TEST),
        });
      }
    });

    it('GET /api/v1/movies?genres=... should return correct list when jumping between pages', async () => {
      const startingPage = 1;

      const totalRows = await getRowsCount('movie', `genre_ids @> '{1,2,17}'`);

      const pages = [3, 7, 4];

      for (const page of pages) {
        const url =
          page > 1
            ? `/api/v1/movies?genres=action,adventure,thriller&pageNumber=${page}`
            : '/api/v1/movies?genres=action,adventure,thriller';

        const response = await server.get(url);

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        const expectedMovies = await execQuery(`
          with expanded_movies as (
            SELECT ROW_NUMBER() OVER (ORDER BY m.id) AS "rowNumber", m.id, m.title, m.overview, m.runtime, 
            m.release_date AS "releaseDate", ARRAY_AGG(distinct g.genre_name) AS genres, 
            ARRAY_AGG(distinct c.iso_country_code) AS "countriesOfOrigin", ml.iso_language_code as language, m.popularity, 
            m.rating_average AS "ratingAverage", m.rating_count AS "ratingCount", m.poster_url AS "posterUrl",
            m.rental_rate AS "rentalRate"
            FROM movie AS m LEFT JOIN country AS c ON c.id = ANY(m.origin_country_ids)
            LEFT JOIN genre AS g ON g.id = ANY(m.genre_ids)
            LEFT JOIN movie_language ml ON m.language_id = ml.id
            GROUP BY m.id, ml.iso_language_code HAVING ARRAY_AGG(g.genre_name) @> '{"Action", "Adventure", "Thriller"}' 
            ORDER BY m.id
          )
          SELECT id, title, overview, runtime, "releaseDate", genres, "countriesOfOrigin", language,
          popularity, "ratingAverage", "ratingCount", "posterUrl", "rentalRate" FROM expanded_movies 
          WHERE "rowNumber" > ${(page - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST} limit 50;
        `);
        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: ITEMS_COUNT_PER_PAGE_FOR_TEST,
          totalItems: Number(totalRows),
          totalPages: Math.ceil(totalRows / ITEMS_COUNT_PER_PAGE_FOR_TEST),
        });
      }
    });

    it('GET /api/v1/movies should return 404 when there are no more pages available', async () => {
      const rowsCount = await getRowsCount('movie');
      let response = await server.get('/api/v1/movies');
      const totalPages = Number(response.body.totalPages);
      response = await server.get(`/api/v1/movies?pageNumber=${totalPages + 1}`).set({
        'rf-last-visited-page': String(totalPages),
        'rf-last-id-last-visited-page': String(rowsCount),
      });
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Page out of range');
    });

    it('GET /api/v1/movies should return 500 on exception', async () => {
      jest.spyOn(dbQuery, 'executeQuery').mockRejectedValue({ message: 'unit testing exception for /api/v1/movies' });
      const response = await server.get('/api/v1/movies?pageNumber=1');
      expect(response.status).toBe(500);
      expect(response.body.message).toEqual('unit testing exception for /api/v1/movies');
    });

    it('GET /api/v1/movies?releaseDates=... should return movies between the release dates with pagination', async () => {
      const startingPage = 1;
      const totalRows = await getRowsCount('movie', "release_date BETWEEN '2024-03-01' AND '2024-03-04'");

      const iterations = 3;

      for (let i = startingPage; i < iterations + startingPage; i++) {
        const response = await server.get(`/api/v1/movies?releaseFrom=2024-03-01&releaseTo=2024-03-04&pageNumber=${i}`);
        const expectedMovies = await execQuery(`
          with expanded_movies as (
            SELECT ROW_NUMBER() OVER (ORDER BY m.release_date, m.id) AS "rowNumber", m.id, m.title, m.overview, m.runtime, 
            m.release_date AS "releaseDate", ARRAY_AGG(distinct g.genre_name) AS genres, 
            ARRAY_AGG(distinct c.iso_country_code) AS "countriesOfOrigin", ml.iso_language_code as language, m.popularity, 
            m.rating_average AS "ratingAverage", m.rating_count AS "ratingCount", m.poster_url AS "posterUrl",
            m.rental_rate AS "rentalRate"
            FROM movie AS m LEFT JOIN country AS c ON c.id = ANY(m.origin_country_ids)
            LEFT JOIN genre AS g ON g.id = ANY(m.genre_ids)
            LEFT JOIN movie_language ml ON m.language_id = ml.id
            GROUP BY m.id, ml.iso_language_code HAVING m.release_date BETWEEN '2024-03-01' AND '2024-03-04'
            ORDER BY m.release_date, m.id
          )
          SELECT id, title, overview, runtime, "releaseDate", genres, "countriesOfOrigin", language,
          popularity, "ratingAverage", "ratingCount", "posterUrl", "rentalRate" FROM expanded_movies 
          WHERE "rowNumber" > ${(i - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST} limit 50;
        `);

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: ITEMS_COUNT_PER_PAGE_FOR_TEST,
          totalPages: Math.ceil(totalRows / ITEMS_COUNT_PER_PAGE_FOR_TEST),
          totalItems: Number(totalRows),
        });
      }
    });

    it('GET /api/v1/movies?releaseDates=... should return correct movies when jumping between pages', async () => {
      const totalRows = await getRowsCount('movie', "release_date BETWEEN '2024-03-01' AND '2024-03-04'");

      const pages = [2, 5, 3];

      for (const page of pages) {
        const response = await server.get(
          `/api/v1/movies?releaseFrom=2024-03-01&releaseTo=2024-03-04&pageNumber=${page}`
        );
        const expectedMovies = await execQuery(`
          with expanded_movies as (
            SELECT ROW_NUMBER() OVER (ORDER BY m.release_date, m.id) AS "rowNumber", m.id, m.title, m.overview, m.runtime, 
            m.release_date AS "releaseDate", ARRAY_AGG(distinct g.genre_name) AS genres, 
            ARRAY_AGG(distinct c.iso_country_code) AS "countriesOfOrigin", ml.iso_language_code as language, m.popularity, 
            m.rating_average AS "ratingAverage", m.rating_count AS "ratingCount", m.poster_url AS "posterUrl",
            m.rental_rate AS "rentalRate"
            FROM movie AS m LEFT JOIN country AS c ON c.id = ANY(m.origin_country_ids)
            LEFT JOIN genre AS g ON g.id = ANY(m.genre_ids)
            LEFT JOIN movie_language ml ON m.language_id = ml.id
            GROUP BY m.id, ml.iso_language_code HAVING m.release_date BETWEEN '2024-03-01' AND '2024-03-04'
            ORDER BY m.release_date, m.id
          )
          SELECT id, title, overview, runtime, "releaseDate", genres, "countriesOfOrigin", language,
          popularity, "ratingAverage", "ratingCount", "posterUrl", "rentalRate" FROM expanded_movies 
          WHERE "rowNumber" > ${(page - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST} limit 50;
        `);
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: ITEMS_COUNT_PER_PAGE_FOR_TEST,
          totalPages: Math.ceil(totalRows / ITEMS_COUNT_PER_PAGE_FOR_TEST),
          totalItems: Number(totalRows),
        });
      }
    });

    it('GET /api/v1/movies?releaseDates=...&genres=... should return movies under given genres', async () => {
      const startingPage = 1;

      const totalRows = await getRowsCount(
        'movie',
        `genre_ids @> '{1,2}' AND release_date BETWEEN '2024-03-01' AND '2024-10-31'`
      );

      const iterations = 3;

      for (let i = startingPage; i < iterations + startingPage; i++) {
        const url =
          i > 1
            ? `/api/v1/movies?releaseFrom=2024-03-01&releaseTo=2024-10-31&genres=action,adventure&pageNumber=${i}`
            : '/api/v1/movies?releaseFrom=2024-03-01&releaseTo=2024-10-31&genres=action,adventure';

        const response = await server.get(url);
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        const expectedMovies = await execQuery(`
          with expanded_movies as (
            SELECT ROW_NUMBER() OVER (ORDER BY m.release_date, m.id) AS "rowNumber", m.id, m.title, m.overview, m.runtime, 
            m.release_date AS "releaseDate", ARRAY_AGG(distinct g.genre_name) AS genres, 
            ARRAY_AGG(distinct c.iso_country_code) AS "countriesOfOrigin", ml.iso_language_code as language, m.popularity, 
            m.rating_average AS "ratingAverage", m.rating_count AS "ratingCount", m.poster_url AS "posterUrl",
            m.rental_rate AS "rentalRate"
            FROM movie AS m LEFT JOIN country AS c ON c.id = ANY(m.origin_country_ids)
            LEFT JOIN genre AS g ON g.id = ANY(m.genre_ids)
            LEFT JOIN movie_language ml ON m.language_id = ml.id
            GROUP BY m.id, ml.iso_language_code HAVING ARRAY_AGG(g.genre_name) @> '{"Action", "Adventure"}' 
            AND m.release_date BETWEEN '2024-03-01' AND '2024-10-31'
            ORDER BY m.release_date, m.id
          )
          SELECT id, title, overview, runtime, "releaseDate", genres, "countriesOfOrigin", language,
          popularity, "ratingAverage", "ratingCount", "posterUrl", "rentalRate" FROM expanded_movies 
          WHERE "rowNumber" > ${(i - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST} limit 50;
        `);

        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: expectedMovies.length,
          totalItems: Number(totalRows),
          totalPages: Math.ceil(totalRows / ITEMS_COUNT_PER_PAGE_FOR_TEST),
        });
      }
    });

    it('GET /api/v1/movies?genres=... should return correct list when jumping between pages', async () => {
      const totalRows = await getRowsCount('movie', `genre_ids @> '{1,2}'`);

      const pages = [3, 7, 4];

      for (const page of pages) {
        const url =
          page > 1
            ? `/api/v1/movies?genres=action,adventure&pageNumber=${page}`
            : '/api/v1/movies?genres=action,adventure';

        const response = await server.get(url);

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        const expectedMovies = await execQuery(`
          with expanded_movies as (
            SELECT ROW_NUMBER() OVER (ORDER BY m.id) AS "rowNumber", m.id, m.title, m.overview, m.runtime, 
            m.release_date AS "releaseDate", ARRAY_AGG(distinct g.genre_name) AS genres, 
            ARRAY_AGG(distinct c.iso_country_code) AS "countriesOfOrigin", ml.iso_language_code as language, m.popularity, 
            m.rating_average AS "ratingAverage", m.rating_count AS "ratingCount", m.poster_url AS "posterUrl",
            m.rental_rate AS "rentalRate"
            FROM movie AS m LEFT JOIN country AS c ON c.id = ANY(m.origin_country_ids)
            LEFT JOIN genre AS g ON g.id = ANY(m.genre_ids)
            LEFT JOIN movie_language ml ON m.language_id = ml.id
            GROUP BY m.id, ml.iso_language_code HAVING ARRAY_AGG(g.genre_name) @> '{"Action", "Adventure"}'
            ORDER BY m.id
          )
          SELECT id, title, overview, runtime, "releaseDate", genres, "countriesOfOrigin", language,
          popularity, "ratingAverage", "ratingCount", "posterUrl", "rentalRate" FROM expanded_movies 
          WHERE "rowNumber" > ${(page - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST} limit 50;
        `);
        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: ITEMS_COUNT_PER_PAGE_FOR_TEST,
          totalItems: Number(totalRows),
          totalPages: Math.ceil(totalRows / ITEMS_COUNT_PER_PAGE_FOR_TEST),
        });
      }
    });

    it('GET /api/v1/movies should return 400 for invalid pageNumber', async () => {
      const pageNumber = 'x';
      const response = await server.get(`/api/v1/movies?pageNumber=${pageNumber}`);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Page number should be a valid non-zero positive number');
    });

    it('GET /api/v1/movies should return 400 when pageNumber is 0', async () => {
      const pageNumber = 0;
      const response = await server.get(`/api/v1/movies?pageNumber=${pageNumber}`);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Page number should be a valid non-zero positive number');
    });

    it('GET /movies should return 400 when releaseYear in query is invalid', async () => {
      const releaseYear = 'invalid';
      const response = await server.get(`/api/v1/movies?releaseYear=${releaseYear}`);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid release year');
    });

    it('GET /movies should return 400 when genres in query is invalid', async () => {
      const invalidGenres = 'action,drama,invalid_genre';
      const response = await server.get(`/api/v1/movies?genres=${invalidGenres}`);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('[invalid_genre] are invalid genres');
    });

    it('GET /movies should return 400 when releaseFrom is in query but releaseTo is missing', async () => {
      const response = await server.get(`/api/v1/movies?releaseFrom=2024-05-01`);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('To filter by release dates, release date from and to are required.');
    });

    it('GET /movies should return 400 when releaseTo is in query but releaseFrom is missing', async () => {
      const response = await server.get(`/api/v1/movies?releaseTo=2024-05-01`);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('To filter by release dates, release date from and to are required.');
    });

    it('GET /movies should return 400 when releaseYear and release dates both are in query', async () => {
      const response = await server.get(`/api/v1/movies?releaseYear=2024&releaseFrom=2024-04-01&releaseTo=2024-05-01`);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Release year and release dates cannot be used together');
    });

    it('GET /movies should return 400 when releaseFrom has invalid format in query', async () => {
      const response = await server.get(`/api/v1/movies?releaseFrom=2024-04-xx&releaseTo=2024-05-01`);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid release date');
    });

    it('GET /movies should return 400 when releaseTo has invalid format in query', async () => {
      const response = await server.get(`/api/v1/movies?releaseFrom=2024-04-01&releaseTo=2024-xx-01`);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid release date');
    });
  });

  describe('GET /movies/:id', () => {
    const getMovieData = async (id: number, includeActors: boolean = false) => {
      const [actualMovieData] = await execQuery(`
        SELECT m.id AS "id", m.imdb_id AS "imdbId", m.title AS "title", m.original_title AS "originalTitle",
        m.overview, m.runtime, m.release_date AS "releaseDate",
        ml.iso_language_code AS "language",
        m.movie_status AS "movieStatus",
        m.popularity,
        m.budget, m.revenue, m.rating_average AS "ratingAverage",
        m.rating_count AS "ratingCount", m.poster_url AS "posterUrl",
        m.rental_rate AS "rentalRate",
        ${
          includeActors
            ? `json_agg(
          json_build_object(
            'id', a.id,
            'actorName', a.actor_name,
            'characterName', ma.character_name,
            'castOrder', ma.cast_order,
            'profilePictureUrl', a.profile_picture_url
          )
        ) AS actors,`
            : ''
        }
        (SELECT json_agg(genre_name) FROM genre INNER JOIN unnest(m.genre_ids) AS g_ids ON genre.id = g_ids) AS genres,
        (
          SELECT json_agg(iso_country_code)
          FROM country INNER JOIN unnest(m.origin_country_ids) AS c_ids
          ON country.id = c_ids
        ) AS "countriesOfOrigin"
        FROM movie AS m LEFT JOIN movie_actor AS ma ON m.id = ma.movie_id
        LEFT JOIN actor AS a ON a.id = ma.actor_id
        LEFT JOIN movie_language AS ml ON ml.id = m.language_id
        WHERE m.id = ${id}
        GROUP BY m.id, ml.iso_language_code;
      `);
      return actualMovieData;
    };

    it('should return movie object with the actors', async () => {
      const response = await server.get(`/api/v1/movies/100?includeActors=true`);
      expect(response.status).toBe(200);
      expect(response.get('Content-Type')).toBe('application/json; charset=utf-8');
      const actualMovieData = await getMovieData(100, true);
      expect(response.body).toStrictEqual(actualMovieData);
    });

    it('should return movie object without the actors', async () => {
      const response = await server.get(`/api/v1/movies/100?includeActors=false`);
      expect(response.status).toBe(200);
      expect(response.get('Content-Type')).toBe('application/json; charset=utf-8');
      const actualMovieData = await getMovieData(100);
      expect(response.body).toStrictEqual(actualMovieData);
    });

    it('should return movie object without the actors', async () => {
      const response = await server.get(`/api/v1/movies/100?includeActors=no`);
      expect(response.status).toBe(200);
      expect(response.get('Content-Type')).toBe('application/json; charset=utf-8');
      const actualMovieData = await getMovieData(100);
      expect(response.body).toStrictEqual(actualMovieData);
    });

    it('should return movie object without the actors', async () => {
      const response = await server.get(`/api/v1/movies/100?includeActors=0`);
      expect(response.status).toBe(200);
      expect(response.get('Content-Type')).toBe('application/json; charset=utf-8');
      const actualMovieData = await getMovieData(100);
      expect(response.body).toStrictEqual(actualMovieData);
    });

    it('should return movie object with the actors', async () => {
      const response = await server.get(`/api/v1/movies/100?includeActors=true`);
      expect(response.status).toBe(200);
      expect(response.get('Content-Type')).toBe('application/json; charset=utf-8');
      const actualMovieData = await getMovieData(100, true);
      expect(response.body).toStrictEqual(actualMovieData);
    });

    it('should return movie object with the actors', async () => {
      const response = await server.get(`/api/v1/movies/100?includeActors=yes`);
      expect(response.status).toBe(200);
      expect(response.get('Content-Type')).toBe('application/json; charset=utf-8');
      const actualMovieData = await getMovieData(100, true);
      expect(response.body).toStrictEqual(actualMovieData);
    });

    it('should return movie object with the actors', async () => {
      const response = await server.get(`/api/v1/movies/100?includeActors=1`);
      expect(response.status).toBe(200);
      expect(response.get('Content-Type')).toBe('application/json; charset=utf-8');
      const actualMovieData = await getMovieData(100, true);
      expect(response.body).toStrictEqual(actualMovieData);
    });

    it('should return the movie stock count at all stores', async () => {
      const id = 680;

      const response = await server.get(`/api/v1/movies/${id}/stores`);
      expect(response.status).toBe(200);
      expect(response.get('Content-Type')).toBe('application/json; charset=utf-8');

      const expectedResult = await execQuery(
        `
          SELECT i.id AS "inventoryId", i.stock_count AS stock, 
          json_build_object(
            'id', s.id,
            'managerId', s.store_manager_id,
            'phoneNumber', s.phone_number, 
            'addressLine', a.address_line, 
            'city', c.city_name, 
            'state', c.state_name, 
            'country', cy.country_name, 
            'postalCode', a.postal_code
          ) as "store" FROM inventory AS i LEFT OUTER JOIN store AS s ON i.store_id = s.id
          LEFT OUTER JOIN address AS a ON s.address_id = a.id
          LEFT OUTER JOIN city AS c on a.city_id = c.id LEFT OUTER JOIN country AS cy ON c.country_id = cy.id
          WHERE i.movie_id = ${id} ORDER BY stock DESC, "inventoryId" ASC;
        `
      );

      expect(response.body).toStrictEqual({
        items: expectedResult,
        length: expectedResult.length,
      });
    });

    it('should return 400 since the movie id is not valid', async () => {
      const response = await server.get(`/api/v1/movies/abc`);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid movie id. Movie id must be a non-zero positive number.');
    });

    it('should return 400 since the includeActors flag has invalid value', async () => {
      const response = await server.get(`/api/v1/movies/100?includeActors=blahblahck`);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        'Invalid value for includeActors in query. Please refer to api specs for more information.'
      );
    });

    it('should return 404 since movie with the given id does not exist', async () => {
      const id = 10394829;
      const response = await server.get(`/api/v1/movies/${id}`);
      expect(response.status).toBe(404);
      expect(response.body.message).toBe(`Movie with id ${id} does not exist`);
    });

    it('should return 400 if id is invalid', async () => {
      const response = await server.get(`/api/v1/movies/blah/stores`);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid movie id');
    });

    it('should return 404 if movie is out of stock', async () => {
      const response = await server.get(`/api/v1/movies/4294292372/stores`);
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Movie is out of stock');
    });
  });

  describe('POST /movies', () => {
    it('should create movie with the data in request body and token in cookie', async () => {
      const moviePayload = await getMoviePayload();

      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const response = await server
        .post('/api/v1/movies')
        .send(moviePayload)
        .set('Cookie', cookie)
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json');
      const newMovieId = response.body.id;
      const [actualMovieData] = await execQuery(`
        SELECT m.id, m.tmdb_id AS "tmdbId", m.imdb_id AS "imdbId", m.title, m.original_title AS "originalTitle",
        m.overview, m.runtime, m.release_date AS "releaseDate", array_agg(g.genre_name) AS "genres", 
        array_agg(DISTINCT c.iso_country_code) AS "countriesOfOrigin", l.iso_language_code AS "language",
        m.movie_status AS "movieStatus", m.popularity, m.budget, m.revenue,
        m.rating_average AS "ratingAverage", m.rating_count AS "ratingCount",
        m.poster_url AS "posterUrl", m.rental_rate AS "rentalRate"
        FROM movie AS m LEFT JOIN genre AS g ON g.id = ANY(m.genre_ids)
        LEFT JOIN country AS c ON c.id = ANY(m.origin_country_ids)
        LEFT JOIN movie_language AS l ON m.language_id = l.id
        WHERE m.id = ${newMovieId}
        GROUP BY m.id, m.tmdb_id, m.imdb_id, m.title, m.original_title, m.overview, l.iso_language_code, m.runtime, 
        m.release_Date, m.movie_status, m.popularity, m.budget, m.revenue, m.rating_average, m.rating_count,
        m.poster_url, m.rental_rate;  
      `);
      expect(response.statusCode).toBe(201);
      expect(response.body).toStrictEqual(actualMovieData);
    });

    it('should create movies with actors', async () => {
      const actors = await getRandomActors(5);
      const moviePayload = await getMoviePayload();

      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const response = await server
        .post('/api/v1/movies')
        .send({
          ...moviePayload,
          actors,
        })
        .set('Cookie', cookie);

      const newMovieId = response.body.id;

      const [actualMovieData] = await execQuery(`
        SELECT m.id AS "id", m.imdb_id AS "imdbId", m.title AS "title", m.original_title AS "originalTitle",
        m.overview, m.runtime, m.release_date AS "releaseDate",
        ml.iso_language_code AS "language",
        m.movie_status AS "movieStatus",
        m.popularity,
        m.budget, m.revenue, m.rating_average AS "ratingAverage",
        m.rating_count AS "ratingCount", m.poster_url AS "posterUrl",
        m.rental_rate AS "rentalRate",
        json_agg(
          json_build_object(
            'id', a.id,
            'actorName', a.actor_name,
            'characterName', ma.character_name,
            'castOrder', ma.cast_order,
            'profilePictureUrl', a.profile_picture_url
          )
        ) AS actors,
        (SELECT json_agg(genre_name) FROM genre INNER JOIN unnest(m.genre_ids) AS g_ids ON genre.id = g_ids) AS genres,
        (
          SELECT json_agg(iso_country_code)
          FROM country INNER JOIN unnest(m.origin_country_ids) AS c_ids
          ON country.id = c_ids
        ) AS "countriesOfOrigin"
        FROM movie AS m LEFT JOIN movie_actor AS ma ON m.id = ma.movie_id
        LEFT JOIN actor AS a ON a.id = ma.actor_id
        LEFT JOIN movie_language AS ml ON ml.id = m.language_id
        WHERE m.id = ${newMovieId}
        GROUP BY m.id, ml.iso_language_code;
      `);
      expect(response.body).toEqual(actualMovieData);
    });

    it('should not let staff to create movie', async () => {
      const moviePayload = await getMoviePayload();

      const credential = await getStaffCredential();
      await login(credential.email, credential.password);

      const response = await server.post('/api/v1/movies').send(moviePayload).set('Cookie', cookie);
      expect(response.status).toEqual(403);
      expect(response.body).toEqual({
        status: 'error',
        message: 'You are not authorized to perform this operation',
      });
    });

    it('should not let customer to create movie', async () => {
      const moviePayload = await getMoviePayload();

      const credential = await getCustomerCredential();
      await login(credential.email, credential.password);

      const response = await server.post('/api/v1/movies').send(moviePayload).set('Cookie', cookie);
      expect(response.status).toEqual(403);
      expect(response.body).toEqual({
        status: 'error',
        message: 'You are not authorized to perform this operation',
      });
    });
  });

  describe('PUT /movies/:id', () => {
    afterEach(() => {
      cookie = '';
    });

    it('should update title and original title of the movie with the payload', async () => {
      const newMoviePayload = await getMoviePayload();

      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const newMovieResponse = await server.post('/api/v1/movies').set('Cookie', cookie).send(newMoviePayload);
      const newMovieId = newMovieResponse.body.id;

      const [beforeUpdate] = await execQuery(`
        SELECT title, original_title AS "originalTitle" FROM movie WHERE id = ${newMovieId}
      `);

      expect(beforeUpdate.title).toEqual(newMovieResponse.body.title);
      expect(beforeUpdate.originalTitle).toEqual(newMovieResponse.body.originalTitle);

      const newMovieTitle = `${getRandomCharacters(5)} ${getRandomCharacters(10)} ${Date.now()}`;
      const response = await server.put(`/api/v1/movies/${newMovieId}`).set('Cookie', cookie).send({
        title: newMovieTitle,
        originalTitle: newMovieTitle,
      });

      expect(response.status).toEqual(204);

      const [afterUpdate] = await execQuery(`
        SELECT title, original_title AS "originalTitle" FROM movie WHERE id = ${newMovieId}
      `);

      expect(afterUpdate.title).toEqual(newMovieTitle);
      expect(afterUpdate.originalTitle).toEqual(newMovieTitle);
    });

    it('should update genre of the movie', async () => {
      const newMoviePayload = await getMoviePayload();
      newMoviePayload.genres = ['Drama', 'Thriller'];

      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      let [genresQueryResult] = await execQuery(`
        SELECT json_agg(id) AS ids 
        FROM genre 
        WHERE genre_name IN (${newMoviePayload.genres.map((g) => `'${g}'`)})
      `);

      const newMovieResponse = await server.post('/api/v1/movies').set('Cookie', cookie).send(newMoviePayload);
      const newMovieId = newMovieResponse.body.id;

      const [beforeUpdate] = await execQuery(`
        SELECT genre_ids AS "genreIds" FROM movie WHERE id = ${newMovieId}
      `);
      expect(beforeUpdate.genreIds).toEqual(genresQueryResult.ids);

      const newGenres = ['Action', 'Adventure', 'Science Fiction'];
      [genresQueryResult] = await execQuery(`
        SELECT json_agg(id) AS ids FROM genre WHERE genre_name IN (${newGenres.map((g) => `'${g}'`)})
      `);

      const response = await server.put(`/api/v1/movies/${newMovieId}`).set('Cookie', cookie).send({
        genres: newGenres,
      });

      expect(response.status).toEqual(204);

      const [afterUpdate] = await execQuery(`
        SELECT genre_ids AS "genreIds" FROM movie WHERE id = ${newMovieId}
      `);

      expect(afterUpdate.genreIds).toEqual(genresQueryResult.ids);
    });

    it('should update genre of the movie when data in payload is mixed casing', async () => {
      const newMoviePayload = await getMoviePayload();
      newMoviePayload.genres = ['drAMA', 'THRILler'];

      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      let [genresQueryResult] = await execQuery(`
        SELECT json_agg(id) AS ids 
        FROM genre 
        WHERE genre_name IN (${newMoviePayload.genres.map((g) => `INITCAP('${g}')`)})
      `);

      const newMovieResponse = await server.post('/api/v1/movies').set('Cookie', cookie).send(newMoviePayload);
      const newMovieId = newMovieResponse.body.id;

      const [beforeUpdate] = await execQuery(`
        SELECT genre_ids AS "genreIds" FROM movie WHERE id = ${newMovieId}
      `);
      expect(beforeUpdate.genreIds).toEqual(genresQueryResult.ids);

      const newGenres = ['actION', 'adVenTURE', 'science fictION'];
      [genresQueryResult] = await execQuery(`
        SELECT json_agg(id) AS ids 
        FROM genre 
        WHERE genre_name IN (${newGenres.map((g) => `INITCAP('${g}')`)})
      `);

      const response = await server.put(`/api/v1/movies/${newMovieId}`).set('Cookie', cookie).send({
        genres: newGenres,
      });

      expect(response.status).toEqual(204);

      const [afterUpdate] = await execQuery(`
        SELECT genre_ids AS "genreIds" FROM movie WHERE id = ${newMovieId}
      `);

      expect(afterUpdate.genreIds).toEqual(genresQueryResult.ids);
    });

    it('should update the country of origin of the movie', async () => {
      const newMoviePayload = await getMoviePayload();
      newMoviePayload.countriesOfOrigin = ['US'];

      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      let [countriesQueryResult] = await execQuery(`
        SELECT json_agg(id) AS ids 
        FROM country 
        WHERE iso_country_code IN (${newMoviePayload.countriesOfOrigin.map((c) => `UPPER('${c}')`)})
      `);

      const newMovieResponse = await server.post('/api/v1/movies').set('Cookie', cookie).send(newMoviePayload);
      const newMovieId = newMovieResponse.body.id;

      const [beforeUpdate] = await execQuery(`
        SELECT origin_country_ids AS "originCountryIds" FROM movie WHERE id = ${newMovieId}
      `);
      expect(beforeUpdate.originCountryIds).toEqual(countriesQueryResult.ids);
      const newOriginCountries = ['IN', 'AU'];
      [countriesQueryResult] = await execQuery(`
        SELECT json_agg(id) AS ids 
        FROM country 
        WHERE iso_country_code IN (${newOriginCountries.map((c) => `UPPER('${c}')`)})
      `);

      const response = await server.put(`/api/v1/movies/${newMovieId}`).set('Cookie', cookie).send({
        countriesOfOrigin: newOriginCountries,
      });

      expect(response.status).toEqual(204);

      const [afterUpdate] = await execQuery(`
        SELECT origin_country_ids AS "originCountryIds" FROM movie WHERE id = ${newMovieId}
      `);

      expect(afterUpdate.originCountryIds).toEqual(countriesQueryResult.ids);
    });

    it('should update the country of origin of the movie when data in payload are mixed casing', async () => {
      const newMoviePayload = await getMoviePayload();
      newMoviePayload.countriesOfOrigin = ['US'];

      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      let [countriesQueryResult] = await execQuery(`
        SELECT json_agg(id) AS ids 
        FROM country 
        WHERE iso_country_code IN (${newMoviePayload.countriesOfOrigin.map((c) => `UPPER('${c}')`)})
      `);

      const newMovieResponse = await server.post('/api/v1/movies').set('Cookie', cookie).send(newMoviePayload);
      const newMovieId = newMovieResponse.body.id;

      const [beforeUpdate] = await execQuery(`
        SELECT origin_country_ids AS "originCountryIds" FROM movie WHERE id = ${newMovieId}
      `);
      expect(beforeUpdate.originCountryIds).toEqual(countriesQueryResult.ids);
      const newOriginCountries = ['IN', 'au'];
      [countriesQueryResult] = await execQuery(`
        SELECT json_agg(id) AS ids 
        FROM country 
        WHERE iso_country_code IN (${newOriginCountries.map((c) => `UPPER('${c}')`)})
      `);

      const response = await server.put(`/api/v1/movies/${newMovieId}`).set('Cookie', cookie).send({
        countriesOfOrigin: newOriginCountries,
      });

      expect(response.status).toEqual(204);

      const [afterUpdate] = await execQuery(`
        SELECT origin_country_ids AS "originCountryIds" FROM movie WHERE id = ${newMovieId}
      `);

      expect(afterUpdate.originCountryIds).toEqual(countriesQueryResult.ids);
    });

    it('should update the movie language of the movie', async () => {
      const newMoviePayload = await getMoviePayload();
      newMoviePayload.genres = ['Drama', 'Thriller'];

      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      let [languageQueryResult] = await execQuery(`
        SELECT id 
        FROM movie_language 
        WHERE iso_language_code = LOWER('${newMoviePayload.language}')
      `);

      const newMovieResponse = await server.post('/api/v1/movies').set('Cookie', cookie).send(newMoviePayload);
      const newMovieId = newMovieResponse.body.id;

      const [beforeUpdate] = await execQuery(`
        SELECT language_id AS "languageId" FROM movie WHERE id = ${newMovieId}
      `);
      expect(beforeUpdate.languageId).toEqual(languageQueryResult.id);
      const newMovieLanguage = 'sd';
      [languageQueryResult] = await execQuery(`
        SELECT id 
        FROM movie_language 
        WHERE iso_language_code = LOWER('${newMovieLanguage}')
      `);

      const response = await server.put(`/api/v1/movies/${newMovieId}`).set('Cookie', cookie).send({
        language: newMovieLanguage,
      });

      expect(response.status).toEqual(204);

      const [afterUpdate] = await execQuery(`
        SELECT language_id AS "languageId" FROM movie WHERE id = ${newMovieId}
      `);

      expect(afterUpdate.languageId).toEqual(languageQueryResult.id);
    });

    it('should update the movie language of the movie when data in payload is upper case', async () => {
      const newMoviePayload = await getMoviePayload();
      newMoviePayload.genres = ['Drama', 'Thriller'];

      let [languageQueryResult] = await execQuery(`
        SELECT id 
        FROM movie_language 
        WHERE iso_language_code = LOWER('${newMoviePayload.language}')
      `);

      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const newMovieResponse = await server.post('/api/v1/movies').set('Cookie', cookie).send(newMoviePayload);
      expect(newMovieResponse.status).toEqual(201);
      const newMovieId = newMovieResponse.body.id;

      const [beforeUpdate] = await execQuery(`
        SELECT language_id AS "languageId" FROM movie WHERE id = ${newMovieId}
      `);
      expect(beforeUpdate.languageId).toEqual(languageQueryResult.id);
      const newMovieLanguage = 'SD';
      [languageQueryResult] = await execQuery(`
        SELECT id 
        FROM movie_language 
        WHERE iso_language_code = LOWER('${newMovieLanguage}')
      `);

      const response = await server.put(`/api/v1/movies/${newMovieId}`).set('Cookie', cookie).send({
        language: newMovieLanguage,
      });

      expect(response.status).toEqual(204);

      const [afterUpdate] = await execQuery(`
        SELECT language_id AS "languageId" FROM movie WHERE id = ${newMovieId}
      `);

      expect(afterUpdate.languageId).toEqual(languageQueryResult.id);
    });

    it('should not let staff to update the movie', async () => {
      const newMoviePayload = await getMoviePayload();

      let credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const newMovieResponse = await server.post('/api/v1/movies').set('Cookie', cookie).send(newMoviePayload);
      const newMovieId = newMovieResponse.body.id;

      credential = await getStaffCredential();
      await login(credential.email, credential.password);

      const response = await server
        .put(`/api/v1/movies/${newMovieId}`)
        .set('Cookie', cookie)
        .send({
          title: `${newMoviePayload.title} UPDATED`,
        });

      expect(response.status).toEqual(403);
      expect(response.body).toEqual({
        status: 'error',
        message: 'You are not authorized to perform this operation',
      });
    });

    it('should not let customer to update the movie', async () => {
      const newMoviePayload = await getMoviePayload();

      let credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const newMovieResponse = await server.post('/api/v1/movies').set('Cookie', cookie).send(newMoviePayload);
      const newMovieId = newMovieResponse.body.id;

      credential = await getCustomerCredential();
      await login(credential.email, credential.password);

      const response = await server
        .put(`/api/v1/movies/${newMovieId}`)
        .set('Cookie', cookie)
        .send({
          title: `${newMoviePayload.title} UPDATED`,
        });

      expect(response.status).toEqual(403);
      expect(response.body).toEqual({
        status: 'error',
        message: 'You are not authorized to perform this operation',
      });
    });
  });

  describe('DELETE /movies/:id', () => {
    const createTestActor = async (actorPayload: MovieActorPayload, movieId?: number) => {
      const newActorResponse = await server
        .post('/api/v1/actors')
        .set('Cookie', cookie)
        .send({
          ...actorPayload,
          characterName: undefined,
          castOrder: undefined,
        });
      expect(newActorResponse.status).toEqual(201);
      if (movieId) {
        const newMovieActorResponse = await server
          .post(`/api/v1/actors/${newActorResponse.body.id}/add_to_movie`)
          .set('Cookie', cookie)
          .send({ movieId, characterName: actorPayload.characterName, castOrder: actorPayload.castOrder });
        expect(newMovieActorResponse.status).toEqual(201);
      }

      const newActorId = newActorResponse.body.id;
      return newActorId;
    };

    it('should delete the movie', async () => {
      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const newMoviePayload = await getMoviePayload();
      const newMovieResponse = await server.post('/api/v1/movies').set('Cookie', cookie).send(newMoviePayload);
      const newMovieId = newMovieResponse.body.id;

      let [movieQueryResult] = await execQuery(`
        SELECT COUNT(*) FROM movie WHERE id = ${newMovieId}  
      `);
      expect(Number(movieQueryResult.count)).toEqual(1);

      const response = await server.delete(`/api/v1/movies/${newMovieId}`).set('Cookie', cookie);
      expect(response.status).toEqual(204);

      [movieQueryResult] = await execQuery(`
        SELECT COUNT(*) FROM movie WHERE id = ${newMovieId}  
      `);
      expect(Number(movieQueryResult.count)).toEqual(0);
    });

    it('should delete the movie and movie actors', async () => {
      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const newMoviePayload = await getMoviePayload();
      const newActors = await getRandomActors(5);
      const newMovieResponse = await server.post('/api/v1/movies').set('Cookie', cookie).send(newMoviePayload);
      const newMovieId = newMovieResponse.body.id;

      // Verify new movie count
      let [movieQueryResult] = await execQuery(`
        SELECT COUNT(*) FROM movie WHERE id = ${newMovieId}  
      `);
      expect(Number(movieQueryResult.count)).toEqual(1);

      const newActorIds = [];
      for (const a of newActors) {
        const newActorId = await createTestActor(a, newMovieId);
        newActorIds.push(newActorId);
      }

      // Verify new actors count before delete
      let [actorsQueryResult] = await execQuery(`
        SELECT COUNT(*) FROM actor WHERE id IN (${newActorIds.join(',')})  
      `);
      expect(Number(actorsQueryResult.count)).toEqual(newActorIds.length);

      // Verify new movie cast count before delete
      let [movieActorsQueryResult] = await execQuery(`
        SELECT COUNT(*) FROM movie_actor WHERE movie_id = ${newMovieId}
      `);
      expect(Number(movieActorsQueryResult.count)).toEqual(newActorIds.length);

      // Delete movie
      await server.delete(`/api/v1/movies/${newMovieId}`).set('Cookie', cookie);
      [movieQueryResult] = await execQuery(`
        SELECT COUNT(*) FROM movie WHERE id = ${newMovieId}  
      `);
      expect(Number(movieQueryResult.count)).toEqual(0);

      // Verify actors count after delete
      [actorsQueryResult] = await execQuery(`
        SELECT COUNT(*) FROM actor WHERE id IN (${newActorIds.join(',')})  
      `);
      expect(Number(actorsQueryResult.count)).toEqual(newActorIds.length);

      // Verify movie cast count after delete
      [movieActorsQueryResult] = await execQuery(`
        SELECT COUNT(*) FROM movie_actor WHERE movie_id = ${newMovieId}
      `);
      expect(Number(movieActorsQueryResult.count)).toEqual(0);
    });

    it('should delete the movie, movie actors and the inventory records', async () => {
      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const newMoviePayload = await getMoviePayload();
      const newActors = await getRandomActors(5);
      const newMovieResponse = await server.post('/api/v1/movies').set('Cookie', cookie).send(newMoviePayload);
      const newMovieId = newMovieResponse.body.id;

      // Verify new movie count
      let [movieQueryResult] = await execQuery(`
        SELECT COUNT(*) FROM movie WHERE id = ${newMovieId}  
      `);
      expect(Number(movieQueryResult.count)).toEqual(1);

      const newActorIds = [];
      for (const a of newActors) {
        const newActorId = await createTestActor(a, newMovieId);
        newActorIds.push(newActorId);
      }

      // Verify new actors count before delete
      let [actorsQueryResult] = await execQuery(`
        SELECT COUNT(*) FROM actor WHERE id IN (${newActorIds.join(',')})  
      `);
      expect(Number(actorsQueryResult.count)).toEqual(newActorIds.length);

      // Verify new movie cast count before delete
      let [movieActorsQueryResult] = await execQuery(`
        SELECT COUNT(*) FROM movie_actor WHERE movie_id = ${newMovieId}
      `);
      expect(Number(movieActorsQueryResult.count)).toEqual(newActorIds.length);

      // Insert inventory rows
      await execQuery(`
        INSERT INTO inventory (movie_id, store_id, stock_count) VALUES (${newMovieId}, 1, 10)
      `);

      // Verify inventory count before delete
      let [inventoryQueryResult] = await execQuery(`
        SELECT COUNT(*) FROM inventory WHERE movie_id = ${newMovieId}
      `);
      expect(Number(inventoryQueryResult.count)).toEqual(1);

      // Delete movie
      await server.delete(`/api/v1/movies/${newMovieId}`).set('Cookie', cookie);
      [movieQueryResult] = await execQuery(`
        SELECT COUNT(*) FROM movie WHERE id = ${newMovieId}  
      `);
      expect(Number(movieQueryResult.count)).toEqual(0);

      // Verify actors count after delete
      [actorsQueryResult] = await execQuery(`
        SELECT COUNT(*) FROM actor WHERE id IN (${newActorIds.join(',')})  
      `);
      expect(Number(actorsQueryResult.count)).toEqual(newActorIds.length);

      // Verify movie cast count after delete
      [movieActorsQueryResult] = await execQuery(`
        SELECT COUNT(*) FROM movie_actor WHERE movie_id = ${newMovieId}
      `);
      expect(Number(movieActorsQueryResult.count)).toEqual(0);

      // Verify inventory count after delete
      [inventoryQueryResult] = await execQuery(`
        SELECT COUNT(*) FROM inventory WHERE movie_id = ${newMovieId}
      `);
      expect(Number(inventoryQueryResult.count)).toEqual(0);
    });

    it('should not let staff to delete the movie', async () => {
      let credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const newMoviePayload = await getMoviePayload();
      const newMovieResponse = await server.post('/api/v1/movies').set('Cookie', cookie).send(newMoviePayload);
      const newMovieId = newMovieResponse.body.id;

      credential = await getStaffCredential();
      await login(credential.email, credential.password);
      const response = await server.delete(`/api/v1/movies/${newMovieId}`).set('Cookie', cookie);
      expect(response.status).toEqual(403);
      expect(response.body).toEqual({
        status: 'error',
        message: 'You are not authorized to perform this operation',
      });
    });

    it('should not let customer to delete the movie', async () => {
      let credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const newMoviePayload = await getMoviePayload();
      const newMovieResponse = await server.post('/api/v1/movies').set('Cookie', cookie).send(newMoviePayload);
      const newMovieId = newMovieResponse.body.id;

      credential = await getCustomerCredential();
      await login(credential.email, credential.password);
      const response = await server.delete(`/api/v1/movies/${newMovieId}`).set('Cookie', cookie);
      expect(response.status).toEqual(403);
      expect(response.body).toEqual({
        status: 'error',
        message: 'You are not authorized to perform this operation',
      });
    });
  });
});
