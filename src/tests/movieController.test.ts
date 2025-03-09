import supertest from 'supertest';

import moviesMock from './mockData/moviesMock';
import app from '../app';
import * as dbQuery from '../utils/dbQuery';
import * as preferences from '../constants/preferences';

jest.mock('../constants/preferences', () => ({
  ITEMS_PER_PAGE_FOR_PAGINATION: 5,
}));

const apiKey = process.env.API_KEY || '';

describe('Movie Controller', () => {
  // afterEach(() => {
  //   jest.clearAllMocks();
  //   jest.resetAllMocks();
  // });

  it('GET /api/movies?page_number=1 should return movies for first page', async () => {
    const pageNumber = 1;
    const server = supertest(app);
    const response = await server
      .get(`/api/movies?page_number=${pageNumber}`)
      .set('api-key', apiKey);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
    const expectedMovies = moviesMock.slice(0, 5);
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
      totalItems: 20,
      totalPages: 4,
    });
  });

  it('GET /api/movies?page_number=1 should return movies with the page number and page items count in header', async () => {
    const pageNumber = 1;
    const server = supertest(app);
    const response = await server
      .get(`/api/movies?page_number=${pageNumber}`)
      .set('api-key', apiKey);
    expect(response.status).toBe(200);
    expect(Number(response.get('page-number'))).toBe(1);
    expect(Number(response.get('last-seen-id'))).toBe(5);
  });

  it('GET /api/movies should return 400 for missing page_number in query', async () => {
    const server = supertest(app);
    const response = await server.get('/api/movies').set('api-key', apiKey);
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Page number is required in the request');
  });

  it('GET /api/movies?page_number=x should return 400 for invalid page_number', async () => {
    const pageNumber = 'x';
    const server = supertest(app);
    const response = await server
      .get(`/api/movies?page_number=${pageNumber}`)
      .set('api-key', apiKey);
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Page number must be a valid non-zero number');
  });

  it('GET /api/movies?page_number=0 should return 400 for page_number being 0', async () => {
    const pageNumber = 0;
    const server = supertest(app);
    const response = await server
      .get(`/api/movies?page_number=${pageNumber}`)
      .set('api-key', apiKey);
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Page number must be a valid non-zero number');
  });

  it('GET /api/movies?page_number=2 should return 400 for missing last-seen-page in header', async () => {
    const pageNumber = 2;
    const server = supertest(app);
    const response = await server
      .get(`/api/movies?page_number=${pageNumber}`)
      .set({ 'api-key': apiKey, 'last-seen-id': '5' });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      'Last seen page number with last id are required when current page number is more than 1'
    );
  });

  it('GET /api/movies?page_number=2 should return 400 for missing last-seen-id in header', async () => {
    const pageNumber = 2;
    const server = supertest(app);
    const response = await server
      .get(`/api/movies?page_number=${pageNumber}`)
      .set({ 'api-key': apiKey, 'last-seen-page': '1' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      'Last seen page number with last id are required when current page number is more than 1'
    );
  });

  it('GET /api/movies should return 500 on exception', async () => {
    jest
      .spyOn(dbQuery, 'queryMoviesPage')
      .mockRejectedValue({ message: 'unit testing exception for /api/movies' });
    const server = supertest(app);
    const response = await server.get('/api/movies?page_number=1').set('api-key', apiKey);
    expect(response.status).toBe(500);
    expect(response.body.message).toEqual('unit testing exception for /api/movies');
  });
});
