import supertest from 'supertest';

import moviesMock from './mockData/moviesMock';
import app from '../app';
import * as MovieModel from '../models/movieModel';
import * as dbQuery from '../utils/movieQueries';

jest.mock('../constants/preferences', () => ({
  ITEMS_PER_PAGE_FOR_PAGINATION: 5,
}));

const apiKey = process.env.API_KEY || '';

describe('Movie Controller', () => {
  // afterEach(() => {
  //   jest.clearAllMocks();
  //   jest.resetAllMocks();
  // });

  describe('Movies pagination', () => {
    it('GET /api/movies?pageNumber=2 should return movies for second page', async () => {
      const pageNumber = 2;
      const server = supertest(app);
      const response = await server
        .get(`/api/movies?pageNumber=${pageNumber}`)
        .set('api-key', apiKey);
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      const expectedMovies = moviesMock
        .sort((movieA, movieB) => movieA.id - movieB.id)
        .slice(5, 10);
      expect(response.body).toStrictEqual({
        items: expectedMovies.map((m) => ({
          id: m.id,
          tmdbId: m.tmdbId,
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
        totalItems: moviesMock.length,
        totalPages: Math.ceil(moviesMock.length / 5),
      });
      expect(response.headers['rf-page-number']).toBe('2');
    });

    it('GET /api/movies should default page number to 1 and return movies for first page', async () => {
      const server = supertest(app);
      const response = await server.get(`/api/movies`).set('api-key', apiKey);
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      const expectedMovies = moviesMock.slice(0, 5);
      expect(response.body).toStrictEqual({
        items: expectedMovies.map((m) => ({
          id: m.id,
          tmdbId: m.tmdbId,
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
        totalItems: moviesMock.length,
        totalPages: Math.ceil(moviesMock.length / 5),
      });
      expect(response.headers['rf-page-number']).toBe('1');
    });

    it('GET /api/movies?pageNumber=x should return 400 for invalid page_number', async () => {
      const pageNumber = 'x';
      const server = supertest(app);
      const response = await server
        .get(`/api/movies?pageNumber=${pageNumber}`)
        .set('api-key', apiKey);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Page number should be a valid non-zero positive number');
    });

    it('GET /api/movies?pageNumber=0 should return 400 for pageNumber being 0', async () => {
      const pageNumber = 0;
      const server = supertest(app);
      const response = await server
        .get(`/api/movies?pageNumber=${pageNumber}`)
        .set('api-key', apiKey);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Page number should be a valid non-zero positive number');
    });

    it('GET /api/movies?pageNumber=100 should return 404 as it exceeded the available number of pages', async () => {
      const pageNumber = 100;
      const server = supertest(app);
      const response = await server
        .get(`/api/movies?pageNumber=${pageNumber}`)
        .set('api-key', apiKey);
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Page out of range');
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

  describe('Movies by release date pagination', () => {
    it('GET /api/movies/2020?pageNumber=0 should return 400 as page number must be greater 0', async () => {
      const pageNumber = 0;
      const server = supertest(app);
      const response = await server
        .get(`/api/movies/2020?pageNumber=${pageNumber}`)
        .set('api-key', apiKey);
      expect(response.status).toBe(400);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.body.message).toBe('Page number should be a valid non-zero positive number');
    });

    it('GET /api/movies/2020 should return movies release in 2020 with pagination support', async () => {
      const server = supertest(app);
      const response = await server.get(`/api/movies/2020`).set('api-key', apiKey);
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      const movies2020 = moviesMock.filter((m) => new Date(m.releaseDate).getFullYear() === 2020);
      const expectedMovies = movies2020
        .sort(
          (movieA, movieB) =>
            new Date(movieA.releaseDate).getTime() - new Date(movieB.releaseDate).getTime()
        )
        .slice(0, 5);

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
        length: expectedMovies.length,
        totalItems: movies2020.length,
        totalPages: Math.ceil(movies2020.length / 5),
      });
    });

    it('GET /api/movies/2020?pageNumber=2 should return second page', async () => {
      const server = supertest(app);
      const response = await server.get(`/api/movies/2020?pageNumber=2`).set('api-key', apiKey);
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      const movies2020 = moviesMock.filter((m) => new Date(m.releaseDate).getFullYear() === 2020);
      const expectedMovies = movies2020
        .sort(
          (movieA, movieB) =>
            new Date(movieA.releaseDate).getTime() - new Date(movieB.releaseDate).getTime()
        )
        .slice(5, 10);

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
        length: expectedMovies.length,
        totalItems: movies2020.length,
        totalPages: Math.ceil(movies2020.length / 5),
      });
    });

    it('GET /api/movies/2020 should return 500 if the sequelize instance is not present in the Movie model', async () => {
      jest.spyOn(MovieModel, 'default').mockReturnValue({ sequelize: undefined } as any);

      const server = supertest(app);
      const response = await server.get(`/api/movies/2020`).set('api-key', apiKey);
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Server encoutered unhandled exception');
    });
  });
});
