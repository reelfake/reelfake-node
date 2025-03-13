import supertest from 'supertest';

import app from '../app';
import * as MovieModel from '../models/movieModel';
import * as dbQuery from '../utils/movieQueries';
import { ITEMS_COUNT_PER_PAGE_FOR_TEST, execQuery, getRowsCount, FIELD_MAP } from './testUtil';

const apiKey = process.env.API_KEY || '';

describe('Movie Controller', () => {
  describe('Movies pagination', () => {
    it('GET /api/movies?pageNumber=2 should return movies for second page', async () => {
      const startingPage = 2;
      const server = supertest(app);
      const totalRows = await getRowsCount('v_movie');

      const iterations = 3;

      for (let i = startingPage; i < iterations + startingPage; i++) {
        const response = await server.get(`/api/movies?pageNumber=${i}`).set('api-key', apiKey);
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

    it('GET /api/movies should default page number to 1 and return movies for first page', async () => {
      const server = supertest(app);
      const totalRows = await getRowsCount('v_movie');

      const startingPage = 1;
      const iterations = 3;

      for (let i = startingPage; i < iterations + startingPage; i++) {
        const url = i > 1 ? `/api/movies?pageNumber=${i}` : '/api/movies';
        const response = await server.get(url).set('api-key', apiKey);
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        const expectedMovies = await execQuery(
          `SELECT * FROM v_movie ORDER BY id ASC LIMIT 50 OFFSET ${
            (i - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST
          }`,
          FIELD_MAP.movie
        );

        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: 50,
          totalItems: Number(totalRows),
          totalPages: Math.ceil(totalRows / 50),
        });
        expect(response.headers['rf-page-number']).toBe(`${i}`);
      }
    });

    it('GET /api/movies should return for the correct page when jumping between pages', async () => {
      const pages = [1, 5, 3, 7, 4];
      const totalRows = await getRowsCount('v_movie');

      const server = supertest(app);

      for (const page of pages) {
        const response = await server.get(`/api/movies?pageNumber=${page}`).set('api-key', apiKey);
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        const expectedMovies = await execQuery(
          `SELECT * FROM v_movie ORDER BY id ASC LIMIT 50 OFFSET ${
            (page - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST
          }`,
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

    it('GET /api/movies?pageNumber=x should return 400 for invalid page_number', async () => {
      const pageNumber = 'x';
      const server = supertest(app);
      const response = await server
        .get(`/api/movies?pageNumber=${pageNumber}`)
        .set('api-key', apiKey);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Page number should be a valid non-zero positive number');
    });

    it('GET /api/movies?pageNumber=0 should return 400 for pageNumber being 0', async () => {
      const pageNumber = 0;
      const server = supertest(app);
      const response = await server
        .get(`/api/movies?pageNumber=${pageNumber}`)
        .set('api-key', apiKey);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Page number should be a valid non-zero positive number');
    });

    it('GET /api/movies?pageNumber=999999 should return 404 as it exceeded the available number of pages', async () => {
      const pageNumber = 999999;
      const server = supertest(app);
      const response = await server
        .get(`/api/movies?pageNumber=${pageNumber}`)
        .set('api-key', apiKey);
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Page out of range');
    });

    it('GET /api/movies should return 500 on exception', async () => {
      jest
        .spyOn(dbQuery, 'queryMoviesPage')
        .mockRejectedValue({ message: 'unit testing exception for /api/movies' });
      const server = supertest(app);
      const response = await server.get('/api/movies?page_number=1').set('api-key', apiKey);
      expect(response.status).toBe(500);
      expect(response.body.message).toEqual('unit testing exception for /api/movies');
    });
  });

  describe('Movies by release date pagination', () => {
    it('GET /api/movies/2020?pageNumber=0 should return 400 as page number must be greater 0', async () => {
      const pageNumber = 0;
      const server = supertest(app);
      const response = await server
        .get(`/api/movies/2020?pageNumber=${pageNumber}`)
        .set('api-key', apiKey);
      expect(response.status).toBe(400);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.body.message).toBe('Page number should be a valid non-zero positive number');
    });

    it('GET /api/movies/2020 should return movies release in 2020 with pagination support', async () => {
      const startingPage = 1;
      const server = supertest(app);

      const totalRows = await getRowsCount(
        'v_movie',
        "release_date BETWEEN '2020-01-01' AND '2020-12-31'"
      );

      const iterations = 3;

      for (let i = startingPage; i < iterations + startingPage; i++) {
        const url = i > 1 ? `/api/movies/2020?pageNumber=${i}` : '/api/movies/2020';

        const response = await server.get(url).set('api-key', apiKey);
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        const expectedMovies = await execQuery(
          `
            SELECT * FROM v_movie 
            WHERE release_date BETWEEN '2020-01-01' AND '2020-12-31' 
            ORDER BY release_date, id ASC 
            LIMIT 50 OFFSET ${(i - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST}
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

    it('GET /api/movies/2020?pageNumber=2 should return second page', async () => {
      const startingPage = 2;
      const server = supertest(app);

      const iterations = 3;
      const totalRows = await getRowsCount(
        'v_movie',
        "release_date BETWEEN '2020-01-01' AND '2020-12-31'"
      );

      for (let i = startingPage; i < iterations + startingPage; i++) {
        const response = await server
          .get(`/api/movies/2020?pageNumber=${i}`)
          .set('api-key', apiKey);
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        const expectedMovies = await execQuery(
          `
            SELECT * FROM v_movie
            WHERE release_date BETWEEN '2020-01-01' AND '2020-12-31'
            ORDER BY release_date, id ASC
            LIMIT 50 OFFSET ${(i - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST}
          `,
          FIELD_MAP.movie
        );

        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: 50,
          totalItems: Number(totalRows),
          totalPages: Math.ceil(totalRows / 50),
        });
        expect(response.get('rf-page-number')).toBe(`${i}`);
      }
    });

    it('GET /api/movies/2020 should return for the correct page when jumping between pages', async () => {
      const pages = [1, 5, 3, 7, 4];
      const totalRows = await getRowsCount(
        'v_movie',
        "release_date BETWEEN '2020-01-01' AND '2020-12-31'"
      );

      const server = supertest(app);

      for (const page of pages) {
        const response = await server
          .get(`/api/movies/2020?pageNumber=${page}`)
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

    it('GET /api/movies/2020?pageNumber=x should return 400 for invalid page_number', async () => {
      const pageNumber = 'x';
      const server = supertest(app);
      const response = await server
        .get(`/api/movies/2020?pageNumber=${pageNumber}`)
        .set('api-key', apiKey);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Page number should be a valid non-zero positive number');
    });

    it('GET /api/movies/2020?pageNumber=0 should return 400 for pageNumber being 0', async () => {
      const pageNumber = 0;
      const server = supertest(app);
      const response = await server
        .get(`/api/movies/2020?pageNumber=${pageNumber}`)
        .set('api-key', apiKey);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Page number should be a valid non-zero positive number');
    });

    it('GET /api/movies/2020 should return 500 if the sequelize instance is not present in the Movie model', async () => {
      jest.spyOn(MovieModel, 'default').mockReturnValue({ sequelize: undefined } as any);

      const server = supertest(app);
      const response = await server.get(`/api/movies/2020`).set('api-key', apiKey);
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Server encoutered unhandled exception');
    });
  });
});
