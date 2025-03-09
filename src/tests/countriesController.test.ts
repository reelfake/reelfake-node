import supertest from 'supertest';

import countriesMock from './mockData/countriesMock';
import app from '../app';
import * as dbQuery from '../utils/dbQuery';

const apiKey = process.env.API_KEY || '';

describe('Countries Controller', () => {
  it('GET /api/countries should return a list of countries', async () => {
    const server = supertest(app);
    const response = await server.get('/api/countries').set('api-key', apiKey);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
    expect(response.body).toStrictEqual({
      items: countriesMock.map((c) => ({
        id: c.id,
        countryName: c.countryName,
        countryCode: c.countryCode,
      })),
      length: countriesMock.length,
    });
  });

  it('GET /api/countries should return 500 on exception', async () => {
    jest
      .spyOn(dbQuery, 'queryCountries')
      .mockRejectedValue({ message: 'unit testing exception for /api/countries' });
    const server = supertest(app);
    const response = await server.get('/api/countries').set('api-key', apiKey);
    expect(response.status).toBe(500);
    expect(response.body.message).toEqual('unit testing exception for /api/countries');
  });
});
