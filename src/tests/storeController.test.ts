import supertest from 'supertest';

import app from '../app';
import {
  ITEMS_COUNT_PER_PAGE_FOR_TEST,
  execQuery,
  getRowsCount,
  getRandomEmail,
  getRandomAddressLine,
  getRandomPostalCode,
} from './testUtil';

describe('Store Controller', () => {
  let cookie: string = '';
  const email = 'test@example.com';
  const password = 'password123';
  const storeDetailQueryText = `
      SELECT store.id AS "id", store.phone_number AS "phoneNumber",
      (
        SELECT json_build_object(
          'id', staff.id,
          'firstName', staff.first_name,
          'lastName', staff.last_name,
          'email', staff.email,
          'active', staff.active,
          'phoneNumber', staff.phone_number,
          'avatar', staff.avatar,
          'storeId', staff.store_id,
          'address', json_build_object(
            'id', address.id,
            'addressLine', address.address_line,
            'cityName', city.city_name,
            'stateName', city.state_name,
            'country', country.country_name,
            'postalCode', address.postal_code
          )
        ) AS "storeManager" FROM staff
          LEFT JOIN address ON staff.address_id = address.id
          LEFT JOIN city ON address.city_id = city.id
          LEFT JOIN country ON city.country_id = country.id
          WHERE staff.id = store.store_manager_id
      ),
      json_build_object(
        'id', address.id,
        'addressLine', address.address_line,
        'cityName', city.city_name,
        'stateName', city.state_name,
        'country', country.country_name,
        'postalCode', address.postal_code
      ) AS "address" FROM store
      LEFT JOIN address ON store.address_id = address.id
      LEFT JOIN city ON address.city_id = city.id
      LEFT JOIN country ON city.country_id = country.id
    `;
  const server = supertest(app);
  beforeAll(async () => {
    await server.post('/api/v1/user/register').send({
      email,
      password,
    });

    let response = await server.post('/api/v1/user/login').send({
      email,
      password,
    });

    cookie = response.get('Set-Cookie')?.at(0) || '';

    response = await server.patch('/api/v1/user/me').set('Cookie', cookie).send({
      storeManagerId: 2,
    });

    cookie = response.get('Set-Cookie')?.at(0) || '';
  });

  afterAll(async () => {
    await execQuery(`
        DELETE FROM public.user;
      `);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const getStaffPayload = () => ({
    firstName: 'Jane',
    lastName: 'Doe',
    phoneNumber: `${Math.ceil(Math.random() * 10000000000)}`,
    email: getRandomEmail(),
    address: {
      addressLine: getRandomAddressLine(),
      cityName: 'Sydney',
      stateName: 'New South Wales',
      country: 'Australia',
      postalCode: getRandomPostalCode(),
    },
  });

  const getStorePayload = () => ({
    phoneNumber: `${Math.ceil(Math.random() * 10000000000)}`,
    address: {
      addressLine: getRandomAddressLine(),
      cityName: 'Sydney',
      stateName: 'New South Wales',
      country: 'Australia',
      postalCode: getRandomPostalCode(),
    },
    storeManager: {
      firstName: 'Jane',
      lastName: 'Doe',
      phoneNumber: `${Math.ceil(Math.random() * 10000000000)}`,
      email: getRandomEmail(),
      address: {
        addressLine: getRandomAddressLine(),
        cityName: 'Sydney',
        stateName: 'New South Wales',
        country: 'Australia',
        postalCode: getRandomPostalCode(),
      },
    },
  });

  const queryAddress = async (id: number) => {
    const [queryResult] = await execQuery(`
      SELECT a.address_line AS "addressLine", c.city_name AS "cityName",
      c.state_name AS "stateName", cy.country_name AS "country",
      a.postal_code AS "postalCode"
      FROM address AS a LEFT JOIN city AS c ON a.city_id = c.id
      LEFT JOIN country AS cy ON c.country_id = cy.id
      WHERE a.id = ${id}
    `);
    return queryResult;
  };

  describe('GET /stores', () => {
    it('should all the stores', async () => {
      const response = await server.get('/api/v1/stores');
      const expectedStores = await execQuery(
        `
          SELECT s.id AS "id", s.phone_number AS "phoneNumber", s.store_manager_id AS "storeManagerId",
          json_build_object(
            'addressLine', a.address_line,
            'cityName', c.city_name,
            'stateName', c.state_name,
            'country', cy.country_name,
            'postalCode', a.postal_code
          ) AS "address"
          FROM store AS s LEFT OUTER JOIN address AS a ON s.address_id = a.id
          LEFT OUTER JOIN city c ON a.city_id = c.id
          LEFT OUTER JOIN country AS cy ON c.country_id = cy.id
          ORDER BY s.id ASC;
        `
      );
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.body).toStrictEqual({
        items: expectedStores,
        length: expectedStores.length,
      });
    });
  });

  describe('GET /stores/:id', () => {
    it('should get the stock count for the given store', async () => {
      const id = 1;
      const response = await server.get('/api/v1/stores/1/stock');
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');

      const expectedStockCount = await execQuery(`
            SELECT SUM(stock_count) AS "stock" FROM inventory WHERE store_id = ${id}
        `);

      expect(response.body).toStrictEqual({
        id: 1,
        stock: Number(expectedStockCount[0].stock),
      });
    });

    it('should return the movies in a store page by page', async () => {
      const storeId = 1;
      const totalRows = await getRowsCount('inventory', `store_id = ${storeId}`);

      const pages = [1, 3, 5, 2];

      for (const page of pages) {
        const response = await server.get(`/api/v1/stores/${storeId}/movies?pageNumber=${page}`);
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');

        const expectedMovies = await execQuery(`
                SELECT i.id AS "inventoryId", m.id, m.imdb_id AS "imdbId", m.title, m.original_title AS "originalTitle",
                m.overview, m.runtime, m.release_date AS "releaseDate", 
                (SELECT ARRAY_AGG(g.genre_name) FROM genre AS g JOIN UNNEST(m.genre_ids) AS gid ON g.id = gid) AS genres,
                (SELECT ARRAY_AGG(c.iso_country_code) FROM country AS c JOIN UNNEST(m.origin_country_ids) AS cid ON c.id = cid) AS "countriesOfOrigin", 
                (SELECT l.iso_language_code FROM movie_language AS l WHERE l.id = language_id) AS language,
                m.movie_status AS "movieStatus", m.popularity, m.budget, m.revenue,
                m.rating_average AS "ratingAverage", m.rating_count "ratingCount", m.poster_url AS "posterUrl",
                m.rental_rate AS "rentalRate", m.rental_duration AS "rentalDuration", i.stock_count AS stock
                FROM inventory AS i LEFT OUTER JOIN movie AS m ON m.id = i.movie_id
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

    it('should return the staff employed at the store', async () => {
      const storeId = 1;
      const response = await server.get(`/api/v1/stores/${storeId}/staff`).set('Cookie', cookie);
      expect(response.status).toEqual(200);

      const expectedItems = await execQuery(`
        SELECT staff.id, staff.first_name AS "firstName", staff.last_name AS "lastName",
        staff.email, staff.address_id AS "addressId", staff.store_id AS "storeId",
        staff.active, staff.phone_number AS "phoneNumber", staff.avatar, 
        store.store_manager_id = staff.id AS "isStoreManager", json_build_object(
          'id', store.id,
          'storeManagerId', store.store_manager_id,
          'addressId', store.address_id,
          'phoneNumber', store.phone_number
        ) AS "store"
        FROM staff LEFT JOIN store ON staff.store_id = store.id
        WHERE store.id = ${storeId}
      `);

      expect(response.body).toEqual({
        items: expectedItems,
        length: expectedItems.length,
      });
    });

    it('should return 400 when getting stock count but id is not a valid number', async () => {
      const response = await server.get('/api/v1/stores/blah/stock');
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid store id');
    });

    it('should return 400 when getting movies in a store but id is not a valid number', async () => {
      const response = await server.get('/api/v1/stores/blah/movies');
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid store id');
    });

    it('should return 400 when getting movies in a store but page number is not valid', async () => {
      const response = await server.get('/api/v1/stores/1/movies?pageNumber=blah');
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid page number');
    });
  });

  describe('POST /stores', () => {
    it('should create a new store with the new address and new manager', async () => {
      const payload = getStorePayload();
      const response = await server.post('/api/v1/stores').set('Cookie', cookie).send(payload);

      expect(response.status).toBe(201);
      const newStoreId = response.body.id;

      const [store] = await execQuery(`${storeDetailQueryText} WHERE store.id = ${newStoreId}`);

      expect(response.body).toEqual(store);
    });

    it('should create store without the store manager', async () => {
      const payload = getStorePayload();

      const response = await server
        .post('/api/v1/stores')
        .set('Cookie', cookie)
        .send({
          ...payload,
          storeManager: null,
          storeManagerId: null,
        });

      expect(response.status).toEqual(201);
      const newStoreId = response.body.id;

      const [store] = await execQuery(`${storeDetailQueryText} WHERE store.id = ${newStoreId}`);
      expect(response.body).toEqual(store);
    });

    it('should create a new store with the new address and existing manager', async () => {
      const payload = getStorePayload();

      const staffResponse = await server.post('/api/v1/staff').set('Cookie', cookie).send(payload.storeManager);
      const newStaffId = staffResponse.body.id;

      let [storeIdQueryResult] = await execQuery(`SELECT store_id AS "storeId" FROM staff WHERE id = ${newStaffId}`);
      let storeIdOfNewStaff = storeIdQueryResult.storeId;
      expect(storeIdOfNewStaff).toBeNull();

      const response = await server
        .post('/api/v1/stores')
        .set('Cookie', cookie)
        .send({
          ...payload,
          storeManager: undefined,
          storeManagerId: newStaffId,
        });

      expect(response.status).toBe(201);
      const newStoreId = response.body.id;

      const [store] = await execQuery(`${storeDetailQueryText} WHERE store.id = ${newStoreId}`);

      expect(response.body).toEqual(store);

      [storeIdQueryResult] = await execQuery(`SELECT store_id AS "storeId" FROM staff WHERE id = ${newStaffId}`);
      storeIdOfNewStaff = storeIdQueryResult.storeId;
      expect(storeIdOfNewStaff).toEqual(newStoreId);
    });

    it('should not allow creating store when address is incomplete', async () => {
      const payload = getStorePayload();

      const response = await server
        .post('/api/v1/stores')
        .set('Cookie', cookie)
        .send({
          ...payload,
          address: { ...payload.address, cityName: null },
          storeManager: undefined,
          storeManagerId: 1,
        });

      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('Incomplete address');
    });

    it('should not allow creating store when store manager id and data are in request', async () => {
      const payload = getStorePayload();

      const response = await server
        .post('/api/v1/stores')
        .set('Cookie', cookie)
        .send({
          ...payload,
          storeManagerId: 1,
        });

      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('Duplicate store manager data in request');
    });

    it('should not allow creating store when address used by other store', async () => {
      let payload = getStorePayload();

      await server.post('/api/v1/stores').set('Cookie', cookie).send(payload);

      payload = {
        ...getStorePayload(),
        address: { ...payload.address },
      };

      const response = await server.post('/api/v1/stores').set('Cookie', cookie).send(payload);
      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('The address is in use by other store');
    });

    it('should not allow creating store when phone number is used  by other store', async () => {
      let payload = getStorePayload();

      await server.post('/api/v1/stores').set('Cookie', cookie).send(payload);

      payload = {
        ...getStorePayload(),
        phoneNumber: payload.phoneNumber,
      };

      const response = await server.post('/api/v1/stores').set('Cookie', cookie).send(payload);
      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('The phone number is in use by other store');
    });

    it('should not create store when the address is used by staff', async () => {
      const paylaod = getStorePayload();
      const staffPayload = getStaffPayload();

      const newStaffResponse = await server.post('/api/v1/staff').set('Cookie', cookie).send(staffPayload);
      const newStaff = newStaffResponse.body;

      const response = await server
        .post('/api/v1/stores')
        .set('Cookie', cookie)
        .send({
          ...paylaod,
          address: newStaff.address,
        });
      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('The address is in use by other staff');
    });

    it('should not create store when the store manager address is used by staff', async () => {});

    it('should not allow creating store when store manager is already assigned to other store', async () => {
      const payload = getStorePayload();

      let response = await server.post('/api/v1/stores').set('Cookie', cookie).send(payload);
      const storeManagerId = response.body.storeManager.id;

      response = await server
        .post('/api/v1/stores')
        .set('Cookie', cookie)
        .send({
          ...getStorePayload(),
          storeManager: null,
          storeManagerId,
        });
      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('Store manager is assigned to existing store');
    });

    it('should not allow creating store when store manager address is outside state', async () => {
      const payload = getStorePayload();

      let response = await server.post('/api/v1/stores').set('Cookie', cookie).send(payload);

      response = await server
        .post('/api/v1/stores')
        .set('Cookie', cookie)
        .send({
          ...getStorePayload(),
          storeManager: {
            ...payload.storeManager,
            address: {
              ...payload.storeManager.address,
              stateName: 'Victoria',
            },
          },
        });

      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('Cannot assign manager to store outside state');
    });

    it('should not allow creating store when store manager address is same as some other store address', async () => {
      const payload = getStorePayload();

      let response = await server.post('/api/v1/stores').set('Cookie', cookie).send(payload);

      const newPayload = getStorePayload();

      response = await server
        .post('/api/v1/stores')
        .set('Cookie', cookie)
        .send({
          ...newPayload,
          storeManager: {
            ...newPayload.storeManager,
            address: {
              ...payload.address,
            },
          },
        });

      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('Store manager address cannot be same as other store');
    });

    it('should not allow creating store when store manager address is same as new store address', async () => {
      const payload = getStorePayload();

      let response = await server.post('/api/v1/stores').set('Cookie', cookie).send(payload);

      const newPayload = getStorePayload();

      response = await server
        .post('/api/v1/stores')
        .set('Cookie', cookie)
        .send({
          ...newPayload,
          storeManager: {
            ...newPayload.storeManager,
            address: {
              ...newPayload.address,
            },
          },
        });

      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('Store manager address cannot be same as store address');
    });

    it('should not create store with the phone number which is in use by a staff', async () => {
      const payload = getStorePayload();

      const [staffPhoneNumberQueryResult] = await execQuery(`SELECT phone_number AS "phoneNumber" FROM staff LIMIT 1`);
      const staffPhoneNumber = staffPhoneNumberQueryResult['phoneNumber'];

      const response = await server
        .post('/api/v1/stores')
        .set('Cookie', cookie)
        .send({
          ...payload,
          phoneNumber: staffPhoneNumber,
        });

      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('The phone number is in use by staff');
    });
  });

  describe('PUT /stores/:id', () => {
    const queryStore = async (id: number) => {
      const query = `
        SELECT s.id, s.store_manager_id as "storeManagerId", s.phone_number AS "phoneNumber",
        json_build_object(
          'addressLine', a.address_line, 
          'cityName', c.city_name,
          'stateName', c.state_name,
          'country', cy.country_name,
          'postalCode', a.postal_code
        ) as "address"
        FROM store s 
        LEFT JOIN address a ON s.address_id = a.id 
        LEFT JOIN city c ON a.city_id = c.id
        LEFT JOIN country cy ON c.country_id = cy.id
        WHERE s.id = ${id};
      `;
      const [store] = await execQuery(query);
      return store;
    };

    const getDifferentCity = async (cityName: string, stateName: string) => {
      const [{ cityName: newCityName }] = await execQuery(`
        SELECT city_name as "cityName" 
        FROM city WHERE state_name = '${stateName}'
        AND city_name <> '${cityName}'
        LIMIT 1;
      `);

      return newCityName;
    };

    it('should update address line, city and postal code of the store', async () => {
      const payload = getStorePayload();
      const newStoreResponse = await server.post('/api/v1/stores').set('Cookie', cookie).send(payload);
      const storeBeforeUpdate = newStoreResponse.body;
      const storeAddressId = newStoreResponse.body.address.id;

      const newAddressLine = `${storeBeforeUpdate.address.addressLine} UPDATED`;

      const newCityName = await getDifferentCity(
        storeBeforeUpdate.address.cityName,
        storeBeforeUpdate.address.stateName
      );

      const response = await server
        .put(`/api/v1/stores/${storeBeforeUpdate.id}`)
        .set('Cookie', cookie)
        .send({
          address: {
            addressLine: newAddressLine,
            cityName: newCityName,
            stateName: `${storeBeforeUpdate.address.stateName}`,
            country: `${storeBeforeUpdate.address.country}`,
            postalCode: '12345',
          },
        });

      expect(response.status).toBe(204);

      const storeAfterUpdate = await queryStore(storeBeforeUpdate.id);

      expect(storeAfterUpdate.storeManagerId).toEqual(storeBeforeUpdate.storeManager.id);
      expect(storeAfterUpdate.address).toEqual({
        addressLine: newAddressLine,
        cityName: newCityName,
        stateName: storeBeforeUpdate.address.stateName,
        country: storeBeforeUpdate.address.country,
        postalCode: '12345',
      });

      const updatedStoreAddress = await queryAddress(storeAddressId);

      expect(updatedStoreAddress).toEqual({
        addressLine: newAddressLine,
        cityName: newCityName,
        stateName: storeBeforeUpdate.address.stateName,
        country: storeBeforeUpdate.address.country,
        postalCode: '12345',
      });
    });

    it('should update the address line of the store', async () => {
      const payload = getStorePayload();
      const newStoreResponse = await server.post('/api/v1/stores').set('Cookie', cookie).send(payload);
      const storeBeforeUpdate = newStoreResponse.body;
      const storeAddressId = newStoreResponse.body.address.id;

      const newAddressLine = `${storeBeforeUpdate.address.addressLine} UPDATED`;
      const response = await server
        .put(`/api/v1/stores/${storeBeforeUpdate.id}`)
        .set('Cookie', cookie)
        .send({
          address: {
            addressLine: newAddressLine,
            cityName: storeBeforeUpdate.address.cityName,
            stateName: storeBeforeUpdate.address.stateName,
            country: storeBeforeUpdate.address.country,
            postalCode: '12345',
          },
        });
      expect(response.status).toBe(204);

      const storeAfterUpdate = await queryStore(storeBeforeUpdate.id);

      expect(storeAfterUpdate.storeManagerId).toEqual(storeBeforeUpdate.storeManager.id);
      expect(storeAfterUpdate.address).toEqual({
        addressLine: newAddressLine,
        cityName: storeBeforeUpdate.address.cityName,
        stateName: storeBeforeUpdate.address.stateName,
        country: storeBeforeUpdate.address.country,
        postalCode: '12345',
      });

      const updatedStoreAddress = await queryAddress(storeAddressId);

      expect(updatedStoreAddress).toEqual({
        addressLine: newAddressLine,
        cityName: storeBeforeUpdate.address.cityName,
        stateName: storeBeforeUpdate.address.stateName,
        country: storeBeforeUpdate.address.country,
        postalCode: '12345',
      });
    });

    it('should update the city of the store', async () => {
      const payload = getStorePayload();
      const newStoreResponse = await server.post('/api/v1/stores').set('Cookie', cookie).send(payload);
      const storeBeforeUpdate = newStoreResponse.body;
      const storeAddressId = newStoreResponse.body.address.id;

      const newCityName = await getDifferentCity(
        storeBeforeUpdate.address.cityName,
        storeBeforeUpdate.address.stateName
      );

      const response = await server
        .put(`/api/v1/stores/${storeBeforeUpdate.id}`)
        .set('Cookie', cookie)
        .send({
          address: {
            addressLine: storeBeforeUpdate.address.addressLine,
            cityName: newCityName,
            stateName: storeBeforeUpdate.address.stateName,
            country: storeBeforeUpdate.address.country,
            postalCode: '12345',
          },
        });
      expect(response.status).toBe(204);

      const storeAfterUpdate = await queryStore(storeBeforeUpdate.id);

      expect(storeAfterUpdate.storeManagerId).toEqual(storeBeforeUpdate.storeManager.id);
      expect(storeAfterUpdate.address).toEqual({
        addressLine: storeBeforeUpdate.address.addressLine,
        cityName: newCityName,
        stateName: storeBeforeUpdate.address.stateName,
        country: storeBeforeUpdate.address.country,
        postalCode: '12345',
      });

      const updatedStoreAddress = await queryAddress(storeAddressId);

      expect(updatedStoreAddress).toEqual({
        addressLine: storeBeforeUpdate.address.addressLine,
        cityName: newCityName,
        stateName: storeBeforeUpdate.address.stateName,
        country: storeBeforeUpdate.address.country,
        postalCode: '12345',
      });
    });

    it('should update the store with the new manager', async () => {
      const storePayload = getStorePayload();
      const staffPayload = getStaffPayload();
      staffPayload.address = {
        ...staffPayload.address,
        stateName: storePayload.address.stateName,
        country: storePayload.address.country,
      };

      const storeResponse = await server.post('/api/v1/stores').set('Cookie', cookie).send(storePayload);
      const storeId = storeResponse.body.id;

      const staffResponse = await server.post('/api/v1/staff').set('Cookie', cookie).send(staffPayload);
      const staffId = staffResponse.body.id;

      let [storeQueryResult] = await execQuery(`
          SELECT store_manager_id AS "storeManagerId" FROM store WHERE id = ${storeId}
        `);

      expect(Number(storeQueryResult.storeManagerId)).not.toEqual(Number(staffId));

      const response = await server.put(`/api/v1/stores/${storeId}`).set('Cookie', cookie).send({
        storeManagerId: staffId,
      });
      expect(response.status).toEqual(204);
      expect(response.body).toEqual({});

      [storeQueryResult] = await execQuery(`
        SELECT store_manager_id AS "storeManagerId" FROM store WHERE id = ${storeId}
      `);
      expect(Number(storeQueryResult.storeManagerId)).toEqual(Number(staffId));
    });

    it('should not allow to change the state of the store', async () => {
      const payload = getStorePayload();
      const newStoreResponse = await server.post('/api/v1/stores').set('Cookie', cookie).send(payload);
      const storeBeforeUpdate = newStoreResponse.body;

      const response = await server
        .put(`/api/v1/stores/${storeBeforeUpdate.id}`)
        .set('Cookie', cookie)
        .send({
          address: {
            addressLine: storeBeforeUpdate.address.addressLine,
            cityName: storeBeforeUpdate.address.cityName,
            stateName: 'Victoria',
            country: storeBeforeUpdate.address.country,
            postalCode: '12345',
          },
        });
      expect(response.status).toBe(400);
      expect(response.body.message).toEqual('Changing state of the store is not allowed');
    });

    it('should not allow to change the country of the store', async () => {
      const payload = getStorePayload();
      const newStoreResponse = await server.post('/api/v1/stores').set('Cookie', cookie).send(payload);
      const storeBeforeUpdate = newStoreResponse.body;

      const response = await server
        .put(`/api/v1/stores/${storeBeforeUpdate.id}`)
        .set('Cookie', cookie)
        .send({
          address: {
            addressLine: storeBeforeUpdate.address.addressLine,
            cityName: storeBeforeUpdate.address.cityName,
            stateName: storeBeforeUpdate.address.stateName,
            country: 'New Zealand',
            postalCode: '12345',
          },
        });
      expect(response.status).toBe(400);
      expect(response.body.message).toEqual('Changing country of the store is not allowed');
    });

    it('should not allow to change the city of the store to outside the state', async () => {
      const payload = getStorePayload();
      const newStoreResponse = await server.post('/api/v1/stores').set('Cookie', cookie).send(payload);
      const storeBeforeUpdate = newStoreResponse.body;

      const response = await server
        .put(`/api/v1/stores/${storeBeforeUpdate.id}`)
        .set('Cookie', cookie)
        .send({
          address: {
            ...storeBeforeUpdate.address,
            cityName: 'Victoria',
          },
        });

      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('City belongs to a different state');
    });

    it('should not allow creating store when address is incomplete', async () => {
      const payload = getStorePayload();
      const newStoreResponse = await server.post('/api/v1/stores').set('Cookie', cookie).send(payload);
      const storeBeforeUpdate = newStoreResponse.body;

      const response = await server
        .put(`/api/v1/stores/${storeBeforeUpdate.id}`)
        .set('Cookie', cookie)
        .send({
          address: {
            ...storeBeforeUpdate.address,
            cityName: null,
          },
        });

      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('Incomplete address');
    });

    it('should not allow creating store when store manager id and data are in request', async () => {
      const payload = getStorePayload();
      const newStoreResponse = await server.post('/api/v1/stores').set('Cookie', cookie).send(payload);
      const storeBeforeUpdate = newStoreResponse.body;

      const response = await server
        .put(`/api/v1/stores/${storeBeforeUpdate.id}`)
        .set('Cookie', cookie)
        .send({
          storeManagerId: storeBeforeUpdate.storeManager.id,
          storeManager: { ...payload.storeManager },
        });

      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('Duplicate store manager data in request');
    });

    it('should not allow updating store when address used by other store', async () => {
      const payload1 = getStorePayload();
      const payload2 = getStorePayload();
      const store1Response = await server.post('/api/v1/stores').set('Cookie', cookie).send(payload1);
      const store2Response = await server.post('/api/v1/stores').set('Cookie', cookie).send(payload2);

      const response = await server
        .put(`/api/v1/stores/${store2Response.body.id}`)
        .set('Cookie', cookie)
        .send({
          address: {
            ...store1Response.body.address,
          },
        });

      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('The address is in use by other store');
    });

    it('should not allow updating store when phone number is used  by other store', async () => {
      const payload1 = getStorePayload();
      const payload2 = getStorePayload();
      const store1Response = await server.post('/api/v1/stores').set('Cookie', cookie).send(payload1);
      const store2Response = await server.post('/api/v1/stores').set('Cookie', cookie).send(payload2);

      const response = await server.put(`/api/v1/stores/${store2Response.body.id}`).set('Cookie', cookie).send({
        phoneNumber: store1Response.body.phoneNumber,
      });

      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('The phone number is in use by other store');
    });

    it('should not allow updating store when store manager is already assigned to other store', async () => {
      const payload1 = getStorePayload();
      const payload2 = getStorePayload();
      const store1Response = await server.post('/api/v1/stores').set('Cookie', cookie).send(payload1);
      const store2Response = await server.post('/api/v1/stores').set('Cookie', cookie).send(payload2);

      const response = await server.put(`/api/v1/stores/${store2Response.body.id}`).set('Cookie', cookie).send({
        storeManagerId: store1Response.body.storeManager.id,
      });

      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('Store manager is assigned to existing store');
    });

    it('should not allow updating store when store manager address is outside state', async () => {
      const payload1 = getStorePayload();
      const payload2 = getStorePayload();
      const store1Response = await server.post('/api/v1/stores').set('Cookie', cookie).send(payload1);
      const store2Response = await server.post('/api/v1/stores').set('Cookie', cookie).send(payload2);

      await execQuery(`
        UPDATE store SET store_manager_id = null WHERE id = ${store1Response.body.id}
      `);

      await execQuery(`
        UPDATE address SET city_id = (SELECT id FROM city WHERE city_name = 'Melbourne')
        FROM staff WHERE staff.address_id = address.id AND 
        staff.id = ${store1Response.body.storeManager.id}
      `);

      const response = await server.put(`/api/v1/stores/${store2Response.body.id}`).set('Cookie', cookie).send({
        storeManagerId: store1Response.body.storeManager.id,
      });

      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('Cannot assign manager to store outside state');
    });
  });

  describe('DELETE /stores/:id', () => {
    it('should delete store', async () => {
      const payload = getStorePayload();

      const newStoreResponse = await server
        .post('/api/v1/stores')
        .set('Cookie', cookie)
        .send({
          ...payload,
          storeManager: undefined,
          storeManagerId: undefined,
        });
      const newStore = newStoreResponse.body;

      // Address count before delete
      const [addrCountResultBeforeDelete] = await execQuery(`
        SELECT COUNT(*) FROM address LEFT JOIN city ON address.city_id = city.id
        WHERE address.address_line = '${newStore.address.addressLine}'
        AND city.city_name = '${newStore.address.cityName}'
        AND address.postal_code = '${newStore.address.postalCode}'
      `);

      const [addrCountBeforeDelete] = addrCountResultBeforeDelete.count;
      expect(Number(addrCountBeforeDelete)).toEqual(1);

      // Store count before delete
      const [storeCountResultBeforeDelete] = await execQuery(`SELECT COUNT(*) FROM store WHERE id = ${newStore.id}`);
      const storeCountBeforeDelete = storeCountResultBeforeDelete.count;
      expect(Number(storeCountBeforeDelete)).toEqual(1);

      const response = await server.delete(`/api/v1/stores/${newStore.id}`).set('Cookie', cookie);
      expect(response.status).toEqual(204);

      // Address count after delete
      const [addrCountResultAfterDelete] = await execQuery(`
        SELECT COUNT(*) FROM address LEFT JOIN city ON address.city_id = city.id
        WHERE address.address_line = '${newStore.address.addressLine}'
        AND city.city_name = '${newStore.address.cityName}'
        AND address.postal_code = '${newStore.address.postalCode}'
      `);

      const [addrCountAfterDelete] = addrCountResultAfterDelete.count;
      expect(Number(addrCountAfterDelete)).toEqual(0);

      // Store count after delete
      const [storeCountResultAfterDelete] = await execQuery(`SELECT COUNT(*) FROM store WHERE id = ${newStore.id}`);
      const staffCountAfterDelete = storeCountResultAfterDelete.count;
      expect(Number(staffCountAfterDelete)).toEqual(0);
    });

    it('should not delete the store if there are staff employed at the store', async () => {
      const payload = getStaffPayload();
      const storePayload = getStorePayload();

      const newStoreResponse = await server
        .post('/api/v1/stores')
        .set('Cookie', cookie)
        .send({
          ...storePayload,
          storeManager: undefined,
          storeManagerId: undefined,
        });
      const newStoreId = newStoreResponse.body.id;

      await server
        .post('/api/v1/staff')
        .set('Cookie', cookie)
        .send({
          ...payload,
          storeId: newStoreId,
        });

      const response = await server.delete(`/api/v1/stores/${newStoreId}`).set('Cookie', cookie);
      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('There are staff employed at the given store');

      const [storeCountQueryResult] = await execQuery(`
        SELECT COUNT(*) FROM store WHERE id = ${newStoreId}  
      `);
      const storeCount = storeCountQueryResult.count;
      expect(Number(storeCount)).toEqual(1);
    });

    it('should delete the store and deactivate the store staff', async () => {
      const storePayload = getStorePayload();
      const staff1Payload = getStaffPayload();
      const staff2Payload = getStaffPayload();
      const staff3Payload = getStaffPayload();
      const staff4Payload = getStaffPayload();
      const staff5Payload = getStaffPayload();

      const newStoreResponse = await server.post('/api/v1/stores').set('Cookie', cookie).send(storePayload);
      const storeId = newStoreResponse.body.id;
      await server
        .post('/api/v1/staff')
        .set('Cookie', cookie)
        .send({ ...staff1Payload, storeId });
      await server
        .post('/api/v1/staff')
        .set('Cookie', cookie)
        .send({ ...staff2Payload, storeId });
      await server
        .post('/api/v1/staff')
        .set('Cookie', cookie)
        .send({ ...staff3Payload, storeId });
      await server
        .post('/api/v1/staff')
        .set('Cookie', cookie)
        .send({ ...staff4Payload, storeId });
      await server
        .post('/api/v1/staff')
        .set('Cookie', cookie)
        .send({ ...staff5Payload, storeId });

      const response = await server.delete(`/api/v1/stores/${storeId}?forceDelete=true`).set('Cookie', cookie);
      expect(response.status).toEqual(204);
    });
  });
});
