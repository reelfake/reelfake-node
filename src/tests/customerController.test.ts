import supertest from 'supertest';

import app from '../app';
import {
  execQuery,
  getRandomAddressLine,
  getRandomPostalCode,
  getRandomEmail,
  getRandomCharacters,
  getStoreManagerCredential,
  getStaffCredential,
  getCustomerCredential,
} from './testUtil';
import { CustomerPayload } from '../types';

describe('Customer Controller', () => {
  let cookie: string = '';
  const server = supertest(app);
  const getCustomerPayload = (preferredStoreId: number | undefined = undefined) => {
    const payload = {
      firstName: getRandomCharacters(10, true),
      lastName: getRandomCharacters(10, true),
      email: getRandomEmail(),
      phoneNumber: `${Math.ceil(Math.random() * 10000000000)}`,
      preferredStoreId,
      avatar: getRandomCharacters(100),
      address: {
        addressLine: getRandomAddressLine(),
        cityName: 'Sydney',
        stateName: 'New South Wales',
        country: 'Australia',
        postalCode: getRandomPostalCode(),
      },
    };

    if (preferredStoreId) {
      payload['preferredStoreId'] = preferredStoreId;
    }

    return payload;
  };

  const login = async (email: string, password: string) => {
    const loginResponse = await server.post('/api/v1/auth/login').send({ email, password });
    cookie = loginResponse.get('Set-Cookie')?.at(0) || '';
  };

  afterEach(() => {
    jest.restoreAllMocks();
    cookie = '';
  });

  describe('GET /customers', () => {
    it('should get customers with pagination support', async () => {
      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const pages = [1, 2, 5, 6, 3];
      const limitPerPage = 50;

      const [totalCustomersQueryResult] = await execQuery(`
          SELECT COUNT(*) FROM customer
        `);
      const totalCustomers = Number(totalCustomersQueryResult.count);

      for (let i of pages) {
        const response = await server.get(`/api/v1/customers?pageNumber=${i}`).set('Cookie', cookie);
        expect(response.status).toEqual(200);

        const queryResult = await execQuery(`
            SELECT cu.id, cu.first_name AS "firstName", cu.last_name AS "lastName",
            cu.email, cu.phone_number AS "phoneNumber", cu.preferred_store_id AS "preferredStoreId",
            cu.active, cu.avatar, cu.registered_on AS "registeredOn",
            json_build_object(
              'id', a.id,
              'addressLine', a.address_line,
              'cityName', c.city_name,
              'stateName', c.state_name,
              'country', cy.country_name,
              'postalCode', a.postal_code
            ) AS "address"
            FROM customer AS cu LEFT JOIN address AS a ON cu.address_id = a.id
            LEFT JOIN city AS c ON a.city_id = c.id
            LEFT JOIN country AS cy ON c.country_id = cy.id
            ORDER BY cu.id ASC
            OFFSET ${(i - 1) * limitPerPage}
            LIMIT ${limitPerPage}
          `);

        const pageResult = response.body;
        expect(pageResult).toEqual({
          items: queryResult,
          length: queryResult.length,
          totalPages: Math.ceil(totalCustomers / limitPerPage),
          totalItems: totalCustomers,
        });
      }
    });

    it('should return 404 when fetching customers with page that is out of range', async () => {
      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      let response = await server.get('/api/v1/customers').set('Cookie', cookie);
      expect(response.status).toEqual(200);
      const totalPages = response.body.totalPages;
      response = await server.get(`/api/v1/customers?pageNumber=${Number(totalPages) + 1}`).set('Cookie', cookie);
      expect(response.status).toEqual(404);
      expect(response.body.message).toEqual('Page out of range');
    });
  });

  describe('GET /customers/:id', () => {
    it('should get customer detail', async () => {
      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const payload = getCustomerPayload(1);

      const newCustomerResponse = await server.post('/api/v1/customers').set('Cookie', cookie).send(payload);
      const customerId = newCustomerResponse.body.id;

      const response = await server.get(`/api/v1/customers/${customerId}`).set('Cookie', cookie);
      expect(response.status).toEqual(200);

      const [customerQueryResult] = await execQuery(`
        SELECT cu.id, cu.first_name AS "firstName", cu.last_name AS "lastName",
        cu.email, cu.phone_number AS "phoneNumber",
        cu.active, cu.avatar, cu.registered_on AS "registeredOn",
        cu.preferred_store_id AS "preferredStoreId",
        json_build_object(
          'id', a.id,
          'addressLine', a.address_line,
          'cityName', c.city_name,
          'stateName', c.state_name,
          'country', cy.country_name,
          'postalCode', a.postal_code
        ) AS "address"
        FROM customer AS cu LEFT JOIN address AS a ON cu.address_id = a.id
        LEFT JOIN city AS c ON a.city_id = c.id
        LEFT JOIN country AS cy ON c.country_id = cy.id
        WHERE cu.id = ${customerId}
      `);

      const storeId = customerQueryResult.preferredStoreId;
      delete customerQueryResult['preferredStoreId'];

      const [preferredStoreQueryResult] = await execQuery(`
          SELECT s.id, s.store_manager_id AS "storeManagerId", s.phone_number AS "phoneNumber",
          json_build_object(
            'id', a.id,
            'addressLine', a.address_line,
            'cityName', c.city_name,
            'stateName', c.state_name,
            'country', cy.country_name,
            'postalCode', a.postal_code
          ) AS "address"
          FROM store AS s LEFT JOIN address AS a ON s.address_id = a.id
          LEFT JOIN city AS c ON a.city_id = c.id
          LEFT JOIN country AS cy ON c.country_id = cy.id
          WHERE s.id = ${storeId}
        `);
      const storeManagerId = preferredStoreQueryResult.storeManagerId;
      delete preferredStoreQueryResult['storeManagerId'];

      const [storeManagerQueryResult] = await execQuery(`
        SELECT s.id, s.first_name AS "firstName", s.last_name AS "lastName", 
        s.email, s.active, s.phone_number AS "phoneNumber", s.avatar,
        json_build_object(
          'id', a.id,
          'addressLine', a.address_line,
          'cityName', c.city_name,
          'stateName', c.state_name,
          'country', cy.country_name,
          'postalCode', a.postal_code
        ) AS "address"
        FROM staff AS s LEFT JOIN address AS a ON s.address_id = a.id
        LEFT JOIN city AS c ON a.city_id = c.id
        LEFT JOIN country AS cy ON c.country_id = cy.id
        WHERE s.id = ${storeManagerId}
      `);

      expect(response.body).toEqual({
        ...customerQueryResult,
        preferredStore: {
          ...preferredStoreQueryResult,
          storeManager: {
            ...storeManagerQueryResult,
          },
        },
      });
    });

    it('should return 404 if the customer does not exist with the given id', async () => {
      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const [customerQueryResult] = await execQuery(`
          SELECT max(id) FROM customer
        `);
      const customerId = Number(customerQueryResult.max);
      const response = await server.get(`/api/v1/customers/${customerId + 1}`).set('Cookie', cookie);
      expect(response.status).toEqual(404);
      expect(response.body.message).toEqual('Resources not found');
    });
  });

  describe('POST /customers', () => {
    it('should create customer with the given payload', async () => {
      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const payload = getCustomerPayload(1);

      const response = await server
        .post('/api/v1/customers')
        .set('Cookie', cookie)
        .send({
          ...payload,
        });
      expect(response.status).toEqual(201);
      const newCustomerId = response.body.id;

      const [actualData] = await execQuery(`
        SELECT cu.id, cu.first_name AS "firstName", cu.last_name AS "lastName", cu.email,
        cu.preferred_store_id AS "preferredStoreId", cu.active, cu.phone_number AS "phoneNumber",
        cu.avatar, cu.registered_on AS "registeredOn", json_build_object(
            'id', a.id,
            'addressLine', a.address_line,
            'cityName', c.city_name,
            'stateName', c.state_name,
            'country', cy.country_name,
            'postalCode', a.postal_code
        ) AS "address"
        FROM customer AS cu LEFT JOIN address AS a ON cu.address_id = a.id
        LEFT JOIN city AS c ON a.city_id = c.id
        LEFT JOIN country AS cy ON c.country_id = cy.id
        WHERE cu.id = ${newCustomerId}
    `);

      expect(response.body).toEqual(actualData);
    });

    it('should create customer without preferred store', async () => {
      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const payload: Omit<CustomerPayload, 'preferredStoreId'> = getCustomerPayload();

      const response = await server
        .post('/api/v1/customers')
        .set('Cookie', cookie)
        .send({
          ...payload,
        });
      expect(response.status).toEqual(201);
      const newCustomerId = response.body.id;

      const [actualData] = await execQuery(`
          SELECT cu.id, cu.first_name AS "firstName", cu.last_name AS "lastName", cu.email,
          cu.preferred_store_id AS "preferredStoreId", cu.active, cu.phone_number AS "phoneNumber",
          cu.avatar, cu.registered_on AS "registeredOn", json_build_object(
              'id', a.id,
              'addressLine', a.address_line,
              'cityName', c.city_name,
              'stateName', c.state_name,
              'country', cy.country_name,
              'postalCode', a.postal_code
          ) AS "address"
          FROM customer AS cu LEFT JOIN address AS a ON cu.address_id = a.id
          LEFT JOIN city AS c ON a.city_id = c.id
          LEFT JOIN country AS cy ON c.country_id = cy.id
          WHERE cu.id = ${newCustomerId}
      `);

      expect(response.body).toEqual(actualData);
    });

    it('should not create customer if data required for new customer is missing', async () => {
      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const payload: Omit<CustomerPayload, 'preferredStoreId'> = getCustomerPayload();

      // Missing first name
      let response = await server
        .post('/api/v1/customers')
        .set('Cookie', cookie)
        .send({
          ...payload,
          firstName: undefined,
        });
      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('Missing required data');

      // Missing last name
      response = await server
        .post('/api/v1/customers')
        .set('Cookie', cookie)
        .send({
          ...payload,
          lastName: undefined,
        });
      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('Missing required data');

      // Missing email
      response = await server
        .post('/api/v1/customers')
        .set('Cookie', cookie)
        .send({
          ...payload,
          email: undefined,
        });
      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('Missing required data');

      // Missing phone number
      response = await server
        .post('/api/v1/customers')
        .set('Cookie', cookie)
        .send({
          ...payload,
          phoneNumber: undefined,
        });
      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('Missing required data');

      // Missing address
      response = await server
        .post('/api/v1/customers')
        .set('Cookie', cookie)
        .send({
          ...payload,
          address: undefined,
        });
      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('Missing required data');
    });

    it('should not create customer if the address is in complete', async () => {
      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const payload = getCustomerPayload(1);

      const response = await server
        .post('/api/v1/customers')
        .set('Cookie', cookie)
        .send({
          ...payload,
          address: {
            ...payload.address,
            addressLine: undefined,
          },
        });
      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('Incomplete address');
    });

    it('should not create customer if the email address is already in use', async () => {
      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const [existingEmailAddress] = await execQuery(`
            SELECT email FROM customer LIMIT 1
        `);

      const payload = getCustomerPayload(1);
      const response = await server
        .post('/api/v1/customers')
        .set('Cookie', cookie)
        .send({
          ...payload,
          email: existingEmailAddress.email,
        });

      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('Customer with the same email already exist');
    });

    it('should not create customer if the phone number is already in use', async () => {
      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const [existingPhoneNumber] = await execQuery(`
            SELECT phone_number AS "phoneNumber" FROM customer LIMIT 1
        `);

      const payload = getCustomerPayload(1);
      const response = await server
        .post('/api/v1/customers')
        .set('Cookie', cookie)
        .send({
          ...payload,
          phoneNumber: existingPhoneNumber.phoneNumber,
        });

      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('Customer with the same phone number already exist');
    });

    it('should not create customer if the residential address is already in use', async () => {
      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const [existingAddress] = await execQuery(`
            SELECT json_build_object(
                'addressLine', a.address_line,
                'cityName', c.city_name,
                'stateName', c.state_name,
                'country', cy.country_name,
                'postalCode', a.postal_code
            ) AS "address"
            FROM address AS a LEFT JOIN city AS c
            ON a.city_id = c.id LEFT JOIN country AS cy
            ON c.country_id = cy.id
            LIMIT 1
        `);

      const payload = getCustomerPayload(1);
      const response = await server
        .post('/api/v1/customers')
        .set('Cookie', cookie)
        .send({
          ...payload,
          address: existingAddress.address,
        });

      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('Customer with the same address already exist');
    });

    it('should not let staff to create customer', async () => {
      const credential = await getStaffCredential();
      await login(credential.email, credential.password);

      const payload = getCustomerPayload(1);

      const response = await server.post('/api/v1/customers').set('Cookie', cookie).send(payload);
      expect(response.status).toEqual(403);
      expect(response.body).toEqual({
        status: 'error',
        message: 'You are not authorized to perform this operation',
      });
    });

    it('should not let customer to create customer', async () => {
      const credential = await getCustomerCredential();
      await login(credential.email, credential.password);

      const payload = getCustomerPayload(1);

      const response = await server.post('/api/v1/customers').set('Cookie', cookie).send(payload);
      expect(response.status).toEqual(403);
      expect(response.body).toEqual({
        status: 'error',
        message: 'You are not authorized to perform this operation',
      });
    });
  });

  describe('PUT /customers/:id', () => {
    it('should update the customer with the given payload', async () => {
      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const payload1 = getCustomerPayload(1);
      const payload2 = getCustomerPayload(1);

      const newCustomerResponse = await server.post('/api/v1/customers').set('Cookie', cookie).send(payload1);
      const newCustomerId = newCustomerResponse.body.id;

      const response = await server
        .put(`/api/v1/customers/${newCustomerId}`)
        .set('Cookie', cookie)
        .send({
          ...payload2,
        });
      expect(response.status).toEqual(204);
      expect(response.body).toEqual({});

      const [actualData] = await execQuery(`
            SELECT cu.first_name AS "firstName", cu.last_name AS "lastName", cu.email,
            cu.preferred_store_id AS "preferredStoreId", cu.active, cu.phone_number AS "phoneNumber",
            cu.avatar, cu.registered_on AS "registeredOn", json_build_object(
                'addressLine', a.address_line,
                'cityName', c.city_name,
                'stateName', c.state_name,
                'country', cy.country_name,
                'postalCode', a.postal_code
            ) AS "address"
            FROM customer AS cu LEFT JOIN address AS a ON cu.address_id = a.id
            LEFT JOIN city AS c ON a.city_id = c.id
            LEFT JOIN country AS cy ON c.country_id = cy.id
            WHERE cu.id = ${newCustomerId}
        `);
      expect(actualData).toEqual({
        ...payload2,
        active: true,
        registeredOn: new Date().toISOString().split('T')[0],
      });
    });

    it('should update preferred store id for the customer', async () => {
      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const payload = getCustomerPayload(1);

      const newCustomerResponse = await server.post('/api/v1/customers').set('Cookie', cookie).send(payload);
      const newCustomerId = newCustomerResponse.body.id;

      const response = await server.put(`/api/v1/customers/${newCustomerId}`).set('Cookie', cookie).send({
        preferredStoreId: 2,
      });
      expect(response.status).toEqual(204);
      expect(response.body).toEqual({});

      const [actualData] = await execQuery(`
        SELECT preferred_store_id AS "preferredStoreId" FROM customer WHERE id = ${newCustomerId}
      `);
      expect(actualData.preferredStoreId).toEqual(2);
    });

    it('should update address of the customer', async () => {
      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const payload1 = getCustomerPayload(1);
      const address1Payload = {
        ...payload1.address,
        cityName: 'Sydney',
        stateName: 'New South Wales',
      };
      const payload2 = getCustomerPayload(1);
      const address2Payload = {
        ...payload2.address,
        cityName: 'Melbourne',
        stateName: 'Victoria',
      };

      const newCustomerResponse = await server
        .post('/api/v1/customers')
        .set('Cookie', cookie)
        .send({
          ...payload1,
          address: address1Payload,
        });
      const newCustomerId = newCustomerResponse.body.id;

      let [addressIdQueryResult] = await execQuery(`
            SELECT address_id AS "addressId" FROM customer WHERE id = ${newCustomerId}
        `);
      let [addressQueryResult] = await execQuery(`
            SELECT json_build_object(
                'addressLine', a.address_line,
                'cityName', c.city_name,
                'stateName', c.state_name,
                'country', cy.country_name,
                'postalCode', a.postal_code
            ) AS "address"
            FROM address AS a LEFT JOIN city AS c ON a.city_id = c.id
            LEFT JOIN country AS cy ON c.country_id = cy.id
            WHERE a.id = ${addressIdQueryResult.addressId}
        `);

      expect(addressQueryResult.address).toEqual(address1Payload);

      const response = await server.put(`/api/v1/customers/${newCustomerId}`).set('Cookie', cookie).send({
        address: address2Payload,
      });
      expect(response.status).toEqual(204);

      [addressQueryResult] = await execQuery(`
            SELECT json_build_object(
                'addressLine', a.address_line,
                'cityName', c.city_name,
                'stateName', c.state_name,
                'country', cy.country_name,
                'postalCode', a.postal_code
            ) AS "address"
            FROM address AS a LEFT JOIN city AS c ON a.city_id = c.id
            LEFT JOIN country AS cy ON c.country_id = cy.id
            WHERE a.id = ${addressIdQueryResult.addressId}
        `);
      expect(addressQueryResult.address).toEqual(address2Payload);
    });

    it('should not update the customer with duplicate email address', async () => {
      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const payload = getCustomerPayload(1);
      const [existingCustEmailAddress] = await execQuery(`
            SELECT email FROM customer LIMIT 1
        `);

      const newCustomerResponse = await server.post('/api/v1/customers').set('Cookie', cookie).send(payload);
      const newCustomerId = newCustomerResponse.body.id;

      const response = await server.put(`/api/v1/customers/${newCustomerId}`).set('Cookie', cookie).send({
        email: existingCustEmailAddress.email,
      });
      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('Customer with the same email already exist');
    });

    it('should not update the customer with duplicate phone number', async () => {
      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const payload = getCustomerPayload(1);
      const [existingCustPhoneNumber] = await execQuery(`
              SELECT phone_number AS "phoneNumber" FROM customer LIMIT 1
          `);

      const newCustomerResponse = await server.post('/api/v1/customers').set('Cookie', cookie).send(payload);
      const newCustomerId = newCustomerResponse.body.id;

      const response = await server.put(`/api/v1/customers/${newCustomerId}`).set('Cookie', cookie).send({
        phoneNumber: existingCustPhoneNumber.phoneNumber,
      });
      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('Customer with the same phone number already exist');
    });

    it('should not update the customer with duplicate residential address', async () => {
      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const [existingAddressQueryResult] = await execQuery(`
            SELECT json_build_object(
                'addressLine', a.address_line,
                'cityName', c.city_name,
                'stateName', c.state_name,
                'country', cy.country_name,
                'postalCode', a.postal_code
            ) AS "address"
            FROM address AS a LEFT JOIN city AS c
            ON a.city_id = c.id LEFT JOIN country AS cy
            ON c.country_id = cy.id
            LIMIT 1
        `);
      const existingAddress = existingAddressQueryResult.address;

      const payload = getCustomerPayload(1);
      const newCustomerResponse = await server.post('/api/v1/customers').set('Cookie', cookie).send(payload);
      const newCustomerId = newCustomerResponse.body.id;

      const response = await server.put(`/api/v1/customers/${newCustomerId}`).set('Cookie', cookie).send({
        address: existingAddress,
      });
      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('Customer with the same address already exist');
    });

    it('should not let staff to update customer', async () => {
      const storeManagerCredential = await getStoreManagerCredential();
      await login(storeManagerCredential.email, storeManagerCredential.password);

      const payload = getCustomerPayload(1);

      const newCustomerResponse = await server.post('/api/v1/customers').set('Cookie', cookie).send(payload);
      const custId = newCustomerResponse.body.id;

      const staffCredential = await getStaffCredential();
      await login(staffCredential.email, staffCredential.password);

      const response = await server
        .put(`/api/v1/customers/${custId}`)
        .set('Cookie', cookie)
        .send({
          firstName: `${payload.firstName} UPDATED`,
          lastName: `${payload.lastName} UPDATED`,
        });
      expect(response.status).toEqual(403);
      expect(response.body).toEqual({
        status: 'error',
        message: 'You are not authorized to perform this operation',
      });
    });

    it('should not let customer to update other customer data', async () => {
      const storeManagerCredential = await getStoreManagerCredential();
      await login(storeManagerCredential.email, storeManagerCredential.password);

      const payload = getCustomerPayload(1);

      const newCustomerResponse = await server.post('/api/v1/customers').set('Cookie', cookie).send(payload);
      const custId = newCustomerResponse.body.id;

      const custCredential = await getCustomerCredential();
      await login(custCredential.email, custCredential.password);

      const response = await server
        .put(`/api/v1/customers/${custId}`)
        .set('Cookie', cookie)
        .send({
          firstName: `${payload.firstName} UPDATED`,
          lastName: `${payload.lastName} UPDATED`,
        });

      expect(response.status).toEqual(403);
      expect(response.body).toEqual({
        status: 'error',
        message: 'You are not authorized to perform this operation',
      });
    });
  });

  describe('DELETE /customers/:id', () => {
    it('should delete the customer', async () => {
      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const payload = getCustomerPayload();
      const newCustomerResponse = await server.post('/api/v1/customers').set('Cookie', cookie).send(payload);
      const customerId = newCustomerResponse.body.id;

      let [queryResult] = await execQuery(`SELECT COUNT(*) FROM customer WHERE id = ${customerId}`);
      expect(Number(queryResult.count)).toEqual(1);

      const response = await server.delete(`/api/v1/customers/${customerId}`).set('Cookie', cookie);
      expect(response.status).toEqual(204);
      expect(response.body).toEqual({});
      [queryResult] = await execQuery(`SELECT COUNT(*) FROM customer WHERE id = ${customerId}`);
      expect(Number(queryResult.count)).toEqual(0);
    });

    it('should delete the customer along with the address', async () => {
      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const payload = getCustomerPayload();
      const newCustomerResponse = await server.post('/api/v1/customers').set('Cookie', cookie).send(payload);
      const customerId = newCustomerResponse.body.id;
      const addressId = newCustomerResponse.body.address.id;

      let [custCountQueryResult] = await execQuery(`SELECT COUNT(*) FROM customer WHERE id = ${customerId}`);
      let [addrCountQueryResult] = await execQuery(`SELECT COUNT(*) FROM address WHERE id = ${addressId}`);
      expect(Number(custCountQueryResult.count)).toEqual(1);
      expect(Number(addrCountQueryResult.count)).toEqual(1);

      const response = await server.delete(`/api/v1/customers/${customerId}`).set('Cookie', cookie);
      expect(response.status).toEqual(204);
      expect(response.body).toEqual({});

      [custCountQueryResult] = await execQuery(`SELECT COUNT(*) FROM customer WHERE id = ${customerId}`);
      [addrCountQueryResult] = await execQuery(`SELECT COUNT(*) FROM address WHERE id = ${addressId}`);
      expect(Number(custCountQueryResult.count)).toEqual(0);
      expect(Number(addrCountQueryResult.count)).toEqual(0);
    });

    it('should return 404 when deleting customer with id that does not exist', async () => {
      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const [queryResult] = await execQuery(`SELECT max(id) FROM customer`);
      const customerId = Number(queryResult.max) + 1;
      const response = await server.delete(`/api/v1/customers/${customerId}`).set('Cookie', cookie);
      expect(response.status).toEqual(404);
      expect(response.body.message).toEqual('Resources not found');
    });

    it('should not let staff to delete customer', async () => {
      const storeManagerCredential = await getStoreManagerCredential();
      await login(storeManagerCredential.email, storeManagerCredential.password);

      const payload = getCustomerPayload();
      const newCustomerResponse = await server.post('/api/v1/customers').set('Cookie', cookie).send(payload);
      const customerId = newCustomerResponse.body.id;

      const staffCredential = await getStaffCredential();
      await login(staffCredential.email, staffCredential.password);

      const response = await server.delete(`/api/v1/customers/${customerId}`).set('Cookie', cookie);
      expect(response.status).toEqual(403);
      expect(response.body).toEqual({
        status: 'error',
        message: 'You are not authorized to perform this operation',
      });
    });

    it('should not let customer to delete other customer', async () => {
      const storeManagerCredential = await getStoreManagerCredential();
      await login(storeManagerCredential.email, storeManagerCredential.password);

      const payload = getCustomerPayload();
      const newCustomerResponse = await server.post('/api/v1/customers').set('Cookie', cookie).send(payload);
      const customerId = newCustomerResponse.body.id;

      const customerCredential = await getCustomerCredential();
      await login(customerCredential.email, customerCredential.password);

      const response = await server.delete(`/api/v1/customers/${customerId}`).set('Cookie', cookie);
      expect(response.status).toEqual(403);
      expect(response.body).toEqual({
        status: 'error',
        message: 'You are not authorized to perform this operation',
      });
    });

    it('should not allow store manager to delete customer if it is in use by any user', async () => {
      const userEmaiil = `test${getRandomCharacters(10)}@example.com`;
      const userPassword = 'test@12345';

      // Login as store manager to create customer
      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const payload = getCustomerPayload(1);

      const newCustomerResponse = await server
        .post('/api/v1/customers')
        .set('Cookie', cookie)
        .send({
          ...payload,
        });
      expect(newCustomerResponse.status).toEqual(201);

      // Register a user
      const userRegistrationResponse = await server.post('/api/v1/user/register').send({
        email: userEmaiil,
        password: userPassword,
      });
      expect(userRegistrationResponse.statusCode).toBe(201);

      // Login as new user and set customer id
      await login(userEmaiil, userPassword);

      const updateUserResponse = await server
        .patch('/api/v1/user/me')
        .send({
          customerId: newCustomerResponse.body.id,
        })
        .set('Cookie', cookie);
      expect(updateUserResponse.statusCode).toBe(204);

      // Login as store manager and try deleting the customer
      await login(credential.email, credential.password);

      const response = await server.delete(`/api/v1/customers/${newCustomerResponse.body.id}`).set('Cookie', cookie);
      expect(response.body.message).toEqual('Customer is assigned to one of the user');
      expect(response.status).toEqual(400);
    });
  });
});
