import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app';
import { cleanUserTable, execQuery, FIELD_MAP } from './testUtil';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('User Controller', () => {
  const email = 'test@example.com';
  const password = 'test@12345';
  const server = supertest(app);

  jest.setTimeout(20000);

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
        .post('/api/v1/user/register')
        .send({
          email: email,
          password: password,
        })
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json');

      expect(response.statusCode).toBe(201);
      expect(response.body.message).toBe('User is registered successfully');

      const result = await execQuery(
        `SELECT user_email as "userEmail", user_password as "userPassword" FROM public.user WHERE user_email = '${email}'`
      );
      expect(result.length).toBe(1);
      expect(result[0].userEmail).toBe(email);
      const isPasswordMatch = await bcrypt.compare(password, result[0].userPassword);
      expect(isPasswordMatch).toBeTruthy();
    });

    it('POST /user/register should return 400 if user already exist', async () => {
      const server = supertest(app);

      await server
        .post('/api/v1/user/register')
        .send({
          email: email,
          password: password,
        })
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json');

      const response = await server
        .post('/api/v1/user/register')
        .send({
          email: email,
          password: password,
        })
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json');

      expect(response.status).toEqual(400);
      expect(response.body).toStrictEqual({
        message: 'User already exist',
        status: 'error',
      });
    });
  });

  describe('User login/logout', () => {
    beforeEach(async () => {
      await server
        .post('/api/v1/user/register')
        .send({
          email: email,
          password: password,
        })
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json');
    });

    it('POST /user/login should log in the user send the token in cookie', async () => {
      const response = await server
        .post('/api/v1/user/login')
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
        /^auth_token=([a-zA-Z0-9._-]*); Path=\/; HttpOnly; Secure; SameSite=Strict$/
      );
    });

    it('POST /user/login should return 401 when user try to login with invalid email', async () => {
      const response = await server
        .post('/api/v1/user/login')
        .send({
          email: 'doesnotexist@example.com',
          password: password,
        })
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json');
      expect(response.status).toBe(401);
      expect(response.body).toStrictEqual({
        message: 'Invalid credentials',
        status: 'error',
      });
    });

    it('POST /user/login should return 401 when user try to login with invalid password', async () => {
      const response = await server
        .post('/api/v1/user/login')
        .send({
          email: email,
          password: 'blah@12345',
        })
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json');
      expect(response.status).toBe(401);
      expect(response.body).toStrictEqual({
        message: 'Invalid credentials',
        status: 'error',
      });
    });

    it('GET /user/logout should log out the user by using the cookie in the request', async () => {
      let response = await server
        .post('/api/v1/user/login')
        .send({
          email: email,
          password: password,
        })
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json');

      const cookie = response.get('Set-Cookie')?.at(0);

      response = await server.get('/api/v1/user/logout').set('Cookie', cookie || '');
      expect(response.body).toStrictEqual({
        message: 'Logged out successfully',
      });
    });
  });

  describe('Assign customer, staff or manager staff to user', () => {
    beforeEach(async () => {
      await server
        .post('/api/v1/user/register')
        .send({
          email: email,
          password: password,
        })
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json');
    });

    const login = async (email: string, password: string) => {
      const response = await server.post('/api/v1/user/login').send({
        email,
        password,
      });
      const cookie = response.get('Set-Cookie')?.at(0) || '';
      return cookie;
    };

    const verifyPatch = async (payload: {
      customerId?: number;
      staffId?: number;
      storeManagerId?: number;
    }) => {
      const cookie = await login(email, password);

      const getUserResponseBefore = await server.get('/api/v1/user/me').set('Cookie', cookie);
      expect(getUserResponseBefore.body).toStrictEqual({
        userUUID: expect.stringMatching(uuidRegex),
        userEmail: email,
        customerId: null,
        staffId: null,
        storeManagerId: null,
      });

      const patchResponse = await server
        .patch('/api/v1/user/me')
        .set('Cookie', cookie)
        .send({
          ...payload,
        });
      expect(patchResponse.status).toBe(200);
      expect(patchResponse.body).toStrictEqual({
        message:
          'User data is updated successfully. You will need to log in again for the changes to take effect.',
      });

      const getUserResponseAfter = await server.get('/api/v1/user/me').set('Cookie', cookie);
      expect(getUserResponseAfter.body).toStrictEqual({
        userUUID: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
        ),
        userEmail: email,
        customerId: payload.customerId || null,
        staffId: payload.staffId || null,
        storeManagerId: payload.storeManagerId || null,
        ...payload,
      });
    };

    it('PATCH /user should update the customer id for the user', async () => {
      await verifyPatch({ customerId: 100 });
    });

    it('PATCH /user should update the staff id for the user', async () => {
      await verifyPatch({ staffId: 100 });
    });

    it('PATCH /user should update the manager staff id for the user', async () => {
      await verifyPatch({ storeManagerId: 100 });
    });

    it('PATCH /user should update customer, staff and manager staff id', async () => {
      await verifyPatch({ customerId: 98, staffId: 99, storeManagerId: 100 });
    });

    it('PATCH /user should not allow the use of customer id which is already assigned to other user', async () => {
      const email2 = 'test1@example.com';
      const password2 = 'test1@12345';
      const cookie = await login(email, password);

      await server.patch('/api/v1/user/me').set('Cookie', cookie).send({
        customerId: 100,
      });

      await server.post('/api/v1/user/register').send({
        email: email2,
        password: password2,
      });

      const cookie2 = await login(email2, password2);
      const patchResponse = await server.patch('/api/v1/user/me').set('Cookie', cookie2).send({
        customerId: 100,
      });

      expect(patchResponse.status).toEqual(400);
      expect(patchResponse.body).toStrictEqual({
        status: 'error',
        message: 'Another user with the same config already exist.',
      });
    });

    it('PATCH /user should return 400 when the request body is empty', async () => {
      const cookie = await login(email, password);

      const response = await server.patch('/api/v1/user/me').set('Cookie', cookie).send({
        customerId: null,
        staffId: null,
        storeManagerId: null,
      });

      expect(response.status).toEqual(400);
      expect(response.body).toStrictEqual({
        status: 'error',
        message: 'Either of customer, staff or manager staff id is required',
      });
    });
  });
});
