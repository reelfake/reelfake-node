import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app';
import { cleanUserTable, execQuery, getRandomCharacters } from './testUtil';

describe('User Controller', () => {
  const firstName = 'Test';
  const lastName = 'User';
  const email = `test${getRandomCharacters(10)}@example.com`;
  const password = 'test@12345';
  const server = supertest(app);

  beforeEach(async () => {
    await cleanUserTable();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('User registration', () => {
    it('POST /user/register should create a new user account', async () => {
      const server = supertest(app);

      const response = await server
        .post('/api/user/register')
        .send({
          firstName,
          lastName,
          email: email,
          password: password,
        })
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json');
      expect(response.statusCode).toBe(201);
      expect(response.body.message).toBe('User is registered successfully');

      const result = await execQuery(
        `SELECT email as "userEmail", user_password as "userPassword" FROM public.user WHERE email = '${email}'`,
        true
      );
      expect(result.length).toBe(1);
      expect(result[0].userEmail).toBe(email);
      const isPasswordMatch = await bcrypt.compare(password, result[0].userPassword);
      expect(isPasswordMatch).toBeTruthy();
    });

    it('POST /user/register should return 400 if user already exist', async () => {
      const server = supertest(app);

      await server
        .post('/api/user/register')
        .send({
          firstName,
          lastName,
          email: email,
          password: password,
        })
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json');

      const response = await server
        .post('/api/user/register')
        .send({
          email: email,
          password: password,
        })
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json');
      expect(response.status).toEqual(400);
      expect(response.body.message).toStrictEqual('User with the given email already exist');
    });
  });

  describe('User login/logout', () => {
    beforeEach(async () => {
      await server
        .post('/api/user/register')
        .send({
          firstName,
          lastName,
          email: email,
          password: password,
        })
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json');
    });

    it('POST /auth/login should log in the user send the token in cookie', async () => {
      const response = await server
        .post('/api/auth/login')
        .send({
          email: email,
          password: password,
        })
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json');

      expect(response.statusCode).toBe(201);
      expect(response.body).toStrictEqual({
        message: 'Login successful',
      });

      const cookie = response.get('Set-Cookie')?.at(0);
      expect(cookie).toMatch(
        /^auth_token=([a-zA-Z0-9._-]*); Max-Age=([0-9]*); Path=\/; Expires=(.*) HttpOnly; Secure; SameSite=Strict$/
      );
    });

    it('POST /auth/login should return 401 when user try to login with invalid email', async () => {
      const response = await server
        .post('/api/auth/login')
        .send({
          email: 'doesnotexist@example.com',
          password: password,
        })
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json');
      expect(response.status).toBe(401);
      expect(response.body.message).toStrictEqual('Invalid email or password');
    });

    it('POST /auth/login should return 401 when user try to login with invalid password', async () => {
      const response = await server
        .post('/api/auth/login')
        .send({
          email: email,
          password: 'blah@12345',
        })
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json');
      expect(response.status).toBe(401);
      expect(response.body.message).toStrictEqual('Invalid email or password');
    });

    it('GET /auth/logout should log out the user by using the cookie in the request', async () => {
      let response = await server
        .post('/api/auth/login')
        .send({
          email: email,
          password: password,
        })
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json');

      const cookie = response.get('Set-Cookie')?.at(0);

      response = await server.get('/api/auth/logout').set('Cookie', cookie || '');
      expect(response.body.message).toStrictEqual('Logged out successfully');
    });

    it('GET /auth/logout should return 401 is user has not logged in', async () => {
      const response = await server.get('/api/auth/logout');
      expect(response.status).toEqual(401);
      expect(response.body).toEqual({
        status: 'error',
        message: 'Invalid or expired token',
      });
    });
  });

  describe('Assign customer, staff or manager staff to user', () => {
    beforeEach(async () => {
      await server
        .post('/api/user/register')
        .send({
          firstName,
          lastName,
          email: email,
          password: password,
        })
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json');
    });

    const login = async (email: string, password: string) => {
      const response = await server.post('/api/auth/login').send({
        email,
        password,
      });
      const cookie = response.get('Set-Cookie')?.at(0) || '';
      return cookie;
    };

    const verifyPatch = async (payload: { customerId?: number; staffId?: number; storeManagerId?: number }) => {
      const cookie = await login(email, password);
      const { customerId, staffId, storeManagerId } = payload;

      const getUserResponseBefore = await server.get('/api/user/me').set('Cookie', cookie);

      let totalRentalsForCustomer = null;
      if (customerId) {
        [{ count: totalRentalsForCustomer }] = await execQuery(`SELECT COUNT(*) FROM rental WHERE customer_id = ${customerId}`);
      }

      let totalRentalsForStaff = null;
      if (staffId) {
        [{ count: totalRentalsForStaff }] = await execQuery(`SELECT COUNT(*) FROM rental WHERE staff_id = ${staffId}`);
      }

      let totalRentalsForStoreManager = null;
      let totalStaffUnderStoreManager = null;
      if (storeManagerId) {
        [{ count: totalRentalsForStoreManager }] = await execQuery(
          `SELECT COUNT(*) FROM rental WHERE staff_id = ${storeManagerId}`
        );
        [{ count: totalStaffUnderStoreManager }] = await execQuery(
          `
            SELECT COUNT(staff.id) FROM staff LEFT JOIN store ON staff.store_id = store.id
            WHERE store.store_manager_id = ${storeManagerId} AND staff.id != ${storeManagerId}
          `
        );
      }

      expect(getUserResponseBefore.body).toStrictEqual({
        id: expect.any(Number),
        firstName,
        lastName,
        email: email,
        customer: null,
        staff: null,
        storeManager: null,
      });

      const patchResponse = await server
        .patch('/api/user/me')
        .set('Cookie', cookie)
        .send({
          ...payload,
        });

      expect(patchResponse.status).toBe(204);

      const getUserResponseAfter = await server.get('/api/user/me').set('Cookie', cookie);
      expect(getUserResponseAfter.body).toStrictEqual({
        id: expect.any(Number),
        firstName,
        lastName,
        email: email,
        customer: customerId ? { id: customerId, totalRentals: Number(totalRentalsForCustomer) } : null,
        staff: staffId ? { id: staffId, totalProcessedRentals: Number(totalRentalsForStaff) } : null,
        storeManager: storeManagerId
          ? {
              id: storeManagerId,
              totalProcessedRentals: Number(totalRentalsForStoreManager),
              totalStaff: Number(totalStaffUnderStoreManager),
            }
          : null,
      });
    };

    it('should update the customer id for the user', async () => {
      await verifyPatch({ customerId: 100 });
    });

    it('should update the staff id for the user', async () => {
      await verifyPatch({ staffId: 100 });
    });

    it('should update the manager staff id for the user', async () => {
      const [{ storeManagerId }] = await execQuery(
        `SELECT staff.id as "storeManagerId" FROM store LEFT OUTER JOIN staff ON store.store_manager_id = staff.id 
        WHERE staff.active = true LIMIT 1`
      );

      await verifyPatch({ storeManagerId: Number(storeManagerId) });
    });

    it('should update customer, staff and manager staff id', async () => {
      const [{ storeManagerId }] = await execQuery(
        `SELECT staff.id as "storeManagerId" FROM store LEFT OUTER JOIN staff ON store.store_manager_id = staff.id 
        WHERE staff.active = true LIMIT 1`
      );
      await verifyPatch({ customerId: 98, staffId: 99, storeManagerId: Number(storeManagerId) });
    });

    it('should not allow the use of customer id which is already assigned to other user', async () => {
      const email2 = 'test1@example.com';
      const password2 = 'test1@12345';
      const cookie = await login(email, password);

      await server.patch('/api/user/me').set('Cookie', cookie).send({
        customerId: 100,
      });

      await server.post('/api/user/register').send({
        firstName,
        lastName,
        email: email2,
        password: password2,
      });

      const cookie2 = await login(email2, password2);
      const patchResponse = await server.patch('/api/user/me').set('Cookie', cookie2).send({
        customerId: 100,
      });

      expect(patchResponse.status).toEqual(400);
      expect(patchResponse.body.message).toStrictEqual('Another user with the same config already exist');
    });

    it('should unassign customer, staff and store manager', async () => {
      const cookie = await login(email, password);

      await server.patch('/api/user/me').set('Cookie', cookie).send({
        customerId: null,
        staffId: null,
        storeManagerId: null,
      });

      const userAfterUpdate = await server.get('/api/user/me').set('Cookie', cookie);
      expect(userAfterUpdate.status).toEqual(200);
      expect(userAfterUpdate.body.customer).toBeNull();
      expect(userAfterUpdate.body.staff).toBeNull();
      expect(userAfterUpdate.body.storeManager).toBeNull();
    });
  });
});
