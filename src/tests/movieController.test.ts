import supertest from 'supertest';

import app from '../app';
import * as MovieModel from '../models/movieModel';
import * as dbQuery from '../utils/dbQuery';
import { ITEMS_COUNT_PER_PAGE_FOR_TEST, execQuery, getRowsCount, FIELD_MAP } from './testUtil';

const apiKey = process.env.API_KEY || '';

describe('Movie Controller', () => {
  jest.setTimeout(20000);
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET movies', () => {
    it('GET /api/v1/movies should return movies page by page', async () => {
      const startingPage = 1;
      const server = supertest(app);
      const totalRows = await getRowsCount('v_movie');

      const iterations = 3;

      for (let i = startingPage; i < iterations + startingPage; i++) {
        const response = await server.get(`/api/v1/movies?pageNumber=${i}`).set({
          'api-key': apiKey,
        });
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        const expectedMovies = await execQuery(
          `SELECT * FROM v_movie ORDER BY id ASC LIMIT 50 OFFSET ${
            (i - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST
          }`,
          FIELD_MAP.movie
        );

        expect(response.body.length).toBe(expectedMovies.length);

        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: 50,
          totalItems: Number(totalRows),
          totalPages: Math.ceil(totalRows / 50),
        });
        expect(response.headers['rf-page-number']).toBe(`${i}`);
      }
    });

    it('GET /api/v1/movies should return for the correct page when jumping between pages', async () => {
      const pages = [3, 7, 4];
      const totalRows = await getRowsCount('v_movie');

      const server = supertest(app);

      for (const page of pages) {
        const response = await server.get(`/api/v1/movies?pageNumber=${page}`).set({
          'api-key': apiKey,
        });
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        const expectedMovies = await execQuery(
          `
            SELECT * FROM v_movie 
            ORDER BY id ASC 
            LIMIT ${ITEMS_COUNT_PER_PAGE_FOR_TEST} 
            OFFSET ${(page - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST}
          `,
          FIELD_MAP.movie
        );

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
      const server = supertest(app);

      const totalRows = await getRowsCount(
        'v_movie',
        "release_date BETWEEN '2020-01-01' AND '2020-12-31'"
      );

      const iterations = 3;

      for (let i = startingPage; i < iterations + startingPage; i++) {
        const url =
          i > 1
            ? `/api/v1/movies?releaseYear=2020&pageNumber=${i}`
            : '/api/v1/movies?releaseYear=2020';

        const response = await server.get(url).set('api-key', apiKey);
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        const expectedMovies = await execQuery(
          `
            SELECT * FROM v_movie 
            WHERE release_date BETWEEN '2020-01-01' AND '2020-12-31' 
            ORDER BY release_date, id ASC 
            LIMIT ${ITEMS_COUNT_PER_PAGE_FOR_TEST} OFFSET ${(i - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST}
          `,
          FIELD_MAP.movie
        );

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
      const totalRows = await getRowsCount(
        'v_movie',
        "release_date BETWEEN '2020-01-01' AND '2020-12-31'"
      );

      const server = supertest(app);

      for (const page of pages) {
        const response = await server
          .get(`/api/v1/movies?releaseYear=2020&pageNumber=${page}`)
          .set('api-key', apiKey);
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        const expectedMovies = await execQuery(
          `
            SELECT * FROM v_movie
            WHERE release_date BETWEEN '2020-01-01' AND '2020-12-31'
            ORDER BY release_date, id ASC
            LIMIT 50 OFFSET ${(page - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST}
          `,
          FIELD_MAP.movie
        );

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

      const server = supertest(app);
      const totalRows = await getRowsCount(
        'v_movie',
        `release_date BETWEEN '2020-01-01' AND '2020-12-31' AND genres @> '{Action,Adventure}'`
      );

      const iterations = 3;

      for (let i = startingPage; i < iterations + startingPage; i++) {
        const url =
          i > 1
            ? `/api/v1/movies?releaseYear=2020&genres=action,adventure&pageNumber=${i}`
            : '/api/v1/movies?releaseYear=2020&genres=action,adventure';

        const response = await server.get(url).set({
          'api-key': apiKey,
        });

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        const expectedMovies = await execQuery(
          `
            SELECT * FROM v_movie 
            WHERE release_date BETWEEN '2020-01-01' AND '2020-12-31' AND genres @> '{Action,Adventure}'
            ORDER BY release_date, id ASC
            LIMIT ${ITEMS_COUNT_PER_PAGE_FOR_TEST}
            OFFSET ${(i - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST}
          `,
          FIELD_MAP.movie
        );

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

      const server = supertest(app);
      const totalRows = await getRowsCount('v_movie', `genres @> '{Action,Adventure,Thriller}'`);

      const iterations = 3;

      for (let i = startingPage; i < iterations + startingPage; i++) {
        const url =
          i > 1
            ? `/api/v1/movies?genres=action,adventure,thriller&pageNumber=${i}`
            : '/api/v1/movies?genres=action,adventure,thriller';

        const response = await server.get(url).set({
          'api-key': apiKey,
        });
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        const expectedMovies = await execQuery(
          `
            SELECT * FROM v_movie 
            WHERE genres @> '{Action,Adventure,Thriller}'
            ORDER BY id ASC
            LIMIT ${ITEMS_COUNT_PER_PAGE_FOR_TEST}
            OFFSET ${(i - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST}
          `,
          FIELD_MAP.movie
        );

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

      const server = supertest(app);
      const totalRows = await getRowsCount('v_movie', `genres @> '{Action,Adventure,Thriller}'`);

      const pages = [3, 7, 4];

      for (const page of pages) {
        const url =
          page > 1
            ? `/api/v1/movies?genres=action,adventure,thriller&pageNumber=${page}`
            : '/api/v1/movies?genres=action,adventure,thriller';

        const response = await server.get(url).set({
          'api-key': apiKey,
        });

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        const expectedMovies = await execQuery(
          `
            WITH movies_with_row_number AS (
              SELECT ROW_NUMBER() OVER (ORDER BY id ASC) AS "rowNumber", * FROM v_movie 
              WHERE genres @> '{Action,Adventure,Thriller}'
            )
            SELECT * FROM movies_with_row_number 
            ORDER BY "rowNumber" ASC
            LIMIT ${ITEMS_COUNT_PER_PAGE_FOR_TEST}
            OFFSET ${(page - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST}
          `,
          FIELD_MAP.movie
        );
        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: ITEMS_COUNT_PER_PAGE_FOR_TEST,
          totalItems: Number(totalRows),
          totalPages: Math.ceil(totalRows / ITEMS_COUNT_PER_PAGE_FOR_TEST),
        });
      }
    });

    it('GET /api/v1/movies should return 404 when there are no more pages available', async () => {
      const server = supertest(app);
      const rowsCount = await getRowsCount('v_movie');
      let response = await server.get('/api/v1/movies').set('api-key', apiKey);
      const totalPages = Number(response.body.totalPages);
      response = await server.get(`/api/v1/movies?pageNumber=${totalPages + 1}`).set({
        'api-key': apiKey,
        'rf-last-visited-page': String(totalPages),
        'rf-last-id-last-visited-page': String(rowsCount),
      });
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Page out of range');
    });

    it('GET /api/v1/movies should return 500 on exception', async () => {
      jest
        .spyOn(dbQuery, 'executeQuery')
        .mockRejectedValue({ message: 'unit testing exception for /api/v1/movies' });
      const server = supertest(app);
      const response = await server.get('/api/v1/movies?pageNumber=1').set('api-key', apiKey);
      expect(response.status).toBe(500);
      expect(response.body.message).toEqual('unit testing exception for /api/v1/movies');
    });

    it('GET /api/v1/movies?releaseDates=... should return movies between the release dates with pagination', async () => {
      const startingPage = 1;
      const server = supertest(app);
      const totalRows = await getRowsCount(
        'v_movie',
        "release_date BETWEEN '2024-03-01' AND '2024-03-04'"
      );

      const iterations = 3;

      for (let i = startingPage; i < iterations + startingPage; i++) {
        const response = await server
          .get(`/api/v1/movies?releaseFrom=2024-03-01&releaseTo=2024-03-04&pageNumber=${i}`)
          .set('api-key', apiKey);
        const expectedMovies = await execQuery(
          `
            SELECT * FROM v_movie
            WHERE release_date BETWEEN '2024-03-01' AND '2024-03-04'
            ORDER BY release_date, id ASC
            LIMIT ${ITEMS_COUNT_PER_PAGE_FOR_TEST}
            OFFSET ${(i - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST}
          `,
          FIELD_MAP.movie
        );

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
      const server = supertest(app);
      const totalRows = await getRowsCount(
        'v_movie',
        "release_date BETWEEN '2024-03-01' AND '2024-03-04'"
      );

      const pages = [2, 5, 3];

      for (const page of pages) {
        const response = await server
          .get(`/api/v1/movies?releaseFrom=2024-03-01&releaseTo=2024-03-04&pageNumber=${page}`)
          .set('api-key', apiKey);
        const expectedMovies = await execQuery(
          `SELECT * FROM v_movie WHERE release_date BETWEEN '2024-03-01' AND '2024-03-04' ORDER BY release_date, id ASC LIMIT ${ITEMS_COUNT_PER_PAGE_FOR_TEST} OFFSET ${
            (page - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST
          }`,
          FIELD_MAP.movie
        );
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

      const server = supertest(app);
      const totalRows = await getRowsCount(
        'v_movie',
        `genres @> '{Action,Adventure}' AND release_date BETWEEN '2024-03-01' AND '2024-10-31'`
      );

      const iterations = 3;

      for (let i = startingPage; i < iterations + startingPage; i++) {
        const url =
          i > 1
            ? `/api/v1/movies?releaseFrom=2024-03-01&releaseTo=2024-10-31&genres=action,adventure&pageNumber=${i}`
            : '/api/v1/movies?releaseFrom=2024-03-01&releaseTo=2024-10-31&genres=action,adventure';

        const response = await server.get(url).set({
          'api-key': apiKey,
        });
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        const expectedMovies = await execQuery(
          `
            SELECT * FROM v_movie 
            WHERE genres @> '{Action,Adventure}' AND release_date BETWEEN '2024-03-01' AND '2024-10-31'
            ORDER BY release_date, id ASC
            LIMIT ${ITEMS_COUNT_PER_PAGE_FOR_TEST}
            OFFSET ${(i - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST}
          `,
          FIELD_MAP.movie
        );

        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: expectedMovies.length,
          totalItems: Number(totalRows),
          totalPages: Math.ceil(totalRows / ITEMS_COUNT_PER_PAGE_FOR_TEST),
        });
      }
    });

    it('GET /api/v1/movies?genres=... should return correct list when jumping between pages', async () => {
      const server = supertest(app);
      const totalRows = await getRowsCount('v_movie', `genres @> '{Action,Adventure}'`);

      const pages = [3, 7, 4];

      for (const page of pages) {
        const url =
          page > 1
            ? `/api/v1/movies?genres=action,adventure&pageNumber=${page}`
            : '/api/v1/movies?genres=action,adventure';

        const response = await server.get(url).set({
          'api-key': apiKey,
        });

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        const expectedMovies = await execQuery(
          `
            WITH movies_with_row_number AS (
              SELECT ROW_NUMBER() OVER (ORDER BY id ASC) AS "rowNumber", * FROM v_movie 
              WHERE genres @> '{Action,Adventure}'
            )
            SELECT * FROM movies_with_row_number 
            ORDER BY "rowNumber" ASC
            LIMIT ${ITEMS_COUNT_PER_PAGE_FOR_TEST}
            OFFSET ${(page - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST}
          `,
          FIELD_MAP.movie
        );
        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: ITEMS_COUNT_PER_PAGE_FOR_TEST,
          totalItems: Number(totalRows),
          totalPages: Math.ceil(totalRows / ITEMS_COUNT_PER_PAGE_FOR_TEST),
        });
      }
    });
  });

  describe('GET /movies returning status code 400', () => {
    it('GET /api/v1/movies should return 400 for invalid pageNumber', async () => {
      const pageNumber = 'x';
      const server = supertest(app);
      const response = await server
        .get(`/api/v1/movies?pageNumber=${pageNumber}`)
        .set('api-key', apiKey);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Page number should be a valid non-zero positive number');
    });

    it('GET /api/v1/movies should return 400 when pageNumber is 0', async () => {
      const pageNumber = 0;
      const server = supertest(app);
      const response = await server
        .get(`/api/v1/movies?pageNumber=${pageNumber}`)
        .set('api-key', apiKey);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Page number should be a valid non-zero positive number');
    });

    it('GET /movies should return 400 when releaseYear in query is invalid', async () => {
      const releaseYear = 49829;
      const server = supertest(app);
      const response = await server
        .get(`/api/v1/movies?releaseYear=${releaseYear}`)
        .set('api-key', apiKey);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Release year must be between 1970 and 2050');
    });

    it('GET /movies should return 400 when genres in query is invalid', async () => {
      const invalidGenres = 'action,drama,invalid_genre';
      const server = supertest(app);
      const response = await server
        .get(`/api/v1/movies?genres=${invalidGenres}`)
        .set('api-key', apiKey);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('[invalid_genre] are invalid genres');
    });

    it('GET /movies should return 400 when releaseFrom is in query but releaseTo is missing', async () => {
      const server = supertest(app);
      const response = await server
        .get(`/api/v1/movies?releaseFrom=2024-05-01`)
        .set('api-key', apiKey);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        'To filter by release dates, release date from and to are required.'
      );
    });

    it('GET /movies should return 400 when releaseTo is in query but releaseFrom is missing', async () => {
      const server = supertest(app);
      const response = await server
        .get(`/api/v1/movies?releaseTo=2024-05-01`)
        .set('api-key', apiKey);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        'To filter by release dates, release date from and to are required.'
      );
    });

    it('GET /movies should return 400 when releaseYear and release dates both are in query', async () => {
      const server = supertest(app);
      const response = await server
        .get(`/api/v1/movies?releaseYear=2024&releaseFrom=2024-04-01&releaseTo=2024-05-01`)
        .set('api-key', apiKey);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Release year and release dates cannot be used together');
    });

    it('GET /movies should return 400 when releaseFrom has invalid format in query', async () => {
      const server = supertest(app);
      const response = await server
        .get(`/api/v1/movies?releaseFrom=2024-04-xx&releaseTo=2024-05-01`)
        .set('api-key', apiKey);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        'Invalid release date. Please refer to api specs for more information.'
      );
    });

    it('GET /movies should return 400 when releaseTo has invalid format in query', async () => {
      const server = supertest(app);
      const response = await server
        .get(`/api/v1/movies?releaseFrom=2024-04-01&releaseTo=2024-xx-01`)
        .set('api-key', apiKey);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        'Invalid release date. Please refer to api specs for more information.'
      );
    });
  });
});
