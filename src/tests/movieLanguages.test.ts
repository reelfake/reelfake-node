import supertest from 'supertest';

import movieLanguages from './mockData/movieLanguagesMock';
import app from '../app';
import * as dbQuery from '../utils/dbQuery';

const apiKey = process.env.API_KEY || '';

describe('Movie Languages Controller', () => {
  it('GET /api/movie_languages should return all available languages', async () => {
    const server = supertest(app);
    const response = await server.get('/api/movie_languages').set('api_key', apiKey);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
    expect(response.body).toStrictEqual({
      items: movieLanguages.map((l) => ({
        id: l.id,
        languageName: l.language_name,
        languageCode: l.iso_language_code,
      })),
      length: movieLanguages.length,
    });
  });

  it('GET /api/movie_languages should return 500 on exception', async () => {
    jest
      .spyOn(dbQuery, 'queryMovieLanguages')
      .mockRejectedValue({ message: 'unit testing exception for /api/movie_languages' });
    const server = supertest(app);
    const response = await server.get('/api/movie_languages').set('api_key', apiKey);
    expect(response.status).toBe(500);
    expect(response.body.message).toEqual('unit testing exception for /api/movie_languages');
  });
});
