import supertest from 'supertest';

import app from '../app';
import { ITEMS_COUNT_PER_PAGE_FOR_TEST, execQuery, getRowsCount, FIELD_MAP } from './testUtil';

const apiKey = process.env.API_KEY || '';

describe('Store Controller', () => {
  jest.setTimeout(20000);
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /stores', () => {
    it('GET /stores should all the stores', async () => {
      const server = supertest(app);

      const response = await server.get('/api/v1/stores').set('api-key', apiKey);
      const expectedStores = await execQuery(
        `
          SELECT s.id AS "id", a.address_line AS "addressLine", c.city_name AS "city", c.state_name AS "state", a.postal_code AS "postalCode", cy.country_name AS "country", s.phone_number AS "phoneNumber"
          FROM store AS s LEFT OUTER JOIN address AS a ON s.address_id = a.id
          LEFT OUTER JOIN city c ON a.city_id = c.id
          LEFT OUTER JOIN country AS cy ON c.country_id = cy.id
          GROUP BY s.id, s.phone_number, s.id, a.address_line, c.city_name, c.state_name, a.postal_code, cy.country_name
          ORDER BY s.id;
        `
      );

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.body).toStrictEqual({
        items: expectedStores,
        length: expectedStores.length,
      });
    });

    it('GET /stores/:id/stock should get the stock count for the given store', async () => {
      const id = 1;
      const server = supertest(app);
      const response = await server.get('/api/v1/stores/1/stock').set('api-key', apiKey);
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');

      const expectedStockCount = await execQuery(`
            SELECT SUM(stock_count) AS "stock" FROM inventory WHERE store_id = ${id}
        `);

      expect(response.body).toStrictEqual({
        id: 1,
        stockCount: Number(expectedStockCount[0].stock),
      });
    });

    it('GET /stores/:id/movies should return the movies page by page', async () => {
      const storeId = 1;
      const server = supertest(app);
      const totalRows = await getRowsCount('inventory', `store_id = ${storeId}`);

      const pages = [1, 3, 5, 2];

      for (const page of pages) {
        const response = await server
          .get(`/api/v1/stores/${storeId}/movies?pageNumber=${page}`)
          .set('api-key', apiKey);
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');

        const expectedMovies = await execQuery(`
                SELECT i.id AS "inventoryId", m.id, m.imdb_id AS "imdbId", m.title, m.original_title AS "originalTitle",
                m.overview, m.runtime, m.release_date AS "releaseDate", m.genres, m.country, 
                m.movie_language AS "language", m.movie_status AS "movieStatus", m.popularity, m.budget, m.revenue,
                m.rating_average AS "ratingAverage", m.rating_count "ratingCount", m.poster_url AS "posterUrl",
                m.rental_rate AS "rentalRate", m.rental_duration AS "rentalDuration", i.stock_count AS stock
                FROM inventory AS i LEFT OUTER JOIN v_movie AS m ON m.id = i.movie_id
                WHERE i.store_id = ${storeId}
                ORDER BY i.stock_count DESC
                LIMIT ${ITEMS_COUNT_PER_PAGE_FOR_TEST}
                OFFSET ${(page - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST}
            `);

        expectedMovies.forEach((m) => {
          delete m['inventoryId'];
        });

        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: ITEMS_COUNT_PER_PAGE_FOR_TEST,
          totalItems: totalRows,
          totalPages: Math.ceil(totalRows / ITEMS_COUNT_PER_PAGE_FOR_TEST),
        });
      }
    });
  });

  describe('GET /stores returning 4xx', () => {
    it('GET /stores/:id/stock should return 400 when the id is not a valid number', async () => {
      const server = supertest(app);

      const response = await server.get('/api/v1/stores/blah/stock').set('api-key', apiKey);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid store id');
    });

    it('GET /stores/:id/movies should return 400 when the id is not a valid number', async () => {
      const server = supertest(app);

      const response = await server.get('/api/v1/stores/blah/movies').set('api-key', apiKey);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid store id');
    });

    it('GET /stores/:id/movies should return 400 when the page number is not a valid number', async () => {
      const server = supertest(app);

      const response = await server
        .get('/api/v1/stores/1/movies?pageNumber=blah')
        .set('api-key', apiKey);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid page number');
    });
  });
});
