import supertest from 'supertest';

import moviesMock from './mockData/moviesMock';
import app from '../app';
import * as dbQuery from '../utils/dbQuery';

const apiKey = process.env.API_KEY || '';

describe('Movie Controller', () => {
  it('GET /api/movies?page_number=2&limit_per_page=5 should return movies by page with limit', async () => {
    const pageNumber = 2;
    const limitPerPage = 5;
    const server = supertest(app);
    const response = await server
      .get(`/api/movies?page_number=${pageNumber}&limit_per_page=${limitPerPage}`)
      .set('api_key', apiKey);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
    const expectedMovies = moviesMock.slice(
      pageNumber * limitPerPage,
      pageNumber * limitPerPage + limitPerPage
    );
    expect(response.body).toStrictEqual({
      items: expectedMovies.map((m) => ({
        id: m.id,
        imdbId: m.imdbId === null ? 'null' : m.imdbId,
        title: m.title,
        originalTitle: m.originalTitle,
        overview: m.overview,
        runtime: m.runtime,
        releaseDate: m.releaseDate,
        genres: `[${m.genres.join(',')}]`,
        country: `[${m.country.join(',')}]`,
        language: m.language,
        movieStatus: m.movieStatus,
        popularity: m.popularity,
        budget: m.budget,
        revenue: m.revenue,
        ratingAverage: m.ratingAverage,
        ratingCount: m.ratingCount,
        posterUrl: m.posterUrl,
        rentalRate: m.rentalRate,
        rentalDuration: m.rentalDuration,
      })),
      length: 5,
    });
  });

  it('GET /api/movies?limit_per_page=5 should return 400 for missing page_number in query', async () => {
    const limitPerPage = 5;
    const server = supertest(app);
    const response = await server
      .get(`/api/movies?limit_per_page=${limitPerPage}`)
      .set('api_key', apiKey);
    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      'Page number and limit per page are required in the request'
    );
  });

  it('GET /api/movies?page_number=2 should return 400 for missing limit_per_page in query', async () => {
    const pageNumber = 2;
    const server = supertest(app);
    const response = await server
      .get(`/api/movies?page_number=${pageNumber}`)
      .set('api_key', apiKey);
    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      'Page number and limit per page are required in the request'
    );
  });

  it('GET /api/movies?page_number=x&limit_per_page=5 should return 400 for invalid page_number', async () => {
    const pageNumber = 'x';
    const limitPerPage = 5;
    const server = supertest(app);
    const response = await server
      .get(`/api/movies?page_number=${pageNumber}&limit_per_page=${limitPerPage}`)
      .set('api_key', apiKey);
    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      'Page number and limit per page must be a valid non-zero number'
    );
  });

  it('GET /api/movies?page_number=2&limit_per_page=x should return 400 for invalid limit_per_page', async () => {
    const pageNumber = 2;
    const limitPerPage = 'x';
    const server = supertest(app);
    const response = await server
      .get(`/api/movies?page_number=${pageNumber}&limit_per_page=${limitPerPage}`)
      .set('api_key', apiKey);
    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      'Page number and limit per page must be a valid non-zero number'
    );
  });

  it('GET /api/movies?page_number=0&limit_per_page=5 should return 400 for page_number being 0', async () => {
    const pageNumber = 0;
    const limitPerPage = 5;
    const server = supertest(app);
    const response = await server
      .get(`/api/movies?page_number=${pageNumber}&limit_per_page=${limitPerPage}`)
      .set('api_key', apiKey);
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Page number must be a valid non-zero number');
  });

  it('GET /api/movies?page_number=2&limit_per_page=1 should return 400 for page_number being less than 2', async () => {
    const pageNumber = 2;
    const limitPerPage = 1;
    const server = supertest(app);
    const response = await server
      .get(`/api/movies?page_number=${pageNumber}&limit_per_page=${limitPerPage}`)
      .set('api_key', apiKey);
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('The limit per page must to be at least 2');
  });

  it('GET /api/movies should return 500 on exception', async () => {
    jest
      .spyOn(dbQuery, 'queryMovies')
      .mockRejectedValue({ message: 'unit testing exception for /api/movies' });
    const server = supertest(app);
    const response = await server
      .get('/api/movies?page_number=2&limit_per_page=5')
      .set('api_key', apiKey);
    expect(response.status).toBe(500);
    expect(response.body.message).toEqual('unit testing exception for /api/movies');
  });
});
