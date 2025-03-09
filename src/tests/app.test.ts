import supertest from 'supertest';

import app from '../app';

const apiKey = process.env.API_KEY || '';

describe('App', () => {
  it('GET /api should return api name and version', async () => {
    const server = supertest(app);
    const response = await server.get('/api').set('api-key', apiKey);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ name: 'reelfake-api', version: '1.0.0' });
  });

  it('GET /api should work using default port when PORT is not in environment variable', async () => {
    process.env.PORT = '';

    const server = supertest(app);
    const response = await server.get('/api').set('api-key', apiKey);
    expect(response.status).toBe(200);
  });

  it('GET /api should return 401 for missing api key in the header', async () => {
    const server = supertest(app);
    const response = await server.get('/api');
    expect(response.status).toBe(401);
  });
});
