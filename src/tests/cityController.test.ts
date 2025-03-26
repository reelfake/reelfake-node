import supertest from 'supertest';

import app from '../app';
import * as dbQuery from '../utils/dbQuery';
import { execQuery, FIELD_MAP } from './testUtil';

const apiKey = process.env.API_KEY || '';

describe('Cities Controller', () => {
  it('GET /api/v1/cities should return a list of cities', async () => {
    const server = supertest(app);
    const response = await server.get('/api/v1/cities');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
    const expectedCities = await execQuery('SELECT * FROM city', FIELD_MAP.city);
    expect(response.body).toStrictEqual({
      items: expectedCities,
      length: expectedCities.length,
    });
  });

  it('GET /api/v1/cities should return 500 on exception', async () => {
    jest
      .spyOn(dbQuery, 'queryCities')
      .mockRejectedValue({ message: 'unit testing exception for /api/cities' });
    const server = supertest(app);
    const response = await server.get('/api/v1/cities');
    expect(response.status).toBe(500);
    expect(response.body.message).toEqual('unit testing exception for /api/cities');
  });
});
