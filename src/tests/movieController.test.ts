import supertest from 'supertest';
import app from '../app';
import * as dbQuery from '../utils/dbQuery';
import {
  ITEMS_COUNT_PER_PAGE_FOR_TEST,
  execQuery,
  getRowsCount,
  queryMovieObject,
  FIELD_MAP,
  getRandomNumber,
} from './testUtil';

const apiKey = process.env.API_KEY || '';

describe('Movie Controller', () => {
  let movieIdOffest: number;
  jest.setTimeout(20000);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /movies', () => {
    it('GET /api/v1/movies should return movies page by page', async () => {
      const startingPage = 1;
      const server = supertest(app);
      const totalRows = await getRowsCount('v_movie');

      const iterations = 3;

      for (let i = startingPage; i < iterations + startingPage; i++) {
        const response = await server.get(`/api/v1/movies?pageNumber=${i}`);
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        const expectedMovies = await execQuery(
          `SELECT id, title, overview, runtime, release_date as "releaseDate", genres, countries_of_origin as "countriesOfOrigin", 
          language_code as language, popularity, rating_average as "ratingAverage", rating_count as "ratingCount",
          poster_url as "posterUrl", rental_rate as "rentalRate", rental_duration as "rentalDuration" 
          FROM v_movie ORDER BY id ASC LIMIT 50 OFFSET ${(i - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST}`,
          FIELD_MAP.movie
        );

        expect(response.body.length).toBe(expectedMovies.length);

        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: 50,
          totalItems: Number(totalRows),
          totalPages: Math.ceil(totalRows / 50),
        });
        expect(response.headers['rf-page-number']).toBe(`${i}`);
      }
    });

    it('GET /api/v1/movies should return for the correct page when jumping between pages', async () => {
      const pages = [3, 7, 4];
      const totalRows = await getRowsCount('v_movie');

      const server = supertest(app);

      for (const page of pages) {
        const response = await server.get(`/api/v1/movies?pageNumber=${page}`);
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        const expectedMovies = await execQuery(
          `
            SELECT id, title, overview, runtime, release_date as "releaseDate", genres, countries_of_origin as "countriesOfOrigin", 
            language_code as language, popularity, rating_average as "ratingAverage", rating_count as "ratingCount",
            poster_url as "posterUrl", rental_rate as "rentalRate", rental_duration as "rentalDuration" FROM v_movie 
            ORDER BY id ASC 
            LIMIT ${ITEMS_COUNT_PER_PAGE_FOR_TEST} 
            OFFSET ${(page - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST}
          `,
          FIELD_MAP.movie
        );

        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: 50,
          totalItems: Number(totalRows),
          totalPages: Math.ceil(totalRows / 50),
        });
        expect(response.headers['rf-page-number']).toBe(`${page}`);
      }
    });

    it('GET /api/v1/movies?releaseYear=2020 should return movies release in 2020 with pagination support', async () => {
      const startingPage = 1;
      const server = supertest(app);

      const totalRows = await getRowsCount(
        'v_movie',
        "release_date BETWEEN '2020-01-01' AND '2020-12-31'"
      );

      const iterations = 3;

      for (let i = startingPage; i < iterations + startingPage; i++) {
        const url =
          i > 1
            ? `/api/v1/movies?releaseYear=2020&pageNumber=${i}`
            : '/api/v1/movies?releaseYear=2020';

        const response = await server.get(url);
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        const expectedMovies = await execQuery(
          `
            SELECT id, title, overview, runtime, release_date as "releaseDate", genres, countries_of_origin as "countriesOfOrigin", 
            language_code as language, popularity, rating_average as "ratingAverage", rating_count as "ratingCount",
            poster_url as "posterUrl", rental_rate as "rentalRate", rental_duration as "rentalDuration" FROM v_movie 
            WHERE release_date BETWEEN '2020-01-01' AND '2020-12-31' 
            ORDER BY release_date, id ASC 
            LIMIT ${ITEMS_COUNT_PER_PAGE_FOR_TEST} OFFSET ${(i - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST}
          `,
          FIELD_MAP.movie
        );

        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: 50,
          totalItems: Number(totalRows),
          totalPages: Math.ceil(totalRows / 50),
        });
      }
    });

    it('GET /api/v1/movies?releaseYear=2020 should return for the correct page when jumping between pages', async () => {
      const pages = [3, 7, 4];
      const totalRows = await getRowsCount(
        'v_movie',
        "release_date BETWEEN '2020-01-01' AND '2020-12-31'"
      );

      const server = supertest(app);

      for (const page of pages) {
        const response = await server.get(`/api/v1/movies?releaseYear=2020&pageNumber=${page}`);
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        const expectedMovies = await execQuery(
          `
            SELECT id, title, overview, runtime, release_date as "releaseDate", genres, countries_of_origin as "countriesOfOrigin", 
            language_code as language, popularity, rating_average as "ratingAverage", rating_count as "ratingCount",
            poster_url as "posterUrl", rental_rate as "rentalRate", rental_duration as "rentalDuration" FROM v_movie
            WHERE release_date BETWEEN '2020-01-01' AND '2020-12-31'
            ORDER BY release_date, id ASC
            LIMIT 50 OFFSET ${(page - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST}
          `,
          FIELD_MAP.movie
        );

        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: 50,
          totalItems: Number(totalRows),
          totalPages: Math.ceil(totalRows / 50),
        });
        expect(response.get('rf-page-number')).toBe(`${page}`);
      }
    });

    it('GET /api/v1/movies?releaseYear=2020&genres=... should return movies under given genres', async () => {
      const startingPage = 1;

      const server = supertest(app);
      const totalRows = await getRowsCount(
        'v_movie',
        `release_date BETWEEN '2020-01-01' AND '2020-12-31' AND genres @> '{Action,Adventure}'`
      );

      const iterations = 3;

      for (let i = startingPage; i < iterations + startingPage; i++) {
        const url =
          i > 1
            ? `/api/v1/movies?releaseYear=2020&genres=action,adventure&pageNumber=${i}`
            : '/api/v1/movies?releaseYear=2020&genres=action,adventure';

        const response = await server.get(url);

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        const expectedMovies = await execQuery(
          `
            SELECT id, title, overview, runtime, release_date as "releaseDate", genres, countries_of_origin as "countriesOfOrigin", 
            language_code as language, popularity, rating_average as "ratingAverage", rating_count as "ratingCount",
            poster_url as "posterUrl", rental_rate as "rentalRate", rental_duration as "rentalDuration" FROM v_movie 
            WHERE release_date BETWEEN '2020-01-01' AND '2020-12-31' AND genres @> '{Action,Adventure}'
            ORDER BY release_date, id ASC
            LIMIT ${ITEMS_COUNT_PER_PAGE_FOR_TEST}
            OFFSET ${(i - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST}
          `,
          FIELD_MAP.movie
        );

        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: expectedMovies.length,
          totalItems: Number(totalRows),
          totalPages: Math.ceil(totalRows / ITEMS_COUNT_PER_PAGE_FOR_TEST),
        });
      }
    });

    it('GET /api/v1/movies?genres=... should return movies under given genres', async () => {
      const startingPage = 1;

      const server = supertest(app);
      const totalRows = await getRowsCount('v_movie', `genres @> '{Action,Adventure,Thriller}'`);

      const iterations = 3;

      for (let i = startingPage; i < iterations + startingPage; i++) {
        const url =
          i > 1
            ? `/api/v1/movies?genres=action,adventure,thriller&pageNumber=${i}`
            : '/api/v1/movies?genres=action,adventure,thriller';

        const response = await server.get(url);
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        const expectedMovies = await execQuery(
          `
            SELECT id, title, overview, runtime, release_date as "releaseDate", genres, countries_of_origin as "countriesOfOrigin", 
            language_code as language, popularity, rating_average as "ratingAverage", rating_count as "ratingCount",
            poster_url as "posterUrl", rental_rate as "rentalRate", rental_duration as "rentalDuration" FROM v_movie 
            WHERE genres @> '{Action,Adventure,Thriller}'
            ORDER BY id ASC
            LIMIT ${ITEMS_COUNT_PER_PAGE_FOR_TEST}
            OFFSET ${(i - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST}
          `,
          FIELD_MAP.movie
        );

        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: ITEMS_COUNT_PER_PAGE_FOR_TEST,
          totalItems: Number(totalRows),
          totalPages: Math.ceil(totalRows / ITEMS_COUNT_PER_PAGE_FOR_TEST),
        });
      }
    });

    it('GET /api/v1/movies?genres=... should return correct list when jumping between pages', async () => {
      const startingPage = 1;

      const server = supertest(app);
      const totalRows = await getRowsCount('v_movie', `genres @> '{Action,Adventure,Thriller}'`);

      const pages = [3, 7, 4];

      for (const page of pages) {
        const url =
          page > 1
            ? `/api/v1/movies?genres=action,adventure,thriller&pageNumber=${page}`
            : '/api/v1/movies?genres=action,adventure,thriller';

        const response = await server.get(url);

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        const expectedMovies = await execQuery(
          `
            WITH movies_with_row_number AS (
              SELECT ROW_NUMBER() OVER (ORDER BY id ASC) AS "rowNumber", * FROM v_movie 
              WHERE genres @> '{Action,Adventure,Thriller}'
            )
            SELECT id, title, overview, runtime, release_date as "releaseDate", genres, countries_of_origin as "countriesOfOrigin", 
            language_code as language, popularity, rating_average as "ratingAverage", rating_count as "ratingCount",
            poster_url as "posterUrl", rental_rate as "rentalRate", rental_duration as "rentalDuration" FROM movies_with_row_number 
            ORDER BY "rowNumber" ASC
            LIMIT ${ITEMS_COUNT_PER_PAGE_FOR_TEST}
            OFFSET ${(page - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST}
          `,
          FIELD_MAP.movie
        );
        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: ITEMS_COUNT_PER_PAGE_FOR_TEST,
          totalItems: Number(totalRows),
          totalPages: Math.ceil(totalRows / ITEMS_COUNT_PER_PAGE_FOR_TEST),
        });
      }
    });

    it('GET /api/v1/movies should return 404 when there are no more pages available', async () => {
      const server = supertest(app);
      const rowsCount = await getRowsCount('v_movie');
      let response = await server.get('/api/v1/movies');
      const totalPages = Number(response.body.totalPages);
      response = await server.get(`/api/v1/movies?pageNumber=${totalPages + 1}`).set({
        'rf-last-visited-page': String(totalPages),
        'rf-last-id-last-visited-page': String(rowsCount),
      });
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Page out of range');
    });

    it('GET /api/v1/movies should return 500 on exception', async () => {
      jest
        .spyOn(dbQuery, 'executeQuery')
        .mockRejectedValue({ message: 'unit testing exception for /api/v1/movies' });
      const server = supertest(app);
      const response = await server.get('/api/v1/movies?pageNumber=1');
      expect(response.status).toBe(500);
      expect(response.body.message).toEqual('unit testing exception for /api/v1/movies');
    });

    it('GET /api/v1/movies?releaseDates=... should return movies between the release dates with pagination', async () => {
      const startingPage = 1;
      const server = supertest(app);
      const totalRows = await getRowsCount(
        'v_movie',
        "release_date BETWEEN '2024-03-01' AND '2024-03-04'"
      );

      const iterations = 3;

      for (let i = startingPage; i < iterations + startingPage; i++) {
        const response = await server.get(
          `/api/v1/movies?releaseFrom=2024-03-01&releaseTo=2024-03-04&pageNumber=${i}`
        );
        const expectedMovies = await execQuery(
          `
            SELECT id, title, overview, runtime, release_date as "releaseDate", genres, countries_of_origin as "countriesOfOrigin", 
            language_code as language, popularity, rating_average as "ratingAverage", rating_count as "ratingCount",
            poster_url as "posterUrl", rental_rate as "rentalRate", rental_duration as "rentalDuration" FROM v_movie
            WHERE release_date BETWEEN '2024-03-01' AND '2024-03-04'
            ORDER BY release_date, id ASC
            LIMIT ${ITEMS_COUNT_PER_PAGE_FOR_TEST}
            OFFSET ${(i - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST}
          `,
          FIELD_MAP.movie
        );

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: ITEMS_COUNT_PER_PAGE_FOR_TEST,
          totalPages: Math.ceil(totalRows / ITEMS_COUNT_PER_PAGE_FOR_TEST),
          totalItems: Number(totalRows),
        });
      }
    });

    it('GET /api/v1/movies?releaseDates=... should return correct movies when jumping between pages', async () => {
      const server = supertest(app);
      const totalRows = await getRowsCount(
        'v_movie',
        "release_date BETWEEN '2024-03-01' AND '2024-03-04'"
      );

      const pages = [2, 5, 3];

      for (const page of pages) {
        const response = await server.get(
          `/api/v1/movies?releaseFrom=2024-03-01&releaseTo=2024-03-04&pageNumber=${page}`
        );
        const expectedMovies = await execQuery(
          `SELECT id, title, overview, runtime, release_date as "releaseDate", genres, countries_of_origin as "countriesOfOrigin", 
            language_code as language, popularity, rating_average as "ratingAverage", rating_count as "ratingCount",
            poster_url as "posterUrl", rental_rate as "rentalRate", rental_duration as "rentalDuration" FROM v_movie 
            WHERE release_date BETWEEN '2024-03-01' AND '2024-03-04' ORDER BY release_date, id ASC 
            LIMIT ${ITEMS_COUNT_PER_PAGE_FOR_TEST} 
            OFFSET ${(page - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST}`,
          FIELD_MAP.movie
        );
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: ITEMS_COUNT_PER_PAGE_FOR_TEST,
          totalPages: Math.ceil(totalRows / ITEMS_COUNT_PER_PAGE_FOR_TEST),
          totalItems: Number(totalRows),
        });
      }
    });

    it('GET /api/v1/movies?releaseDates=...&genres=... should return movies under given genres', async () => {
      const startingPage = 1;

      const server = supertest(app);
      const totalRows = await getRowsCount(
        'v_movie',
        `genres @> '{Action,Adventure}' AND release_date BETWEEN '2024-03-01' AND '2024-10-31'`
      );

      const iterations = 3;

      for (let i = startingPage; i < iterations + startingPage; i++) {
        const url =
          i > 1
            ? `/api/v1/movies?releaseFrom=2024-03-01&releaseTo=2024-10-31&genres=action,adventure&pageNumber=${i}`
            : '/api/v1/movies?releaseFrom=2024-03-01&releaseTo=2024-10-31&genres=action,adventure';

        const response = await server.get(url);
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        const expectedMovies = await execQuery(
          `
            SELECT id, title, overview, runtime, release_date as "releaseDate", genres, countries_of_origin as "countriesOfOrigin", 
            language_code as language, popularity, rating_average as "ratingAverage", rating_count as "ratingCount",
            poster_url as "posterUrl", rental_rate as "rentalRate", rental_duration as "rentalDuration" FROM v_movie 
            WHERE genres @> '{Action,Adventure}' AND release_date BETWEEN '2024-03-01' AND '2024-10-31'
            ORDER BY release_date, id ASC
            LIMIT ${ITEMS_COUNT_PER_PAGE_FOR_TEST}
            OFFSET ${(i - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST}
          `,
          FIELD_MAP.movie
        );

        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: expectedMovies.length,
          totalItems: Number(totalRows),
          totalPages: Math.ceil(totalRows / ITEMS_COUNT_PER_PAGE_FOR_TEST),
        });
      }
    });

    it('GET /api/v1/movies?genres=... should return correct list when jumping between pages', async () => {
      const server = supertest(app);
      const totalRows = await getRowsCount('v_movie', `genres @> '{Action,Adventure}'`);

      const pages = [3, 7, 4];

      for (const page of pages) {
        const url =
          page > 1
            ? `/api/v1/movies?genres=action,adventure&pageNumber=${page}`
            : '/api/v1/movies?genres=action,adventure';

        const response = await server.get(url);

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        const expectedMovies = await execQuery(
          `
            WITH movies_with_row_number AS (
              SELECT ROW_NUMBER() OVER (ORDER BY id ASC) AS "rowNumber", * FROM v_movie 
              WHERE genres @> '{Action,Adventure}'
            )
            SELECT id, title, overview, runtime, release_date as "releaseDate", genres, countries_of_origin as "countriesOfOrigin", 
            language_code as language, popularity, rating_average as "ratingAverage", rating_count as "ratingCount",
            poster_url as "posterUrl", rental_rate as "rentalRate", rental_duration as "rentalDuration" FROM movies_with_row_number 
            ORDER BY "rowNumber" ASC
            LIMIT ${ITEMS_COUNT_PER_PAGE_FOR_TEST}
            OFFSET ${(page - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST}
          `,
          FIELD_MAP.movie
        );
        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: ITEMS_COUNT_PER_PAGE_FOR_TEST,
          totalItems: Number(totalRows),
          totalPages: Math.ceil(totalRows / ITEMS_COUNT_PER_PAGE_FOR_TEST),
        });
      }
    });
  });

  describe('POST /movies', () => {
    beforeAll(async () => {
      const rows = await execQuery('SELECT id FROM movie ORDER BY id DESC LIMIT 1');
      const id = rows[0]['id'];
      movieIdOffest = Number(id);
    });

    afterAll(async () => {
      await execQuery(`DELETE FROM movie WHERE id > ${movieIdOffest}`);
    });

    it('POST /movies should create movie with the data in request body and token in cookie', async () => {
      const email = 'test@example.com';
      const password = 'test@12345';
      const tmdbId = getRandomNumber(5);
      const imdbId = `tt${getRandomNumber(4)}`;

      const newMovieData = {
        tmdbId: tmdbId,
        imdbId: imdbId,
        title: `Fast & Furious - ${getRandomNumber(5)}`,
        originalTitle: `Fast & Furious - ${getRandomNumber(5)}`,
        overview: 'Lorem Ipsum is simply dummy text of the printing and typesetting industry',
        runtime: 0,
        releaseDate: '2025-05-21',
        genres: ['Action', 'Adventure', 'Thriller'],
        countriesOfOrigin: ['us'],
        language: 'en',
        movieStatus: 'Post Production',
        popularity: 11.6313,
        budget: '400000000',
        revenue: '0',
        ratingAverage: 0,
        ratingCount: 0,
        posterUrl: 'https://image.tmdb.org/t/p/w500/z53D72EAOxGRqdr7KXXWp9dJiDe.jpg',
        rentalRate: 15.99,
        rentalDuration: 2,
      };

      const server = supertest(app);

      await server
        .post('/api/v1/user/register')
        .send({
          email: email,
          password: password,
        })
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json');

      const loginResponse = await server
        .post('/api/v1/user/login')
        .send({
          email: email,
          password: password,
        })
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json');

      const cookie = loginResponse.get('Set-Cookie');

      const response = await server
        .post('/api/v1/movies')
        .send(newMovieData)
        .set('Cookie', cookie?.at(0) || '')
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json');

      expect(response.statusCode).toBe(201);
      expect(response.body).toStrictEqual({ id: response.body.id, ...newMovieData });
    });

    // it('POST /movies should return 401 when adding movie but the token cookie is missing', async () => {});
  });

  describe('GET /movies returning status code 400', () => {
    it('GET /api/v1/movies should return 400 for invalid pageNumber', async () => {
      const pageNumber = 'x';
      const server = supertest(app);
      const response = await server.get(`/api/v1/movies?pageNumber=${pageNumber}`);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Page number should be a valid non-zero positive number');
    });

    it('GET /api/v1/movies should return 400 when pageNumber is 0', async () => {
      const pageNumber = 0;
      const server = supertest(app);
      const response = await server.get(`/api/v1/movies?pageNumber=${pageNumber}`);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Page number should be a valid non-zero positive number');
    });

    it('GET /movies should return 400 when releaseYear in query is invalid', async () => {
      const releaseYear = 'invalid';
      const server = supertest(app);
      const response = await server.get(`/api/v1/movies?releaseYear=${releaseYear}`);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid release year');
    });

    it('GET /movies should return 400 when genres in query is invalid', async () => {
      const invalidGenres = 'action,drama,invalid_genre';
      const server = supertest(app);
      const response = await server.get(`/api/v1/movies?genres=${invalidGenres}`);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('[invalid_genre] are invalid genres');
    });

    it('GET /movies should return 400 when releaseFrom is in query but releaseTo is missing', async () => {
      const server = supertest(app);
      const response = await server.get(`/api/v1/movies?releaseFrom=2024-05-01`);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        'To filter by release dates, release date from and to are required.'
      );
    });

    it('GET /movies should return 400 when releaseTo is in query but releaseFrom is missing', async () => {
      const server = supertest(app);
      const response = await server.get(`/api/v1/movies?releaseTo=2024-05-01`);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        'To filter by release dates, release date from and to are required.'
      );
    });

    it('GET /movies should return 400 when releaseYear and release dates both are in query', async () => {
      const server = supertest(app);
      const response = await server.get(
        `/api/v1/movies?releaseYear=2024&releaseFrom=2024-04-01&releaseTo=2024-05-01`
      );
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Release year and release dates cannot be used together');
    });

    it('GET /movies should return 400 when releaseFrom has invalid format in query', async () => {
      const server = supertest(app);
      const response = await server.get(
        `/api/v1/movies?releaseFrom=2024-04-xx&releaseTo=2024-05-01`
      );
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid release date');
    });

    it('GET /movies should return 400 when releaseTo has invalid format in query', async () => {
      const server = supertest(app);
      const response = await server.get(
        `/api/v1/movies?releaseFrom=2024-04-01&releaseTo=2024-xx-01`
      );
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid release date');
    });
  });

  describe('GET /movies/:id', () => {
    it('GET /movies/100 should return movie object for id 100', async () => {
      const server = supertest(app);
      const response = await server.get(`/api/v1/movies/100`);
      expect(response.status).toBe(200);
      expect(response.get('Content-Type')).toBe('application/json; charset=utf-8');
      const expectedMovieData = await queryMovieObject(100, FIELD_MAP.movie);
      if ('tmdbId' in expectedMovieData) {
        delete expectedMovieData['tmdbId'];
      }
      expect(response.body).toStrictEqual(expectedMovieData);
    });

    it('GET /movies/100?includeActors=false should return movie object without the actors', async () => {
      const server = supertest(app);
      const response = await server.get(`/api/v1/movies/100?includeActors=false`);
      expect(response.status).toBe(200);
      expect(response.get('Content-Type')).toBe('application/json; charset=utf-8');
      const expectedMovieData = await queryMovieObject(100, FIELD_MAP.movie);
      if ('tmdbId' in expectedMovieData) {
        delete expectedMovieData['tmdbId'];
      }
      expect(response.body).toStrictEqual(expectedMovieData);
    });

    it('GET /movies/100?includeActors=no should return movie object without the actors', async () => {
      const server = supertest(app);
      const response = await server.get(`/api/v1/movies/100?includeActors=no`);
      expect(response.status).toBe(200);
      expect(response.get('Content-Type')).toBe('application/json; charset=utf-8');
      const expectedMovieData = await queryMovieObject(100, FIELD_MAP.movie);
      if ('tmdbId' in expectedMovieData) {
        delete expectedMovieData['tmdbId'];
      }
      expect(response.body).toStrictEqual(expectedMovieData);
    });

    it('GET /movies/100?includeActors=0 should return movie object without the actors', async () => {
      const server = supertest(app);
      const response = await server.get(`/api/v1/movies/100?includeActors=0`);
      expect(response.status).toBe(200);
      expect(response.get('Content-Type')).toBe('application/json; charset=utf-8');
      const expectedMovieData = await queryMovieObject(100, FIELD_MAP.movie);
      if ('tmdbId' in expectedMovieData) {
        delete expectedMovieData['tmdbId'];
      }
      expect(response.body).toStrictEqual(expectedMovieData);
    });

    it('GET /movies/100?includeActors=true should return movie object with the actors', async () => {
      const server = supertest(app);
      const response = await server.get(`/api/v1/movies/100?includeActors=true`);
      expect(response.status).toBe(200);
      expect(response.get('Content-Type')).toBe('application/json; charset=utf-8');
      let queryResult = await execQuery(
        `
        SELECT *, public.get_actors(100) as actors FROM v_movie WHERE id = 100;
      `,
        FIELD_MAP.movie
      );
      const expectedMovieData = queryResult.at(0)!;
      if ('tmdbId' in expectedMovieData) {
        delete expectedMovieData['tmdbId'];
      }
      expect(response.body).toStrictEqual(expectedMovieData);
    });

    it('GET /movies/100?includeActors=yes should return movie object with the actors', async () => {
      const server = supertest(app);
      const response = await server.get(`/api/v1/movies/100?includeActors=yes`);
      expect(response.status).toBe(200);
      expect(response.get('Content-Type')).toBe('application/json; charset=utf-8');
      let queryResult = await execQuery(
        `
        SELECT *, public.get_actors(100) as actors FROM v_movie WHERE id = 100;
      `,
        FIELD_MAP.movie
      );
      const expectedMovieData = queryResult.at(0)!;
      if ('tmdbId' in expectedMovieData) {
        delete expectedMovieData['tmdbId'];
      }
      expect(response.body).toStrictEqual(expectedMovieData);
    });

    it('GET /movies/100?includeActors=1 should return movie object with the actors', async () => {
      const server = supertest(app);
      const response = await server.get(`/api/v1/movies/100?includeActors=1`);
      expect(response.status).toBe(200);
      expect(response.get('Content-Type')).toBe('application/json; charset=utf-8');
      let queryResult = await execQuery(
        `
        SELECT *, public.get_actors(100) as actors FROM v_movie WHERE id = 100;
      `,
        FIELD_MAP.movie
      );
      const expectedMovieData = queryResult.at(0)!;
      if ('tmdbId' in expectedMovieData) {
        delete expectedMovieData['tmdbId'];
      }
      expect(response.body).toStrictEqual(expectedMovieData);
    });

    it('GET /movies/:id/stores should return the movie stock count at all stores', async () => {
      const id = 680;
      const expectedResult = await execQuery(
        `
        SELECT s.id, i.id AS "inventoryId", m.id AS "movieId", a.address_line AS "addressLine", c.city_name AS "city",
        c.state_name AS "state", a.postal_code AS "postalCode", cy.country_name AS "country", s.phone_number AS "phoneNumber",
        i.stock_count AS "stock" FROM inventory AS i LEFT OUTER JOIN store AS s ON i.store_id = s.id
        LEFT OUTER JOIN v_movie AS m ON i.movie_id = m.id LEFT OUTER JOIN address AS a ON s.address_id = a.id
        LEFT OUTER JOIN city AS c on a.city_id = c.id LEFT OUTER JOIN country AS cy ON c.country_id = cy.id
        WHERE m.id = ${id} ORDER BY "stock" DESC, "id" ASC;
      `,
        {}
      );

      const server = supertest(app);
      const response = await server.get(`/api/v1/movies/${id}/stores`);
      expect(response.status).toBe(200);
      expect(response.get('Content-Type')).toBe('application/json; charset=utf-8');

      expect(response.body).toStrictEqual({
        items: expectedResult,
        length: expectedResult.length,
      });
    });
  });

  describe('GET /movies/:id returning status code 4xx', () => {
    it('GET /movie/abc should return 400 since the movie id is not valid', async () => {
      const server = supertest(app);
      const response = await server.get(`/api/v1/movies/abc`);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        'Invalid movie id. Movie id must be a non-zero positive number.'
      );
    });

    it('GET /movies/100?includeActors=blahblah should return 400 since the includeActors flag has invalid value', async () => {
      const server = supertest(app);
      const response = await server.get(`/api/v1/movies/100?includeActors=blahblahck`);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        'Invalid value for includeActors in query. Please refer to api specs for more information.'
      );
    });

    it('GET /movies/10394829 should return 404 since movie with the given id does not exist', async () => {
      const id = 10394829;
      const server = supertest(app);
      const response = await server.get(`/api/v1/movies/${id}`);
      expect(response.status).toBe(404);
      expect(response.body.message).toBe(`Movie with id ${id} does not exist`);
    });

    it('GET /movies/:id/stors should return 400 if id is invalid', async () => {
      const server = supertest(app);
      const response = await server.get(`/api/v1/movies/blah/stores`);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid movie id');
    });

    it('GET /movies/:id/stors should return 404 if movie is out of stock', async () => {
      const server = supertest(app);
      const response = await server.get(`/api/v1/movies/4294292372/stores`);
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Movie is out of stock');
    });
  });
});
