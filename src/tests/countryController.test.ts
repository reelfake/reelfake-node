import supertest from 'supertest';

import app from '../app';
import * as dbQuery from '../utils/dbQuery';
import { execQuery } from './testUtil';

describe('Countries Controller', () => {
  it('GET /api/countries should return a list of countries', async () => {
    const server = supertest(app);
    const response = await server.get('/api/countries');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
    // id: 'id',
    // country_name: 'countryName',
    // iso_country_code: 'countryCode',
    const expectedCountries = await execQuery(
      'SELECT id, country_name AS "countryName", iso_country_code AS "countryCode" FROM country'
    );
    expect(response.body).toStrictEqual({
      items: expectedCountries,
      length: expectedCountries.length,
    });
  });

  it('GET /api/countries should return 500 on exception', async () => {
    jest.spyOn(dbQuery, 'queryCountries').mockRejectedValue({ message: 'unit testing exception for /api/countries' });
    const server = supertest(app);
    const response = await server.get('/api/countries');
    expect(response.status).toBe(500);
    expect(response.body.message).toEqual('unit testing exception for /api/countries');
  });
});
