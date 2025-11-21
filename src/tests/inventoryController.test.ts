import supertest from 'supertest';

import app from '../app';
import { execQuery, getMultipleStaffCredentials } from './testUtil';

type MovieQueryItem = {
  id: number;
  title: string;
  originalTitle: string;
  overview: string;
  runtime: string;
  releaseDate: string;
  genres: string[];
  countriesOfOrigin: string[];
  movieStatus: string;
  popularity: number;
  budget: string;
  revenue: string;
  ratingAverage: number;
  ratingCount: number;
  posterUrl: string;
  rentalRate: string;
  language: string;
};

type StoreQueryItem = {
  id: number;
  storeManagerId: number;
  phoneNumber: string;
  address: {
    id: number;
    addressLine: string;
    cityName: string;
    stateName: string;
    country: string;
    postalCode: string;
  };
};

describe('Inventory Controller', () => {
  let cookie: string = '';
  let credCounter = 0;
  let defaultOutOfStockData: MovieQueryItem | null = null;
  let defaultStoreData: StoreQueryItem | null = null;
  const defaultStoreId = 1;
  const credentials: { email: string; password: string }[] = [];

  const server = supertest(app);
  const login = async (email: string, password: string) => {
    const loginResponse = await server.post('/api/auth/login').send({ email, password });
    cookie = loginResponse.get('Set-Cookie')?.at(0) || '';
  };

  const getMovieNotInStock = async (): Promise<MovieQueryItem> => {
    if (defaultOutOfStockData) return defaultOutOfStockData;

    const queryText = `
        SELECT m.id AS "id", m.title AS "title", m.original_title AS "originalTitle",
        m.overview, m.runtime, m.release_date AS "releaseDate",
        (SELECT json_agg(genre_name) FROM genre INNER JOIN unnest(m.genre_ids) AS g_ids ON genre.id = g_ids) AS genres,
        (
          SELECT json_agg(iso_country_code)
          FROM country INNER JOIN unnest(m.origin_country_ids) AS c_ids
          ON country.id = c_ids
        ) AS "countriesOfOrigin",
        m.movie_status AS "movieStatus", m.popularity,
        m.budget, m.revenue, m.rating_average AS "ratingAverage",
        m.rating_count AS "ratingCount", m.poster_url AS "posterUrl",
        m.rental_rate AS "rentalRate",
        ml.iso_language_code AS "language"
        FROM movie AS m LEFT JOIN inventory AS i ON m.id = i.movie_id
        LEFT JOIN movie_language AS ml ON ml.id = m.language_id
        WHERE i.movie_id IS NULL
        GROUP BY m.id, ml.iso_language_code
        LIMIT 1;
      `;
    const queryResult = await execQuery(queryText);
    const data = queryResult[0];

    return {
      id: Number(data.id),
      title: data.title,
      originalTitle: data.originalTitle,
      overview: data.overview,
      runtime: data.runtime,
      releaseDate: data.releaseDate,
      genres: Array.from(data.genres),
      countriesOfOrigin: Array.from(data.countriesOfOrigin),
      movieStatus: data.movieStatus,
      popularity: Number(data.popularity),
      budget: data.budget,
      revenue: data.revenue,
      ratingAverage: Number(data.ratingAverage),
      ratingCount: Number(data.ratingCount),
      posterUrl: data.posterUrl,
      rentalRate: data.rentalRate,
      language: data.language,
    };
  };

  const getStoreData = async (id: number): Promise<StoreQueryItem> => {
    if (defaultStoreId === id && defaultStoreData) return defaultStoreData;

    const queryText = `
        SELECT s.id AS "id", s.store_manager_id AS "storeManagerId", s.phone_number AS "phoneNumber", 
        jsonb_build_object(
            'id', a.id,
            'addressLine', a.address_line,
            'cityName', c.city_name,
            'stateName', c.state_name,
            'country', co.country_name,
            'postalCode', a.postal_code
        ) AS "address"
        FROM store AS s LEFT JOIN address AS a ON s.address_id = s.id 
        LEFT JOIN city AS c ON a.city_id = c.id 
        LEFT JOIN country AS co ON c.country_id = co.id
        WHERE s.id = ${id}
    `;
    const queryResult = await execQuery(queryText);
    const [storeData] = queryResult;
    return {
      id: Number(storeData.id),
      storeManagerId: Number(storeData.storeManagerId),
      phoneNumber: storeData.phoneNumber,
      address: {
        id: Number((storeData.address as any).id),
        addressLine: (storeData.address as any).addressLine,
        cityName: (storeData.address as any).cityName,
        stateName: (storeData.address as any).stateName,
        country: (storeData.address as any).country,
        postalCode: (storeData.address as any).postalCode,
      },
    };
  };

  beforeAll(async () => {
    const creds = await getMultipleStaffCredentials(12);
    credentials.push(...creds);
    defaultOutOfStockData = await getMovieNotInStock();
    defaultStoreData = await getStoreData(defaultStoreId);
  });

  beforeEach(() => {
    cookie = '';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    cookie = '';
  });

  describe('POST /api/inventory', () => {
    it('should add the inventory', async () => {
      const credential = credentials[credCounter++];
      await login(credential.email, credential.password);

      const movieData = await getMovieNotInStock();
      const storeData = await getStoreData(1);

      const newInventoryPayload = {
        movie_id: movieData.id,
        store_id: 1,
        stock_count: 6,
      };

      const response = await server.post('/api/inventory').set('Cookie', cookie).send(newInventoryPayload);
      expect(response.status).toEqual(201);

      const newInventoryId = response.body.id;
      await execQuery(`DELETE FROM inventory WHERE id = ${newInventoryId}`);

      expect(response.body).toEqual({
        id: expect.any(Number),
        stock: newInventoryPayload.stock_count,
        movie: {
          id: newInventoryPayload.movie_id,
          title: movieData.title,
          originalTitle: movieData.originalTitle,
          overview: movieData.overview,
          runtime: movieData.runtime,
          releaseDate: movieData.releaseDate,
          genres: movieData.genres,
          countriesOfOrigin: movieData.countriesOfOrigin,
          movieStatus: movieData.movieStatus,
          popularity: movieData.popularity,
          budget: movieData.budget,
          revenue: movieData.revenue,
          ratingAverage: movieData.ratingAverage,
          ratingCount: movieData.ratingCount,
          posterUrl: movieData.posterUrl,
          rentalRate: movieData.rentalRate,
          language: movieData.language,
        },
        store: {
          id: newInventoryPayload.store_id,
          storeManagerId: storeData.storeManagerId,
          phoneNumber: storeData.phoneNumber,
          address: {
            id: storeData.address.id,
            addressLine: storeData.address.addressLine,
            cityName: storeData.address.cityName,
            stateName: storeData.address.stateName,
            country: storeData.address.country,
            postalCode: storeData.address.postalCode,
          },
        },
      });
    });

    it('should add inventory for store which already has some movies stock', async () => {
      const credential = credentials[credCounter++];
      await login(credential.email, credential.password);

      const movieData = await getMovieNotInStock();

      const storeQueryResult = await execQuery(`
          SELECT store_id AS "storeId" FROM inventory LIMIT 1;
        `);

      const storeId = storeQueryResult[0].storeId;
      const storeData = await getStoreData(Number(storeId));

      const newInventoryPayload = {
        movie_id: movieData.id,
        store_id: storeId,
        stock_count: 6,
      };

      const response = await server.post('/api/inventory').set('Cookie', cookie).send(newInventoryPayload);
      expect(response.status).toEqual(201);

      const newInventoryId = response.body.id;
      await execQuery(`DELETE FROM inventory WHERE id = ${newInventoryId}`);

      expect(response.body).toEqual({
        id: expect.any(Number),
        stock: newInventoryPayload.stock_count,
        movie: {
          id: newInventoryPayload.movie_id,
          title: movieData.title,
          originalTitle: movieData.originalTitle,
          overview: movieData.overview,
          runtime: movieData.runtime,
          releaseDate: movieData.releaseDate,
          genres: movieData.genres,
          countriesOfOrigin: movieData.countriesOfOrigin,
          movieStatus: movieData.movieStatus,
          popularity: movieData.popularity,
          budget: movieData.budget,
          revenue: movieData.revenue,
          ratingAverage: movieData.ratingAverage,
          ratingCount: movieData.ratingCount,
          posterUrl: movieData.posterUrl,
          rentalRate: movieData.rentalRate,
          language: movieData.language,
        },
        store: {
          id: newInventoryPayload.store_id,
          storeManagerId: storeData.storeManagerId,
          phoneNumber: storeData.phoneNumber,
          address: {
            id: storeData.address.id,
            addressLine: storeData.address.addressLine,
            cityName: storeData.address.cityName,
            stateName: storeData.address.stateName,
            country: storeData.address.country,
            postalCode: storeData.address.postalCode,
          },
        },
      });
    });

    it('should not add duplicate inventory to the same store', async () => {
      const credential = credentials[credCounter++];
      await login(credential.email, credential.password);

      const movieData = await getMovieNotInStock();

      const newInventoryPayload = {
        movie_id: movieData.id,
        store_id: 1,
        stock_count: 6,
      };

      let response = await server.post('/api/inventory').set('Cookie', cookie).send(newInventoryPayload);
      expect(response.status).toEqual(201);
      const newInventoryId = response.body.id;

      const duplicateInventoryPayload = {
        movie_id: movieData.id,
        store_id: 1,
        stock_count: 33,
      };

      response = await server.post('/api/inventory').set('Cookie', cookie).send(duplicateInventoryPayload);
      expect(response.status).toEqual(400);

      await execQuery(`DELETE FROM inventory WHERE id = ${newInventoryId}`);

      expect(response.body.message).toEqual('Inventory for the movie already exist in the given store');
    });

    it('should not add inventory for the movie that does not exist', async () => {
      const credential = credentials[credCounter++];
      await login(credential.email, credential.password);

      const movieQueryResult = await execQuery(`
          SELECT id FROM movie ORDER BY id DESC LIMIT 1
        `);
      const nonExistingMovieId = Number(movieQueryResult[0].id) + 1;

      const newInventoryPayload = {
        movie_id: nonExistingMovieId,
        store_id: 1,
        stock_count: 6,
      };

      let response = await server.post('/api/inventory').set('Cookie', cookie).send(newInventoryPayload);
      expect(response.status).toEqual(404);
      expect(response.body.message).toEqual('Movie not found');
    });

    it('should not add inventory for the store that does not exist', async () => {
      const credential = credentials[credCounter++];
      await login(credential.email, credential.password);

      const storeQueryResult = await execQuery(`
          SELECT id FROM store ORDER BY id DESC LIMIT 1
        `);
      const nonExistingStoreId = Number(storeQueryResult[0].id) + 1;

      const newInventoryPayload = {
        movie_id: 1,
        store_id: nonExistingStoreId,
        stock_count: 6,
      };

      let response = await server.post('/api/inventory').set('Cookie', cookie).send(newInventoryPayload);
      expect(response.status).toEqual(404);
      expect(response.body.message).toEqual('Store not found');
    });
  });

  describe('PUT /api/inventory/:id', () => {
    it('should update the stock count in the inventory', async () => {
      const credential = credentials[credCounter++];
      await login(credential.email, credential.password);

      const movieData = await getMovieNotInStock();

      const newInventoryPayload = {
        movie_id: movieData.id,
        store_id: 1,
        stock_count: 6,
      };

      let response = await server.post('/api/inventory').set('Cookie', cookie).send(newInventoryPayload);
      expect(response.status).toEqual(201);
      const newInventoryId = response.body.id;
      const newStockCount = 15;

      response = await server.put(`/api/inventory/${newInventoryId}`).set('Cookie', cookie).send({
        stock_count: newStockCount,
      });
      expect(response.status).toEqual(204);

      const queryResult = await execQuery(`
            SELECT movie_id AS "movieId", store_id AS "storeId", stock_count AS "stockCount" 
            FROM inventory WHERE id = ${newInventoryId}
        `);

      await execQuery(`DELETE FROM inventory WHERE id = ${newInventoryId}`);

      const [updatedInventory] = queryResult;
      expect(updatedInventory).toEqual({
        movieId: newInventoryPayload.movie_id,
        storeId: newInventoryPayload.store_id,
        stockCount: newStockCount,
      });
    });

    it('should update the movie id of the inventory', async () => {
      const credential = credentials[credCounter++];
      await login(credential.email, credential.password);

      const movieData1 = await getMovieNotInStock();
      const movieData2 = await getMovieNotInStock();

      const newInventoryPayload = {
        movie_id: movieData1.id,
        store_id: 1,
        stock_count: 6,
      };

      let response = await server.post('/api/inventory').set('Cookie', cookie).send(newInventoryPayload);
      expect(response.status).toEqual(201);
      const newInventoryId = response.body.id;

      response = await server.put(`/api/inventory/${newInventoryId}`).set('Cookie', cookie).send({
        movie_id: movieData2.id,
      });
      expect(response.status).toEqual(204);

      const queryResult = await execQuery(`
            SELECT movie_id AS "movieId", store_id AS "storeId", stock_count AS "stockCount" 
            FROM inventory WHERE id = ${newInventoryId}
        `);

      await execQuery(`DELETE FROM inventory WHERE id = ${newInventoryId}`);

      const [updatedInventory] = queryResult;

      expect(updatedInventory).toEqual({
        movieId: movieData2.id,
        storeId: newInventoryPayload.store_id,
        stockCount: newInventoryPayload.stock_count,
      });
    });

    it('should update the store id of the inventory', async () => {
      const credential = credentials[credCounter++];
      await login(credential.email, credential.password);

      const movieData1 = await getMovieNotInStock();

      const newInventoryPayload = {
        movie_id: movieData1.id,
        store_id: 1,
        stock_count: 6,
      };

      let response = await server.post('/api/inventory').set('Cookie', cookie).send(newInventoryPayload);
      expect(response.status).toEqual(201);
      const newInventoryId = response.body.id;

      const anotherStoreId = 30;

      response = await server.put(`/api/inventory/${newInventoryId}`).set('Cookie', cookie).send({
        store_id: anotherStoreId,
      });
      expect(response.status).toEqual(204);

      const queryResult = await execQuery(`
            SELECT movie_id AS "movieId", store_id AS "storeId", stock_count AS "stockCount" 
            FROM inventory WHERE id = ${newInventoryId}
        `);

      await execQuery(`DELETE FROM inventory WHERE id = ${newInventoryId}`);

      const [updatedInventory] = queryResult;

      expect(updatedInventory).toEqual({
        movieId: newInventoryPayload.movie_id,
        storeId: anotherStoreId,
        stockCount: newInventoryPayload.stock_count,
      });
    });

    it('should update the movie id, store id and the stock count of the inventory', async () => {
      const credential = credentials[credCounter++];
      await login(credential.email, credential.password);

      const movieData1 = await getMovieNotInStock();
      const movieData2 = await getMovieNotInStock();

      const newInventoryPayload = {
        movie_id: movieData1.id,
        store_id: 1,
        stock_count: 6,
      };

      let response = await server.post('/api/inventory').set('Cookie', cookie).send(newInventoryPayload);
      expect(response.status).toEqual(201);
      const newInventoryId = response.body.id;

      const updateInventoryPayload = {
        movie_id: movieData2.id,
        store_id: 33,
        stock_count: 15,
      };

      response = await server
        .put(`/api/inventory/${newInventoryId}`)
        .set('Cookie', cookie)
        .send({
          ...updateInventoryPayload,
        });
      expect(response.status).toEqual(204);

      const queryResult = await execQuery(`
            SELECT movie_id AS "movieId", store_id AS "storeId", stock_count AS "stockCount" 
            FROM inventory WHERE id = ${newInventoryId}
        `);

      await execQuery(`DELETE FROM inventory WHERE id = ${newInventoryId}`);

      const [updatedInventory] = queryResult;

      expect(updatedInventory).toEqual({
        movieId: updateInventoryPayload.movie_id,
        storeId: updateInventoryPayload.store_id,
        stockCount: updateInventoryPayload.stock_count,
      });
    });

    it('should not update the inventory with the movie that does not exist', async () => {
      const credential = credentials[credCounter++];
      await login(credential.email, credential.password);

      const inventoryQueryResult = await execQuery(`
          SELECT id FROM inventory LIMIT 1
        `);

      const inventoryId = inventoryQueryResult[0].id;
      const movieQueryResult = await execQuery(`
          SELECT id FROM movie ORDER BY id DESC LIMIT 1
        `);
      const nonExistingMovieId = Number(movieQueryResult[0].id) + 1;

      const response = await server.put(`/api/inventory/${inventoryId}`).set('Cookie', cookie).send({
        movie_id: nonExistingMovieId,
      });
      expect(response.status).toEqual(404);
      expect(response.body.message).toEqual('Movie not found');
    });

    it('should not update the inventory for the store that does not exist', async () => {
      const credential = credentials[credCounter++];
      await login(credential.email, credential.password);

      const inventoryQueryResult = await execQuery(`
          SELECT id FROM inventory LIMIT 1
        `);

      const inventoryId = inventoryQueryResult[0].id;
      const storeQueryResult = await execQuery(`
          SELECT id FROM store ORDER BY id DESC LIMIT 1
        `);
      const nonExistingStoreId = Number(storeQueryResult[0].id) + 1;

      const response = await server.put(`/api/inventory/${inventoryId}`).set('Cookie', cookie).send({
        store_id: nonExistingStoreId,
      });
      expect(response.status).toEqual(404);
      expect(response.body.message).toEqual('Store not found');
    });
  });

  describe('DELETE /api/inventory/:id', () => {
    it('should delete the inventory', async () => {
      const credential = credentials[credCounter++];
      await login(credential.email, credential.password);

      const movieData = await getMovieNotInStock();

      const newInventoryPayload = {
        movie_id: movieData.id,
        store_id: 1,
        stock_count: 6,
      };

      let response = await server.post('/api/inventory').set('Cookie', cookie).send(newInventoryPayload);
      expect(response.status).toEqual(201);

      const newInventoryId = response.body.id;

      const queryResultBeforeDelete = await execQuery(`SELECT count(id) AS "count" FROM inventory WHERE id = ${newInventoryId}`);
      expect(Number(queryResultBeforeDelete[0].count)).toEqual(1);

      response = await server.delete(`/api/inventory/${newInventoryId}`).set('Cookie', cookie);
      expect(response.status).toEqual(204);

      const queryResultAfterDelete = await execQuery(`SELECT count(id) AS "count" FROM inventory WHERE id = ${newInventoryId}`);
      expect(Number(queryResultAfterDelete[0].count)).toEqual(0);
    });
  });
});
