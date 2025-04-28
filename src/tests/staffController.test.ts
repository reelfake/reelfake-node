import supertest from 'supertest';

import app from '../app';
import { execQuery, getRandomAddressLine, getRandomPostalCode, getRandomEmail } from './testUtil';

describe('Staff Controller', () => {
  const email = 'test@example.com';
  const password = 'password123';
  let cookie: string = '';

  const getAddressCount = async (address: {
    addressLine: string;
    cityName: string;
    stateName: string;
    country: string;
    postalCode: string;
  }) => {
    const [addressQueryResult] = await execQuery(`
      SELECT COUNT(*)
      FROM address LEFT JOIN city ON address.city_id = city.id
      LEFT JOIN country ON city.country_id = country.id
      WHERE address.address_line = '${address.addressLine}'
      AND city.city_name = '${address.cityName}'
      AND city.state_name = '${address.stateName}'
      AND country.country_name = '${address.country}'
      AND address.postal_code = '${address.postalCode}'
    `);

    return Number(addressQueryResult.count);
  };

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
    await execQuery(`DELETE FROM public.user;`);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /staff', () => {
    it('should create new staff', async () => {
      const payload = getStaffPayload();

      expect(await getAddressCount(payload.address)).toEqual(0);

      const response = await server.post('/api/v1/staff').set('Cookie', cookie).send(payload);
      expect(response.status).toBe(201);
      const newStaffId = response.body.id;

      const queryText = `
        SELECT staff.id AS "id", staff.first_name AS "firstName", staff.last_name AS "lastName",
        staff.email AS "email", staff.active AS "active", staff.store_id AS "storeId", 
        staff.phone_number AS "phoneNumber",
        staff.avatar AS "avatar", json_build_object(
            'id', address.id,
            'addressLine', address.address_line,
            'cityName', city.city_name,
            'stateName', city.state_name,
            'country', country.country_name,
            'postalCode', address.postal_code
        ) AS "address" FROM staff
        LEFT JOIN address ON staff.address_id = address.id
        LEFT JOIN city ON address.city_id = city.id
        LEFT JOIN country ON city.country_id = country.id
        WHERE staff.id = ${newStaffId}
      `;
      const [actualData] = await execQuery(queryText);
      expect(response.body).toEqual(actualData);

      expect(await getAddressCount(payload.address)).toEqual(1);
    });

    it('should create staff with the store id of existing store', async () => {
      const storePayload = getStorePayload();
      const staffPayload = getStaffPayload();

      const newStoreResponse = await server.post('/api/v1/stores').set('Cookie', cookie).send(storePayload);
      const newStore = newStoreResponse.body;
      const newStoreId = newStore.id;

      const newStaffResponse = await server
        .post('/api/v1/staff')
        .set('Cookie', cookie)
        .send({
          ...staffPayload,
          storeId: newStoreId,
        });

      expect(newStaffResponse.status).toEqual(201);

      const queryText = `
      SELECT staff.id AS "id", staff.first_name AS "firstName", staff.last_name AS "lastName",
      staff.email AS "email", staff.active AS "active", staff.store_id AS "storeId", 
      staff.phone_number AS "phoneNumber",
      staff.avatar AS "avatar", json_build_object(
          'id', address.id,
          'addressLine', address.address_line,
          'cityName', city.city_name,
          'stateName', city.state_name,
          'country', country.country_name,
          'postalCode', address.postal_code
      ) AS "address" FROM staff
      LEFT JOIN address ON staff.address_id = address.id
      LEFT JOIN city ON address.city_id = city.id
      LEFT JOIN country ON city.country_id = country.id
      WHERE staff.id = ${newStaffResponse.body.id}
    `;
      const [actualData] = await execQuery(queryText);

      expect(newStaffResponse.body).toEqual(actualData);

      const [storeIdQueryResult] = await execQuery(
        `SELECT store_id AS "storeId" FROM staff WHERE id = ${newStaffResponse.body.id}`
      );
      const storeIdOfNewStaff = storeIdQueryResult.storeId;
      expect(storeIdOfNewStaff).toEqual(newStoreId);
    });

    it('should create staff with the existing address', async () => {
      const payload = getStaffPayload();

      const [existingAddress] = await execQuery(`
        SELECT address.id, address.address_line AS "addressLine", city.city_name AS "cityName", 
        city.state_name AS "stateName", country.country_name AS country, 
        address.postal_code AS "postalCode"
        FROM address LEFT JOIN city ON address.city_id = city.id
        LEFT JOIN country ON city.country_id = country.id WHERE NOT EXISTS (
          SELECT address_id FROM staff WHERE address.id = staff.address_id
        ) AND NOT EXISTS (
          SELECT address_id FROM store WHERE address.id = store.address_id
        ) LIMIT 1
      `);

      payload.address = {
        addressLine: existingAddress.addressLine,
        cityName: existingAddress.cityName,
        stateName: existingAddress.stateName,
        country: existingAddress.country,
        postalCode: existingAddress.postalCode,
      };

      const response = await server.post('/api/v1/staff').set('Cookie', cookie).send(payload);

      expect(response.status).toEqual(201);

      const queryText = `
        SELECT staff.id AS "id", staff.first_name AS "firstName", staff.last_name AS "lastName",
        staff.email AS "email", staff.active AS "active", staff.store_id AS "storeId", 
        staff.phone_number AS "phoneNumber",
        staff.avatar AS "avatar", json_build_object(
            'id', address.id,
            'addressLine', address.address_line,
            'cityName', city.city_name,
            'stateName', city.state_name,
            'country', country.country_name,
            'postalCode', address.postal_code
        ) AS "address" FROM staff
        LEFT JOIN address ON staff.address_id = address.id
        LEFT JOIN city ON address.city_id = city.id
        LEFT JOIN country ON city.country_id = country.id
        WHERE staff.id = ${response.body.id}
      `;
      const [actualData] = await execQuery(queryText);
      expect(response.body).toEqual(actualData);

      const [addressIdQueryResult] = await execQuery(`
        SELECT address_id AS "addressId" FROM staff WHERE id = ${response.body.id}  
      `);

      const addressIdOfNewStaff = addressIdQueryResult.addressId;
      expect(Number(addressIdOfNewStaff)).toEqual(Number(existingAddress.id));
    });

    it('should not create staff with address which is in use by a store', async () => {
      const staffPayload = getStaffPayload();

      const [addressInUseQueryResult] = await execQuery(`
        SELECT address.address_line AS "addressLine", city.city_name AS "cityName", 
        city.state_name AS "stateName", country.country_name AS "country",
        address.postal_code AS "postalCode"
        FROM store LEFT JOIN address ON store.address_id = address.id
        LEFT JOIN city ON address.city_id = city.id
        LEFT JOIN country ON city.country_id = country.id
        LIMIT 1  
      `);

      const addressInUse = { ...addressInUseQueryResult };

      const response = await server
        .post('/api/v1/staff')
        .set('Cookie', cookie)
        .send({
          ...staffPayload,
          address: { ...addressInUse },
        });
      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('The address is in use by a store');
    });

    it('should not create staff with phone number which is in use by a store', async () => {
      const payload = getStaffPayload();

      const [phoneNumberQueryResult] = await execQuery(`SELECT phone_number AS "phoneNumber" FROM store LIMIT 1`);
      const phoneNumberInUse = phoneNumberQueryResult['phoneNumber'];

      const response = await server
        .post('/api/v1/staff')
        .set('Cookie', cookie)
        .send({
          ...payload,
          phoneNumber: phoneNumberInUse,
        });

      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('The phone number is in use by a store');
    });

    it('should not create staff with address which is in use by other staff', async () => {
      const payload = getStaffPayload();

      const [addressInUserQueryResult] = await execQuery(`
        SELECT address.address_line AS "addressLine", city.city_name AS "cityName",
        city.state_name AS "stateName", country.country_name AS "country", address.postal_code AS "postalCode"
        FROM staff LEFT JOIN address ON staff.address_id = address.id
        LEFT JOIN city ON address.city_id = city.id
        LEFT JOIN country ON city.country_id = country.id
        LIMIT 1
      `);

      const addressInUse = { ...addressInUserQueryResult };

      const response = await server
        .post('/api/v1/staff')
        .set('Cookie', cookie)
        .send({ ...payload, address: { ...addressInUse } });

      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('The address is in use by other staff');
    });

    it('should not create staff with phone number which is in use by other staff', async () => {
      const payload = getStaffPayload();

      const [phoneNumberQueryResult] = await execQuery(`SELECT phone_number AS "phoneNumber" FROM staff LIMIT 1`);
      const phoneNumberInUse = phoneNumberQueryResult['phoneNumber'];

      const response = await server
        .post('/api/v1/staff')
        .set('Cookie', cookie)
        .send({
          ...payload,
          phoneNumber: phoneNumberInUse,
        });

      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('The phone number is in use by other staff');
    });
  });

  describe.only('PUT /staff/:id', () => {
    it('should update staff with the new phone number', async () => {
      const payload1 = getStaffPayload();

      const newStaffResponse = await server.post('/api/v1/staff').set('Cookie', cookie).send(payload1);
      const newStaff = newStaffResponse.body;

      const newPhoneNumber = `${Number(newStaff.phoneNumber) - 1}`;

      const response = await server.put(`/api/v1/staff/${newStaff.id}`).set('Cookie', cookie).send({
        phoneNumber: newPhoneNumber,
      });

      expect(response.status).toEqual(204);
      const [staffPhoneNumberQueryResult] = await execQuery(`
        SELECT phone_number AS "phoneNumber" FROM staff WHERE id = ${newStaff.id}
      `);
      const staffPhoneNumber = staffPhoneNumberQueryResult.phoneNumber;
      expect(staffPhoneNumber).toEqual(newPhoneNumber);
    });

    it('should update staff with the new address', async () => {
      const payload1 = getStaffPayload();
      const payload2 = getStaffPayload();
      const storePayload = getStorePayload();

      const newStaffResponse = await server.post('/api/v1/staff').set('Cookie', cookie).send(payload1);
      const newStaff = newStaffResponse.body;
      const newStoreResponse = await server.post('/api/v1/stores').set('Cookie', cookie).send(storePayload);
      const newStore = newStoreResponse.body;

      const staffAddressId = newStaff.address.id;

      await execQuery(`
        UPDATE staff SET store_id = ${newStore.id} WHERE id = ${newStaff.id}
      `);

      const response = await server.put(`/api/v1/staff/${newStaff.id}`).set('Cookie', cookie).send({
        address: payload2.address,
      });

      expect(response.status).toEqual(204);

      const updatedStaffAddress = await queryAddress(staffAddressId);
      expect(updatedStaffAddress).toEqual(payload2.address);
    });

    it('should not update staff with the address if it is outside the state of assigned store', async () => {
      const payload = getStaffPayload();
      const payload2 = getStaffPayload();
      const storePayload = getStorePayload();

      const newStaffResponse = await server.post('/api/v1/staff').set('Cookie', cookie).send(payload);
      const newStaff = newStaffResponse.body;
      const newStoreResponse = await server.post('/api/v1/stores').set('Cookie', cookie).send(storePayload);
      const newStore = newStoreResponse.body;

      await execQuery(`
        UPDATE staff SET store_id = ${newStore.id} WHERE id = ${newStaff.id}
      `);

      const response = await server
        .put(`/api/v1/staff/${newStaff.id}`)
        .set('Cookie', cookie)
        .send({
          address: {
            ...payload2.address,
            cityName: 'Melbourne',
            stateName: 'Victoria',
          },
        });

      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('Cannot assign staff to store outside state');
    });

    it('should not update staff with the address that belongs to a store', async () => {
      const payload = getStaffPayload();
      const newStaffResponse = await server.post('/api/v1/staff').set('Cookie', cookie).send(payload);
      const newStaff = newStaffResponse.body;

      const [existingStoreAddress] = await execQuery(`
        SELECT address.address_line AS "addressLine", city.city_name AS "cityName", 
        city.state_name AS "stateName", country.country_name AS country, 
        address.postal_code AS "postalCode"
        FROM store LEFT JOIN address ON store.address_id = address.id
        LEFT JOIN city ON address.city_id = city.id
        LEFT JOIN country ON city.country_id = country.id LIMIT 1
      `);

      const response = await server.put(`/api/v1/staff/${newStaff.id}`).set('Cookie', cookie).send({
        address: existingStoreAddress,
      });

      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('The address is in use by a store');
    });

    it('should not update staff with the address that belongs to other staff', async () => {
      const payload = getStaffPayload();
      const newStaffResponse = await server.post('/api/v1/staff').set('Cookie', cookie).send(payload);
      const newStaff = newStaffResponse.body;

      const [existingStaffAddress] = await execQuery(`
        SELECT address.address_line AS "addressLine", city.city_name AS "cityName", 
        city.state_name AS "stateName", country.country_name AS country, 
        address.postal_code AS "postalCode"
        FROM staff LEFT JOIN address ON staff.address_id = address.id
        LEFT JOIN city ON address.city_id = city.id
        LEFT JOIN country ON city.country_id = country.id LIMIT 1
      `);

      const response = await server.put(`/api/v1/staff/${newStaff.id}`).set('Cookie', cookie).send({
        address: existingStaffAddress,
      });

      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('The address is in use by other staff');
    });

    it('should not update staff with the phone number that is used by a store', async () => {
      const payload = getStaffPayload();
      const newStaffResponse = await server.post('/api/v1/staff').set('Cookie', cookie).send(payload);
      const newStaff = newStaffResponse.body;

      const [existingPhoneNumberQueryResult] = await execQuery(`
        SELECT phone_number AS "phoneNumber" FROM store LIMIT 1
      `);

      const existingPhoneNumberOfStore = existingPhoneNumberQueryResult.phoneNumber;

      const response = await server.put(`/api/v1/staff/${newStaff.id}`).set('Cookie', cookie).send({
        phoneNumber: existingPhoneNumberOfStore,
      });

      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('The phone number is in use by a store');
    });

    it('should not update staff with the phone number that is used by other staff', async () => {
      const payload = getStaffPayload();
      const newStaffResponse = await server.post('/api/v1/staff').set('Cookie', cookie).send(payload);
      const newStaff = newStaffResponse.body;

      const [existingPhoneNumberQueryResult] = await execQuery(`
        SELECT phone_number AS "phoneNumber" FROM staff LIMIT 1
      `);

      const existingPhoneNumberOfStaff = existingPhoneNumberQueryResult.phoneNumber;

      const response = await server.put(`/api/v1/staff/${newStaff.id}`).set('Cookie', cookie).send({
        phoneNumber: existingPhoneNumberOfStaff,
      });

      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('The phone number is in use by other staff');
    });

    it('should not update staff with email address that is used by other staff', async () => {
      const payload1 = getStaffPayload();
      const payload2 = getStaffPayload();
      const newStaff1Response = await server.post('/api/v1/staff').set('Cookie', cookie).send(payload1);
      const newStaff2Response = await server.post('/api/v1/staff').set('Cookie', cookie).send(payload2);

      const staff1 = newStaff1Response.body;
      const staff2 = newStaff2Response.body;

      const response = await server.put(`/api/v1/staff/${staff2.id}`).set('Cookie', cookie).send({
        email: staff1.email,
      });

      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('The email address is in use by other staff');
    });

    it('should not update staff with store that is outside state of the staff', async () => {
      const payload = getStaffPayload();
      const newStaffResponse = await server.post('/api/v1/staff').set('Cookie', cookie).send(payload);
      const newStaff = newStaffResponse.body;

      const [storeIdQueryResult] = await execQuery(`
        SELECT store.id
        FROM store LEFT JOIN address ON store.address_id = address.id
        LEFT JOIN city ON address.city_id = city.id
        WHERE city.state_name <> '${newStaff.address.stateName}'
      `);

      const storeId = storeIdQueryResult.id;
      const response = await server.put(`/api/v1/staff/${newStaff.id}`).set('Cookie', cookie).send({
        storeId,
      });
      expect(response.status).toEqual(400);
    });
  });

  describe('DELETE /staff/:id', () => {
    it('should delete the store', async () => {
      const payload = getStaffPayload();

      const newStaffResponse = await server.post('/api/v1/staff').set('Cookie', cookie).send(payload);
      const newStaff = newStaffResponse.body;

      // Address count before delete
      const [addrCountResultBeforeDelete] = await execQuery(`
        SELECT COUNT(*) FROM address LEFT JOIN city ON address.city_id = city.id
        WHERE address.address_line = '${newStaff.address.addressLine}'
        AND city.city_name = '${newStaff.address.cityName}'
        AND address.postal_code = '${newStaff.address.postalCode}'
      `);

      const [addrCountBeforeDelete] = addrCountResultBeforeDelete.count;
      expect(Number(addrCountBeforeDelete)).toEqual(1);

      // Staff count before delete
      const [staffCountResultBeforeDelete] = await execQuery(`SELECT COUNT(*) FROM staff WHERE id = ${newStaff.id}`);
      const staffCountBeforeDelete = staffCountResultBeforeDelete.count;
      expect(Number(staffCountBeforeDelete)).toEqual(1);

      const response = await server.delete(`/api/v1/staff/${newStaff.id}`).set('Cookie', cookie);
      expect(response.status).toEqual(204);

      // Address count after delete
      const [addrCountResultAfterDelete] = await execQuery(`
        SELECT COUNT(*) FROM address LEFT JOIN city ON address.city_id = city.id
        WHERE address.address_line = '${newStaff.address.addressLine}'
        AND city.city_name = '${newStaff.address.cityName}'
        AND address.postal_code = '${newStaff.address.postalCode}'
      `);

      const [addrCountAfterDelete] = addrCountResultAfterDelete.count;
      expect(Number(addrCountAfterDelete)).toEqual(0);

      // Staff count after delete
      const [staffCountResultAfterDelete] = await execQuery(`SELECT COUNT(*) FROM staff WHERE id = ${newStaff.id}`);
      const staffCountAfterDelete = staffCountResultAfterDelete.count;
      expect(Number(staffCountAfterDelete)).toEqual(0);
    });

    it('should not delete the staff if the staff is a manager of existing store', async () => {
      const payload = getStaffPayload();
      const storePayload = getStorePayload();

      const newStaffResposne = await server.post('/api/v1/staff').set('Cookie', cookie).send(payload);
      const newStaffId = newStaffResposne.body.id;

      await server
        .post('/api/v1/stores')
        .set('Cookie', cookie)
        .send({
          ...storePayload,
          storeManager: undefined,
          storeManagerId: newStaffId,
        });

      const response = await server.delete(`/api/v1/staff/${newStaffId}`).set('Cookie', cookie);
      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual('Staff is a manager of existing store');
    });
  });
});
