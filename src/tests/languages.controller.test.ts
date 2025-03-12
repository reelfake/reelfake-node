import supertest from 'supertest';

import app from '../app';
import * as dbQuery from '../utils/dbQuery';
import { FIELD_MAP, execQuery } from './testUtil';

const apiKey = process.env.API_KEY || '';

describe('Movie Languages Controller', () => {
  it('GET /api/movie_languages should return all available languages', async () => {
    const server = supertest(app);
    const response = await server.get('/api/movie_languages').set('api-key', apiKey);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
    const expectedMovieLanguages = await execQuery(
      'SELECT * FROM movie_language',
      FIELD_MAP.movieLanguage
    );
    expect(response.body).toStrictEqual({
      items: expectedMovieLanguages.map((l) => ({
        id: l.id,
        languageName: l.languageName,
        languageCode: l.languageCode,
      })),
      length: expectedMovieLanguages.length,
    });
  });

  it('GET /api/movie_languages should return 500 on exception', async () => {
    jest
      .spyOn(dbQuery, 'queryMovieLanguages')
      .mockRejectedValue({ message: 'unit testing exception for /api/movie_languages' });
    const server = supertest(app);
    const response = await server.get('/api/movie_languages').set('api-key', apiKey);
    expect(response.status).toBe(500);
    expect(response.body.message).toEqual('unit testing exception for /api/movie_languages');
  });
});
