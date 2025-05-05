import supertest from 'supertest';

import app from '../app';

describe('App', () => {
  it('GET /api/v1 should return api name and version', async () => {
    const server = supertest(app);
    const response = await server.get('/api/v1');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ name: 'reelfake-api', version: '1.0.0' });
  });

  it('GET /api/v1 should work using default port when PORT is not in environment variable', async () => {
    process.env.PORT = '';

    const server = supertest(app);
    const response = await server.get('/api/v1');
    expect(response.status).toBe(200);
  });
});
