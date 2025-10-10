import supertest from 'supertest';

import app from '../app';
import * as dbQuery from '../utils/dbQuery';
import { execQuery } from './testUtil';

describe('Genre Controller', () => {
  it('GET /api/genres should return a list of available movie genres', async () => {
    const server = supertest(app);
    const response = await server.get('/api/genres');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
    const expectedGenres = await execQuery('SELECT id, genre_name AS "genreName" FROM genre');
    expect(response.body).toStrictEqual({
      items: expectedGenres,
      length: expectedGenres.length,
    });
  });

  it('GET /api/genres should return 500 on exception', async () => {
    jest.spyOn(dbQuery, 'queryGenres').mockRejectedValue({ message: 'unit testing exception for /api/genres' });
    const server = supertest(app);
    const response = await server.get('/api/genres');
    expect(response.status).toBe(500);
    expect(response.body.message).toEqual('unit testing exception for /api/genres');
  });
});
