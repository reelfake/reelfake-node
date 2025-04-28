import supertest from 'supertest';

import app from '../app';
import { execQuery, getRandomAddressLine, getRandomPostalCode, getRandomEmail, getRandomCharacters } from './testUtil';
import { CustomerPayload } from '../types';

describe('Customer Controller', () => {
  const email = 'test@example.com';
  const password = 'password123';
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
    await execQuery(`DELETE FROM public.user;`);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /customer', () => {
    it('should create customer with the given payload', async () => {
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
  });

  describe('PUT /customer/:id', () => {
    it('should update the customer with the given payload', async () => {
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
  });
});
