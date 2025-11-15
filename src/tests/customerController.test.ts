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
  getRandomFirstName,
  getRandomLastName,
  getRandomPhoneNumber,
} from './testUtil';
import { ITEMS_COUNT_PER_PAGE_FOR_TEST } from './testUtil';

describe('Customer Controller', () => {
  let cookie: string = '';

  const server = supertest(app);
  const getCustomerPayload = (preferredStoreId: number | undefined = undefined) => {
    const firstName = getRandomFirstName();
    const lastName = getRandomLastName();

    const payload = {
      firstName: firstName,
      lastName: lastName,
      phoneNumber: getRandomPhoneNumber(),
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

  const getCustomerRegistrationPayload = () => {
    const firstName = getRandomFirstName();
    const lastName = getRandomLastName();
    const email = getRandomEmail(firstName, lastName);
    const password = 'test@123';

    return { firstName, lastName, email, password };
  };

  const login = async (email: string, password: string) => {
    const loginResponse = await server.post('/api/auth/login').send({ email, password });
    cookie = loginResponse.get('Set-Cookie')?.at(0) || '';
  };

  beforeEach(() => {
    cookie = '';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    cookie = '';
  });

  describe('GET /customers', () => {
    const limitPerPage = ITEMS_COUNT_PER_PAGE_FOR_TEST;

    const getExpectedPaginationData = async (page: number, totalCustomers: number) => {
      const totalPages = Math.ceil(totalCustomers / limitPerPage);
      const isLastPage = page === totalPages;
      const isFirstPage = page > 1;

      const pagination = {
        pageNumber: page,
        totalPages: totalPages,
        totalItems: totalCustomers,
        itemsPerPage: limitPerPage,
        next: isLastPage ? null : `?page=${page + 1}`,
        prev: isFirstPage ? `?page=${page - 1}` : null,
        first: '?page=first',
        last: '?page=last',
      };

      return pagination;
    };

    const getExpectedCustomersPage = async (page: number, condition?: string) => {
      let queryText = `
        SELECT cu.id, cu.first_name AS "firstName", cu.last_name AS "lastName",
        cu.email, cu.phone_number AS "phoneNumber", cu.preferred_store_id AS "preferredStoreId",
        cu.active, cu.avatar, cu.registered_on AS "registeredOn",
        CASE
          WHEN a.id IS NULL THEN null
          ELSE
            json_build_object(
              'id', a.id,
              'addressLine', a.address_line,
              'cityName', c.city_name,
              'stateName', c.state_name,
              'country', cy.country_name,
              'postalCode', a.postal_code
            )
        END AS "address"
        FROM customer AS cu LEFT JOIN address AS a ON cu.address_id = a.id
        LEFT JOIN city AS c ON a.city_id = c.id
        LEFT JOIN country AS cy ON c.country_id = cy.id
      `;

      if (condition) {
        queryText += ` WHERE ${condition}`;
      }

      queryText += `
        ORDER BY cu.id ASC
        OFFSET ${(page - 1) * limitPerPage}
        LIMIT ${limitPerPage}
      `;

      const queryResult = await execQuery(queryText);
      return queryResult;
    };

    it('should get customers with pagination support', async () => {
      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const pages = [1, 2, 5, 6, 3];
      const countQueryResult = await execQuery('SELECT COUNT(*) AS "totalCustomers" FROM customer');
      const { totalCustomers } = countQueryResult.at(0) || {};

      for (let i of pages) {
        const response = await server.get(`/api/customers?page=${i}`).set('Cookie', cookie);
        expect(response.status).toEqual(200);

        const queryResult = await getExpectedCustomersPage(i);
        const paginationData = await getExpectedPaginationData(i, Number(totalCustomers));

        const pageResult = response.body;
        expect(pageResult).toEqual({
          items: queryResult,
          length: queryResult.length,
          pagination: paginationData,
        });
      }
    });

    it('should get customers by first name', async () => {
      const countQueryResult = await execQuery(`
        SELECT COUNT(*) AS "totalCustomers" FROM customer WHERE first_name ILIKE '%tin%'
      `);
      const { totalCustomers } = countQueryResult.at(0) || {};

      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const pages = [1, 3, 6, 4, 2];

      for (let i of pages) {
        const response = await server.get(`/api/customers?page=${i}&first_name=%tin%`).set('Cookie', cookie);
        expect(response.status).toEqual(200);

        const queryResult = await getExpectedCustomersPage(i, "cu.first_name ILIKE '%tin%'");
        const paginationData = await getExpectedPaginationData(i, Number(totalCustomers));

        const pageResult = response.body;
        expect(pageResult).toEqual({
          items: queryResult,
          length: queryResult.length,
          pagination: {
            ...paginationData,
            next: paginationData.next ? paginationData.next + '&first_name=%tin%' : paginationData.next,
            prev: paginationData.prev ? paginationData.prev + '&first_name=%tin%' : paginationData.prev,
            first: paginationData.first + '&first_name=%tin%',
            last: paginationData.last + '&first_name=%tin%',
          },
        });
      }
    });

    it('should get customers by last name', async () => {
      const countQueryResult = await execQuery(`
        SELECT COUNT(*) AS "totalCustomers" FROM customer WHERE last_name ILIKE '%tin%'
      `);
      const { totalCustomers } = countQueryResult.at(0) || {};

      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const pages = [1, 3, 5, 4];

      for (let i of pages) {
        const response = await server.get(`/api/customers?page=${i}&last_name=%tin%`).set('Cookie', cookie);
        expect(response.status).toEqual(200);

        const queryResult = await getExpectedCustomersPage(i, "cu.last_name ILIKE '%tin%'");
        const paginationData = await getExpectedPaginationData(i, Number(totalCustomers));

        const pageResult = response.body;
        expect(pageResult).toEqual({
          items: queryResult,
          length: queryResult.length,
          pagination: {
            ...paginationData,
            next: paginationData.next ? paginationData.next + '&last_name=%tin%' : paginationData.next,
            prev: paginationData.prev ? paginationData.prev + '&last_name=%tin%' : paginationData.prev,
            first: paginationData.first + '&last_name=%tin%',
            last: paginationData.last + '&last_name=%tin%',
          },
        });
      }
    });

    it('should get customers by first and last name', async () => {
      const countQueryResult = await execQuery(`
        SELECT COUNT(*) AS "totalCustomers" FROM customer WHERE first_name ILIKE '%le%' AND last_name ILIKE '%le%'
      `);
      const { totalCustomers } = countQueryResult.at(0) || {};

      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const pages = [1, 2];

      for (let i of pages) {
        const response = await server.get(`/api/customers?page=${i}&first_name=%le%&last_name=%le%`).set('Cookie', cookie);
        expect(response.status).toEqual(200);

        const queryResult = await getExpectedCustomersPage(i, "cu.first_name ILIKE '%le%' AND cu.last_name ILIKE '%le%'");
        const paginationData = await getExpectedPaginationData(i, Number(totalCustomers));

        const pageResult = response.body;
        expect(pageResult).toEqual({
          items: queryResult,
          length: queryResult.length,
          pagination: {
            ...paginationData,
            next: paginationData.next ? paginationData.next + '&first_name=%le%&last_name=%le%' : paginationData.next,
            prev: paginationData.prev ? paginationData.prev + '&first_name=%le%&last_name=%le%' : paginationData.prev,
            first: paginationData.first + '&first_name=%le%&last_name=%le%',
            last: paginationData.last + '&first_name=%le%&last_name=%le%',
          },
        });
      }
    });

    it('should get customers by city', async () => {
      const countQueryResult = await execQuery(`
        SELECT COUNT(*) AS "totalCustomers" FROM customer AS cu LEFT JOIN address AS a
        ON cu.address_id = a.id LEFT JOIN city AS c ON a.city_id = c.id
        WHERE c.city_name ILIKE 'maryborough'
      `);
      const { totalCustomers } = countQueryResult.at(0) || {};

      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const pages = [1, 4, 2];

      for (let i of pages) {
        const response = await server.get(`/api/customers?page=${i}&city=maryborough`).set('Cookie', cookie);
        expect(response.status).toEqual(200);

        const queryResult = await getExpectedCustomersPage(i, "c.city_name ILIKE 'maryborough'");
        const paginationData = await getExpectedPaginationData(i, Number(totalCustomers));

        const pageResult = response.body;
        expect(pageResult).toEqual({
          items: queryResult,
          length: queryResult.length,
          pagination: {
            ...paginationData,
            next: paginationData.next ? paginationData.next + '&city=maryborough' : paginationData.next,
            prev: paginationData.prev ? paginationData.prev + '&city=maryborough' : paginationData.prev,
            first: paginationData.first + '&city=maryborough',
            last: paginationData.last + '&city=maryborough',
          },
        });
      }
    });

    it('should get customers by state', async () => {
      const countQueryResult = await execQuery(`
        SELECT COUNT(*) AS "totalCustomers" FROM customer AS cu LEFT JOIN address AS a
        ON cu.address_id = a.id LEFT JOIN city AS c ON a.city_id = c.id
        WHERE c.state_name ILIKE 'victoria'
      `);
      const { totalCustomers } = countQueryResult.at(0) || {};

      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const pages = [1, 2, 5, 6, 3];

      for (let i of pages) {
        const response = await server.get(`/api/customers?page=${i}&state=victoria`).set('Cookie', cookie);
        expect(response.status).toEqual(200);

        const queryResult = await getExpectedCustomersPage(i, "c.state_name ILIKE 'victoria'");
        const paginationData = await getExpectedPaginationData(i, Number(totalCustomers));

        const pageResult = response.body;
        expect(pageResult).toEqual({
          items: queryResult,
          length: queryResult.length,
          pagination: {
            ...paginationData,
            next: paginationData.next ? paginationData.next + '&state=victoria' : paginationData.next,
            prev: paginationData.prev ? paginationData.prev + '&state=victoria' : paginationData.prev,
            first: paginationData.first + '&state=victoria',
            last: paginationData.last + '&state=victoria',
          },
        });
      }
    });

    it('should get customers by city and state', async () => {
      const countQueryResult = await execQuery(`
        SELECT COUNT(*) AS "totalCustomers" FROM customer AS cu LEFT JOIN address AS a
        ON cu.address_id = a.id LEFT JOIN city AS c ON a.city_id = c.id
        WHERE c.city_name ILIKE 'melbourne' AND c.state_name ILIKE 'victoria'
      `);
      const { totalCustomers } = countQueryResult.at(0) || {};

      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const pages = [1, 2];

      for (let i of pages) {
        const response = await server.get(`/api/customers?page=${i}&city=melbourne&state=victoria`).set('Cookie', cookie);
        expect(response.status).toEqual(200);

        const queryResult = await getExpectedCustomersPage(i, "c.city_name ILIKE 'melbourne' AND c.state_name ILIKE 'victoria'");
        const paginationData = await getExpectedPaginationData(i, Number(totalCustomers));

        const pageResult = response.body;
        expect(pageResult).toEqual({
          items: queryResult,
          length: queryResult.length,
          pagination: {
            ...paginationData,
            next: paginationData.next ? paginationData.next + '&city=melbourne&state=victoria' : paginationData.next,
            prev: paginationData.prev ? paginationData.prev + '&city=melbourne&state=victoria' : paginationData.prev,
            first: paginationData.first + '&city=melbourne&state=victoria',
            last: paginationData.last + '&city=melbourne&state=victoria',
          },
        });
      }
    });

    it('should get customers by registered date', async () => {
      const countQueryResult = await execQuery(`
        SELECT COUNT(*) AS "totalCustomers" FROM customer WHERE registered_on = '2024-01-01'
      `);
      const { totalCustomers } = countQueryResult.at(0) || {};

      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const response = await server.get(`/api/customers?registered_on=2024-01-01`).set('Cookie', cookie);
      expect(response.status).toEqual(200);

      const queryResult = await getExpectedCustomersPage(1, "cu.registered_on = '2024-01-01'");
      const paginationData = await getExpectedPaginationData(1, Number(totalCustomers));

      const pageResult = response.body;
      expect(pageResult).toEqual({
        items: queryResult,
        length: queryResult.length,
        pagination: {
          ...paginationData,
          next: paginationData.next ? paginationData.next + '&registered_on=2024-01-01' : paginationData.next,
          prev: paginationData.prev ? paginationData.prev + '&registered_on=2024-01-01' : paginationData.prev,
          first: paginationData.first + '&registered_on=2024-01-01',
          last: paginationData.last + '&registered_on=2024-01-01',
        },
      });
    });

    it('should return 404 when fetching customers with page that is out of range', async () => {
      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      let response = await server.get('/api/customers').set('Cookie', cookie);
      expect(response.status).toEqual(200);
      const totalPages = response.body.pagination.totalPages;
      response = await server.get(`/api/customers?page=${Number(totalPages) + 1}`).set('Cookie', cookie);
      expect(response.status).toEqual(404);
      expect(response.body.message).toEqual('Page out of range');
    });
  });

  describe('GET /customers/:id', () => {
    it('should get customer detail', async () => {
      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const payload = getCustomerRegistrationPayload();

      const newCustomerResponse = await server.post('/api/customers/register').send(payload);
      const customerId = newCustomerResponse.body.id;
      cookie = newCustomerResponse.get('Set-Cookie')?.at(0) || '';

      await server
        .put(`/api/customers/${customerId}`)
        .set('Cookie', cookie)
        .send({
          ...getCustomerPayload(1),
          firstName: undefined,
          lastName: undefined,
          email: undefined,
        });

      const response = await server.get(`/api/customers/${customerId}`).set('Cookie', cookie);
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
      const response = await server.get(`/api/customers/${customerId + 1}`).set('Cookie', cookie);
      expect(response.status).toEqual(404);
      expect(response.body.message).toEqual('Resources not found');
    });
  });

  describe('POST /customers', () => {
    it('should register customer with the given payload', async () => {
      const payload = getCustomerRegistrationPayload();

      const response = await server.post('/api/customers/register').send(payload);
      expect(response.status).toEqual(201);
      const customerId = response.body.id;

      const [actualData] = await execQuery(`
          SELECT cu.id, cu.first_name AS "firstName", cu.last_name AS "lastName", cu.email,
          cu.preferred_store_id AS "preferredStoreId", cu.active, cu.phone_number AS "phoneNumber",
          cu.avatar, cu.registered_on AS "registeredOn", cu.address_id AS "addressId"
          FROM customer AS cu LEFT JOIN address AS a ON cu.address_id = a.id
          LEFT JOIN city AS c ON a.city_id = c.id
          LEFT JOIN country AS cy ON c.country_id = cy.id
          WHERE cu.id = ${customerId}
      `);

      expect({
        id: customerId,
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        preferredStoreId: null,
        active: true,
        phoneNumber: null,
        avatar: null,
        registeredOn: new Date().toISOString().split('T')[0],
        addressId: null,
      }).toEqual(actualData);
    });

    it('should not register customer if data required for new customer is missing', async () => {
      const payload = getCustomerRegistrationPayload();

      // Missing first name
      let response = await server
        .post('/api/customers/register')
        .set('Cookie', cookie)
        .send({
          ...payload,
          firstName: undefined,
        });
      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('Missing required data');

      // Missing last name
      response = await server
        .post('/api/customers/register')
        .set('Cookie', cookie)
        .send({
          ...payload,
          lastName: undefined,
        });
      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('Missing required data');

      // Missing email
      response = await server
        .post('/api/customers/register')
        .set('Cookie', cookie)
        .send({
          ...payload,
          email: undefined,
        });
      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('Missing required data');

      // Missing password
      response = await server
        .post('/api/customers/register')
        .set('Cookie', cookie)
        .send({
          ...payload,
          password: undefined,
        });
      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('Missing required data');
    });

    it('should not register customer if the email address is already in use', async () => {
      const [existingEmailAddress] = await execQuery(`
            SELECT email FROM customer LIMIT 1
        `);

      const payload = getCustomerRegistrationPayload();
      const response = await server.post('/api/customers/register').send({
        ...payload,
        email: existingEmailAddress.email,
      });

      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('Customer with the same email already exist');
    });
  });

  describe('PUT /customers/:id', () => {
    it('should update the customer with the given payload', async () => {
      const payload1 = getCustomerRegistrationPayload();
      const payload2 = getCustomerPayload(1);

      const newCustomerResponse = await server.post('/api/customers/register').send(payload1);
      cookie = newCustomerResponse.get('Set-Cookie')?.at(0) || '';
      const newCustomerId = newCustomerResponse.body.id;

      const response = await server
        .put(`/api/customers/${newCustomerId}`)
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
        email: payload1.email,
        active: true,
        registeredOn: new Date().toISOString().split('T')[0],
      });
    });

    it('should update preferred store id for the customer', async () => {
      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const payload = getCustomerRegistrationPayload();

      const newCustomerResponse = await server.post('/api/customers/register').send(payload);
      const newCustomerId = newCustomerResponse.body.id;
      cookie = newCustomerResponse.get('Set-Cookie')?.at(0) || '';

      const response = await server.put(`/api/customers/${newCustomerId}`).set('Cookie', cookie).send({
        preferredStoreId: 2,
      });
      expect(response.status).toEqual(204);
      expect(response.body).toEqual({});

      const [actualData] = await execQuery(`
        SELECT preferred_store_id AS "preferredStoreId" FROM customer WHERE id = ${newCustomerId}
      `);
      expect(actualData.preferredStoreId).toEqual(2);
    });

    it('should not update the customer with duplicate phone number', async () => {
      const payload = getCustomerRegistrationPayload();
      const [existingCustPhoneNumber] = await execQuery(`
              SELECT phone_number AS "phoneNumber" FROM customer LIMIT 1
          `);

      const newCustomerResponse = await server.post('/api/customers/register').set('Cookie', cookie).send(payload);
      const newCustomerId = newCustomerResponse.body.id;
      cookie = newCustomerResponse.get('Set-Cookie')?.at(0) || '';

      const response = await server.put(`/api/customers/${newCustomerId}`).set('Cookie', cookie).send({
        phoneNumber: existingCustPhoneNumber.phoneNumber,
      });
      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('Customer with the same phone number already exist');
    });

    it('should not let staff to update customer', async () => {
      const storeManagerCredential = await getStoreManagerCredential();
      await login(storeManagerCredential.email, storeManagerCredential.password);

      const payload = getCustomerRegistrationPayload();

      const newCustomerResponse = await server.post('/api/customers/register').send(payload);
      const custId = newCustomerResponse.body.id;

      const staffCredential = await getStaffCredential();
      await login(staffCredential.email, staffCredential.password);

      const response = await server
        .put(`/api/customers/${custId}`)
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
      const payload = getCustomerRegistrationPayload();

      const newCustomerResponse = await server.post('/api/customers/register').send(payload);
      const custId = newCustomerResponse.body.id;

      const custCredential = await getCustomerCredential();
      await login(custCredential.email, custCredential.password);

      const response = await server
        .put(`/api/customers/${custId}`)
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

    describe('PUT (change address) /customers/:id', () => {
      const registerCustomer = async (withAddress: boolean) => {
        const newCustPayload = getCustomerRegistrationPayload();

        const newCustomerResponse = await server.post('/api/customers/register').send(newCustPayload);
        const custId = newCustomerResponse.body.id;
        cookie = newCustomerResponse.get('Set-Cookie')?.at(0) || '';

        if (withAddress) {
          const { address } = getCustomerPayload();

          await server.put(`/api/customers/${custId}`).set('Cookie', cookie).send({
            address,
          });
        }

        const getCustomerResponse = await server.get(`/api/customers/${custId}`).set('Cookie', cookie);
        const customerData = getCustomerResponse.body;

        return customerData;
      };

      const getAnyUnassignedAddress = async () => {
        const [unusedAddressQueryResult] = await execQuery(`
          SELECT json_build_object(
            'id', address.id,
            'addressLine', address.address_line,
            'cityName', city.city_name,
            'stateName', city.state_name,
            'country', country.country_name,
            'postalCode', address.postal_code
          ) AS "address"
          FROM address LEFT OUTER JOIN city ON address.city_id = city.id 
          LEFT OUTER JOIN country ON city.country_id = country.id
          WHERE in_use_by IS NULL LIMIT 1
        `);

        return unusedAddressQueryResult.address as any as {
          id: number;
          addressLine: string;
          cityName: string;
          stateName: string;
          country: string;
          postalCode: string;
        };
      };

      const queryAddress = async (id: number) => {
        const [addressQueryResult] = await execQuery(`
            SELECT json_build_object(
              'id', address.id,
              'addressLine', address.address_line,
              'cityName', city.city_name,
              'stateName', city.state_name,
              'country', country.country_name,
              'postalCode', address.postal_code
            ) AS "address"
            FROM address LEFT OUTER JOIN city ON address.city_id = city.id 
            LEFT OUTER JOIN country ON city.country_id = country.id
            WHERE address.id = ${id}
          `);
        return addressQueryResult.address as any as {
          id: number;
          addressLine: string;
          cityName: string;
          stateName: string;
          country: string;
          postalCode: string;
        };
      };

      it('should update address which already exist but not assigned to any user', async () => {
        const newCustomer = await registerCustomer(true);
        const {
          id: custId,
          address: { id: custAddressId },
        } = newCustomer;

        const unusedAddress = await getAnyUnassignedAddress();

        await server.put(`/api/customers/${custId}`).set('Cookie', cookie).send({
          address: unusedAddress,
        });

        const customerData = await server.get(`/api/customers/${custId}`).set('Cookie', cookie);
        expect(customerData.body.address.id).toEqual(unusedAddress.id);

        const [prevAddrInUseByQueryResult] = await execQuery(`
          SELECT in_use_by AS "inUseBy" FROM address WHERE id = ${custAddressId}
        `);

        expect(prevAddrInUseByQueryResult.inUseBy).toBeNull();
      });

      it('should update address which does not exist and is new', async () => {
        const newCustomer = await registerCustomer(true);
        const {
          id: custId,
          address: { id: custAddressId },
        } = newCustomer;

        const { address: newAddress } = getCustomerPayload();
        let apiResponse = await server.put(`/api/customers/${custId}`).set('Cookie', cookie).send({
          address: newAddress,
        });
        expect(apiResponse.status).toEqual(204);
        apiResponse = await server.get(`/api/customers/${custId}`).set('Cookie', cookie);
        expect(apiResponse.status).toEqual(200);
        expect(apiResponse.body).toEqual({
          ...newCustomer,
          address: {
            id: expect.any(Number),
            ...newAddress,
          },
        });

        const updatedAddress = await queryAddress(custAddressId);
        expect(updatedAddress).toEqual({
          id: apiResponse.body.address.id,
          ...newAddress,
        });
      });

      it('should not update address which is already in use by other staff', async () => {
        const credential = await getStoreManagerCredential();
        await login(credential.email, credential.password);

        let apiResponse = await server.get('/api/staff/1').set('Cookie', cookie);

        const newCustomer = await registerCustomer(false);
        apiResponse = await server
          .put(`/api/customers/${newCustomer.id}`)
          .set('Cookie', cookie)
          .send({
            address: {
              ...apiResponse.body.address,
            },
          });
        expect(apiResponse.status).toEqual(400);
        expect(apiResponse.body.message).toEqual('The address is not available for use');

        apiResponse = await server.get(`/api/customers/${newCustomer.id}`).set('Cookie', cookie);
        expect(apiResponse.body.address).toBeNull();
      });

      it('should not update address which is already in use by other store', async () => {
        const credential = await getStoreManagerCredential();
        await login(credential.email, credential.password);

        let apiResponse = await server.get('/api/stores/1').set('Cookie', cookie);
        const storeAddress = apiResponse.body.address;

        const newCustomer = await registerCustomer(false);
        apiResponse = await server
          .put(`/api/customers/${newCustomer.id}`)
          .set('Cookie', cookie)
          .send({
            address: {
              ...storeAddress,
            },
          });
        expect(apiResponse.status).toEqual(400);
        expect(apiResponse.body.message).toEqual('The address is not available for use');

        apiResponse = await server.get(`/api/customers/${newCustomer.id}`).set('Cookie', cookie);
        expect(apiResponse.body.address).toBeNull();
      });

      it('should not update address which is already in use by other customer', async () => {
        const credential = await getStoreManagerCredential();
        await login(credential.email, credential.password);

        let apiResponse = await server.get('/api/customers/1').set('Cookie', cookie);
        const existingCustAddress = apiResponse.body.address;

        const newCustomer = await registerCustomer(false);
        apiResponse = await server
          .put(`/api/customers/${newCustomer.id}`)
          .set('Cookie', cookie)
          .send({
            address: {
              ...existingCustAddress,
            },
          });
        expect(apiResponse.status).toEqual(400);
        expect(apiResponse.body.message).toEqual('The address is not available for use');

        apiResponse = await server.get(`/api/customers/${newCustomer.id}`).set('Cookie', cookie);
        expect(apiResponse.body.address).toBeNull();
      });

      it('should update address for customer which does not have any address assigned', async () => {
        const newCustomer = await registerCustomer(false);

        const payload = getCustomerPayload();

        let apiResponse = await server
          .put(`/api/customers/${newCustomer.id}`)
          .set('Cookie', cookie)
          .send({
            address: {
              ...payload.address,
            },
          });
        expect(apiResponse.status).toEqual(204);

        apiResponse = await server.get(`/api/customers/${newCustomer.id}`).set('Cookie', cookie);
        expect(apiResponse.body.address).toEqual({
          id: expect.any(Number),
          ...payload.address,
        });
      });
    });
  });

  describe('DELETE /customers/:id', () => {
    it('should delete the customer', async () => {
      const payload = getCustomerRegistrationPayload();
      const newCustomerResponse = await server.post('/api/customers/register').send(payload);
      const customerId = newCustomerResponse.body.id;

      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      let [queryResult] = await execQuery(`SELECT COUNT(*) FROM customer WHERE id = ${customerId}`);
      expect(Number(queryResult.count)).toEqual(1);

      const response = await server.delete(`/api/customers/${customerId}`).set('Cookie', cookie);
      expect(response.status).toEqual(204);
      expect(response.body).toEqual({});
      [queryResult] = await execQuery(`SELECT COUNT(*) FROM customer WHERE id = ${customerId}`);
      expect(Number(queryResult.count)).toEqual(0);
    });

    it('should delete the customer and unassign the associated address', async () => {
      const payloadForNewCustomer = getCustomerRegistrationPayload();
      const newCustomerResponse = await server.post('/api/customers/register').send(payloadForNewCustomer);
      cookie = newCustomerResponse.get('Set-Cookie')?.at(0) || '';
      const customerId = newCustomerResponse.body.id;

      const payload = getCustomerPayload();
      await server
        .put(`/api/customers/${customerId}`)
        .set('Cookie', cookie)
        .send({
          address: { ...payload.address },
        });

      const customerData = await server.get(`/api/customers/${customerId}`).set('Cookie', cookie);
      const addressId = customerData.body.address.id;

      let [custCountQueryResult] = await execQuery(`SELECT COUNT(*) FROM customer WHERE id = ${customerId}`);
      let [addressInUseBy] = await execQuery(`SELECT in_use_by AS "inUseBy" FROM address WHERE id = ${addressId}`);
      expect(Number(custCountQueryResult.count)).toEqual(1);
      expect(addressInUseBy.inUseBy).toEqual('customer');

      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const response = await server.delete(`/api/customers/${customerId}`).set('Cookie', cookie);
      expect(response.status).toEqual(204);
      expect(response.body).toEqual({});

      [custCountQueryResult] = await execQuery(`SELECT COUNT(*) FROM customer WHERE id = ${customerId}`);
      [addressInUseBy] = await execQuery(`SELECT in_use_by FROM address WHERE id = ${addressId}`);
      expect(Number(custCountQueryResult.count)).toEqual(0);
      expect(addressInUseBy.inUseBy).toBeUndefined();
    });

    it('should return 404 when deleting customer with id that does not exist', async () => {
      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const [queryResult] = await execQuery(`SELECT max(id) FROM customer`);
      const customerId = Number(queryResult.max) + 1;
      const response = await server.delete(`/api/customers/${customerId}`).set('Cookie', cookie);
      expect(response.status).toEqual(404);
      expect(response.body.message).toEqual('Resources not found');
    });

    it('should not let staff to delete customer', async () => {
      const storeManagerCredential = await getStoreManagerCredential();
      await login(storeManagerCredential.email, storeManagerCredential.password);

      const payload = getCustomerPayload();
      const newCustomerResponse = await server.post('/api/customers').set('Cookie', cookie).send(payload);
      const customerId = newCustomerResponse.body.id;

      const staffCredential = await getStaffCredential();
      await login(staffCredential.email, staffCredential.password);

      const response = await server.delete(`/api/customers/${customerId}`).set('Cookie', cookie);
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
      const newCustomerResponse = await server.post('/api/customers').set('Cookie', cookie).send(payload);
      const customerId = newCustomerResponse.body.id;

      const customerCredential = await getCustomerCredential();
      await login(customerCredential.email, customerCredential.password);

      const response = await server.delete(`/api/customers/${customerId}`).set('Cookie', cookie);
      expect(response.status).toEqual(403);
      expect(response.body).toEqual({
        status: 'error',
        message: 'You are not authorized to perform this operation',
      });
    });
  });
});
