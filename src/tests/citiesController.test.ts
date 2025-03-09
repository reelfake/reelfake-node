import supertest from 'supertest';

import citiesMock from './mockData/citiesMock';
import app from '../app';
import * as dbQuery from '../utils/dbQuery';

const apiKey = process.env.API_KEY || '';

describe('Cities Controller', () => {
  it('GET /api/cities should return a list of cities', async () => {
    const server = supertest(app);
    const response = await server.get('/api/cities').set('api-key', apiKey);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
    expect(response.body).toStrictEqual({
      items: citiesMock.map((c) => ({
        id: c.id,
        cityName: c.cityName,
        stateName: c.stateName,
        countryId: c.countryId,
      })),
      length: citiesMock.length,
    });
  });

  it('GET /api/cities should return 500 on exception', async () => {
    jest
      .spyOn(dbQuery, 'queryCities')
      .mockRejectedValue({ message: 'unit testing exception for /api/cities' });
    const server = supertest(app);
    const response = await server.get('/api/cities').set('api-key', apiKey);
    expect(response.status).toBe(500);
    expect(response.body.message).toEqual('unit testing exception for /api/cities');
  });
});
