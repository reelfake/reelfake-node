import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app';
import { cleanUserTable, execQuery, FIELD_MAP } from './testUtil';

describe('Auth Controller', () => {
  jest.setTimeout(20000);

  beforeEach(async () => {
    await cleanUserTable();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('/auth', () => {
    it('POST /user/register should create a new user account', async () => {
      const email = 'test@example.com';
      const password = 'test@12345';
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
      const email = 'test@example.com';
      const password = 'test@12345';
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

    it('POST /user/login should log in the user send the token in cookie', async () => {
      const email = 'test@example.com';
      const password = 'test@12345';
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
      const email = 'test@example.com';
      const password = 'test@12345';
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
      const email = 'test@example.com';
      const password = 'test@12345';
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
      const email = 'test@example.com';
      const password = 'test@12345';
      const server = supertest(app);

      await server
        .post('/api/v1/user/register')
        .send({
          email: email,
          password: password,
        })
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json');

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
});
