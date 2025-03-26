import supertest from 'supertest';

import app from '../app';
import { ITEMS_COUNT_PER_PAGE_FOR_TEST, execQuery, getRowsCount, FIELD_MAP } from './testUtil';

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
        const response = await server.get(`/api/v1/actors?pageNumber=${i}`);
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
        const response = await server.get(`/api/v1/actors?pageNumber=${page}`);
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

  describe('GET /actors/:id', () => {
    it('GET /api/v1/actors/:id should return actor without the movies', async () => {
      const server = supertest(app);

      const response = await server.get(`/api/v1/actors/928365`);
      const expectedActor = await execQuery(
        `
          SELECT * FROM actor WHERE id = 928365
        `,
        FIELD_MAP.actor
      );

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.body).toStrictEqual(expectedActor[0]);
    });

    it('GET /api/v1/actors/:id?includeMovies=true should return actor with the movies', async () => {
      const server = supertest(app);
      const actorId = 928365;

      const response = await server.get(`/api/v1/actors/${actorId}?includeMovies=true`);
      const expectedActor = await execQuery(
        `
          SELECT id, imdb_id as "imdbId", actor_name as "actorName", biography, birthday, deathday, place_of_birth as "placeOfBirth",
          popularity, profile_picture_url as "profilePictureUrl" FROM actor WHERE id = ${actorId}

        `,
        FIELD_MAP.actor
      );
      const expectedMovies = await execQuery(
        `
        SELECT m.id, m.title, m.release_date as "releaseDate", m.genres, m.rating_average as "ratingAverage", m.rating_count as "ratingCount" 
        FROM v_movie m LEFT JOIN movie_actor ma ON m.id = ma.movie_id WHERE ma.actor_id = ${actorId} ORDER BY id ASC
      `,
        FIELD_MAP.movie
      );

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.body).toStrictEqual({ ...expectedActor[0], movies: [...expectedMovies] });
    });
  });

  describe('GET /actors returning 4xx', () => {
    it('GET /api/v1/actors should return 400 when page number is 0', async () => {
      const server = supertest(app);

      const response = await server.get(`/api/v1/actors?pageNumber=0`);

      expect(response.status).toBe(400);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.body.message).toBe('Page number should be a valid non-zero positive number');
    });

    it('GET /api/v1/actors should return 400 when page number is not a number', async () => {
      const server = supertest(app);

      const response = await server.get(`/api/v1/actors?pageNumber=a`);

      expect(response.status).toBe(400);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.body.message).toBe('Page number should be a valid non-zero positive number');
    });
  });

  describe('GET /actors/search', () => {
    it('GET /actors/search?q=... should return list of actors with name containing the given chars', async () => {
      const server = supertest(app);

      const totalRows = await getRowsCount('actor', "actor_name LIKE '%john%'");

      const pages = [1, 2, 7, 8, 3];

      for (const page of pages) {
        const url =
          page > 1
            ? `/api/v1/actors/search?q=john&pageNumber=${page}`
            : `/api/v1/actors/search?q=john`;

        const response = await server.get(url);
        const expectedActors = await execQuery(
          `
          SELECT * FROM actor 
          WHERE actor_name like '%john%'
          ORDER BY actor_name ASC
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
          totalItems: totalRows,
          totalPages: Math.ceil(totalRows / ITEMS_COUNT_PER_PAGE_FOR_TEST),
        });
      }
    });

    it('GET /actors/search?name=... should return list of actors with the given name', async () => {
      const server = supertest(app);
      const totalRows = await getRowsCount('actor', "actor_name = 'steve smith'");
      const response = await server.get('/api/v1/actors/search?name=steve smith');
      const expectedActors = await execQuery(
        `
          SELECT * FROM actor 
          WHERE actor_name = 'steve smith'
          ORDER BY actor_name ASC 
        `,
        FIELD_MAP.actor
      );

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.body).toStrictEqual({
        items: expectedActors,
        length: expectedActors.length,
        totalItems: totalRows,
        totalPages: Math.ceil(totalRows / ITEMS_COUNT_PER_PAGE_FOR_TEST),
      });
    });
  });

  describe('GET /actors/search returning 4xx', () => {
    it('GET /actors/search should return 400 when missing the string to search', async () => {
      const server = supertest(app);

      const response = await server.get(`/api/v1/actors/search?q=   `);
      expect(response.status).toBe(400);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.body.message).toBe('Request is missing the search parameter');
    });

    it('GET /actors/search?q=... should return 404 when no actors found with the given search string', async () => {
      const server = supertest(app);

      const response = await server.get(`/api/v1/actors/search?q=blahblahblah`);
      expect(response.status).toBe(404);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.body.message).toBe('Resources not found');
    });
  });
});
