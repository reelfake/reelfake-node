import supertest from 'supertest';

import app from '../app';
import * as dbQuery from '../utils/dbQuery';
import {
  ITEMS_COUNT_PER_PAGE_FOR_TEST,
  execQuery,
  getRowsCount,
  queryMovieObject,
  FIELD_MAP,
} from './testUtil';

const apiKey = process.env.API_KEY || '';

describe('Actor Controller', () => {
  jest.setTimeout(20000);
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /actors', () => {
    it('GET /api/v1/actors should return actors page by page', async () => {
      const startingPage = 1;
      const server = supertest(app);
      const totalRows = await getRowsCount('actor');

      const iterations = 3;

      for (let i = startingPage; i < iterations + startingPage; i++) {
        const response = await server.get(`/api/v1/actors?pageNumber=${i}`).set({
          'api-key': apiKey,
        });
        const expectedActors = await execQuery(
          `
            SELECT * FROM actor 
            ORDER BY id ASC 
            LIMIT ${ITEMS_COUNT_PER_PAGE_FOR_TEST} 
            OFFSET ${(i - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST}
          `,
          FIELD_MAP.actor
        );

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        expect(response.body).toStrictEqual({
          items: expectedActors,
          length: expectedActors.length,
          totalPages: Math.ceil(totalRows / ITEMS_COUNT_PER_PAGE_FOR_TEST),
          totalItems: Number(totalRows),
        });
      }
    });

    it('GET /api/v1/actors should return correct actor list when jumping between pages', async () => {
      const server = supertest(app);
      const totalRows = await getRowsCount('actor');

      const pages = [2, 5, 3];

      for (const page of pages) {
        const response = await server.get(`/api/v1/actors?pageNumber=${page}`).set({
          'api-key': apiKey,
        });
        const expectedActors = await execQuery(
          `
              SELECT * FROM actor 
              ORDER BY id ASC 
              LIMIT ${ITEMS_COUNT_PER_PAGE_FOR_TEST} 
              OFFSET ${(page - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST}
            `,
          FIELD_MAP.actor
        );

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        expect(response.body).toStrictEqual({
          items: expectedActors,
          length: expectedActors.length,
          totalPages: Math.ceil(totalRows / ITEMS_COUNT_PER_PAGE_FOR_TEST),
          totalItems: Number(totalRows),
        });
      }
    });
  });

  describe('GET /actors returning 4xx', () => {
    it('GET /api/v1/actors should return 401 if api key is missing in header', async () => {
      const server = supertest(app);

      const response = await server.get(`/api/v1/actors?pageNumber=a`);

      expect(response.status).toBe(401);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.body.message).toBe('Invalid or missing api key');
    });

    it('GET /api/v1/actors should return 400 when page number is 0', async () => {
      const server = supertest(app);

      const response = await server.get(`/api/v1/actors?pageNumber=0`).set({
        'api-key': apiKey,
      });

      expect(response.status).toBe(400);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.body.message).toBe('Page number should be a valid non-zero positive number');
    });

    it('GET /api/v1/actors should return 400 when page number is not a number', async () => {
      const server = supertest(app);

      const response = await server.get(`/api/v1/actors?pageNumber=a`).set({
        'api-key': apiKey,
      });

      expect(response.status).toBe(400);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.body.message).toBe('Page number should be a valid non-zero positive number');
    });
  });
});
