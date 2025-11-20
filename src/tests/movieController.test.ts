import fs from 'fs';
import supertest from 'supertest';
import path from 'path';
import { Transaction } from 'sequelize';
import app from '../app';
import {
  ITEMS_COUNT_PER_PAGE_FOR_TEST,
  execQuery,
  getRowsCount,
  getRandomNumber,
  getRandomCharacters,
  getRandomActors,
  getRandomDate,
  getStoreManagerCredential,
  getStaffCredential,
  getCustomerCredential,
  readCsv,
  deleteMoviesByTmdbId,
} from './testUtil';
import { CsvRow, ParsedCsvRow } from '../utils/upload';
import { MovieModel } from '../models';
import { availableCountries, availableGenres, availableMovieLanguages } from '../constants';
import { MovieActorPayload } from '../types';

type UploadEventData = {
  index: number;
  status: string;
  outcome: string;
  rowNumber: number;
  id: number;
  reasons: string[];
};

type UploadEventSummary = {
  index: number;
  status: string;
  totalRows: number;
  successRows: { rowNumber: number; id: number }[];
  failedRows: { rowNumber: number; reasons: string[] }[];
};

type ValidationEventData = {
  index: number;
  rowNumber: number;
  status: string;
  isValid: boolean;
  reasons: string[];
};

type ValidationEventSummary = {
  index: number;
  status: string | undefined;
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
};

const movieFields = [
  'tmdbId',
  'imdbId',
  'title',
  'originalTitle',
  'overview',
  'runtime',
  'releaseDate',
  'genreIds',
  'originCountryIds',
  'languageId',
  'movieStatus',
  'popularity',
  'budget',
  'revenue',
  'ratingAverage',
  'ratingCount',
  'posterUrl',
  'rentalRate',
];

describe('Movie Controller', () => {
  let cookie: string;
  const login = async (email: string, password: string) => {
    const loginResponse = await server.post('/api/auth/login').send({ email, password });
    cookie = loginResponse.get('Set-Cookie')?.at(0) || '';
  };

  const server = supertest(app);

  const getMoviePayload = async () => {
    const [highestTmdbIdQueryResult] = await execQuery(`
      SELECT MAX(tmdb_id) AS "highestTmdbId" FROM movie
    `);
    const highestTmdbId = highestTmdbIdQueryResult.highestTmdbId;
    const randomMovieTitle = `${getRandomCharacters(5)} ${getRandomCharacters(20)}`;

    return {
      tmdbId: highestTmdbId + 1,
      imdbId: `tt${getRandomNumber(4)}`,
      title: randomMovieTitle,
      originalTitle: randomMovieTitle,
      overview: 'Lorem Ipsum is simply dummy text of the printing and typesetting industry',
      runtime: 0,
      releaseDate: getRandomDate(1970, new Date().getFullYear()),
      genres: ['Action', 'Adventure', 'Thriller'],
      countriesOfOrigin: ['us'],
      language: 'en',
      movieStatus: 'Released',
      popularity: 11.6313,
      budget: '400000000',
      revenue: '0',
      ratingAverage: 0,
      ratingCount: 0,
      posterUrl: `https://image.tmdb.org/t/p/w500/${getRandomCharacters(27)}.jpg`,
      rentalRate: 15.99,
    };
  };

  beforeEach(() => {
    cookie = '';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    cookie = '';
  });

  describe('GET /movies', () => {
    it('should return movies page by page', async () => {
      const startingPage = 1;
      const totalRows = await getRowsCount('movie');
      const pageLimit = ITEMS_COUNT_PER_PAGE_FOR_TEST;

      const iterations = 3;

      for (let i = startingPage; i < iterations + startingPage; i++) {
        const response = await server.get(`/api/movies?page=${i}`);
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');

        const expectedMovies = await execQuery(`
            SELECT m.id, m.title, m.runtime, m.release_date AS "releaseDate", (
              SELECT ARRAY_AGG(g.genre_name) FROM unnest(m.genre_ids) AS g_ids LEFT JOIN genre AS g ON g.id = g_ids
            ) AS genres,
            (
              SELECT ARRAY_AGG(c.iso_country_code) FROM unnest(m.origin_country_ids) AS c_ids LEFT JOIN country AS c ON c.id = c_ids
            ) AS "countriesOfOrigin",
            ml.iso_language_code as language, m.popularity,
            m.rating_average AS "ratingAverage", m.rating_count AS "ratingCount", m.poster_url AS "posterUrl", m.rental_rate AS "rentalRate"
            FROM movie AS m LEFT JOIN movie_language AS ml ON m.language_id = ml.id
            GROUP BY m.id, ml.iso_language_code
            ORDER BY m.id ASC
            OFFSET ${i * pageLimit - pageLimit} LIMIT ${pageLimit};
          `);

        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: expectedMovies.length,
          pagination: {
            pageNumber: i,
            totalPages: Math.ceil(totalRows / pageLimit),
            totalItems: totalRows,
            itemsPerPage: pageLimit,
            next: `?page=${i + 1}`,
            prev: i > 1 ? `?page=${i - 1}` : null,
            first: '?page=first',
            last: '?page=last',
          },
        });
      }
    });

    it('should return for the correct page when jumping between pages', async () => {
      const pages = [3, 7, 4];
      const pageLimit = ITEMS_COUNT_PER_PAGE_FOR_TEST;
      const totalRows = await getRowsCount('movie');

      for (const i of pages) {
        const response = await server.get(`/api/movies?page=${i}`);
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');

        const expectedMovies = await execQuery(`
            SELECT m.id, m.title, m.runtime, m.release_date AS "releaseDate", (
              SELECT ARRAY_AGG(g.genre_name) FROM unnest(m.genre_ids) AS g_ids LEFT JOIN genre AS g ON g.id = g_ids
            ) AS genres,
            (
              SELECT ARRAY_AGG(c.iso_country_code) FROM unnest(m.origin_country_ids) AS c_ids LEFT JOIN country AS c ON c.id = c_ids
            ) AS "countriesOfOrigin",
            ml.iso_language_code as language, m.popularity,
            m.rating_average AS "ratingAverage", m.rating_count AS "ratingCount", m.poster_url AS "posterUrl", m.rental_rate AS "rentalRate"
            FROM movie AS m LEFT JOIN movie_language AS ml ON m.language_id = ml.id
            GROUP BY m.id, ml.iso_language_code
            ORDER BY m.id ASC
            OFFSET ${i * pageLimit - pageLimit} LIMIT ${pageLimit};
          `);

        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: expectedMovies.length,
          pagination: {
            pageNumber: i,
            totalPages: Math.ceil(totalRows / pageLimit),
            totalItems: totalRows,
            itemsPerPage: pageLimit,
            next: `?page=${i + 1}`,
            prev: i > 1 ? `?page=${i - 1}` : null,
            first: '?page=first',
            last: '?page=last',
          },
        });
      }
    });

    it('GET /api/movies?release_date=2020-01-01,2020-12-31 should return movies release in 2020 with pagination support', async () => {
      const startingPage = 1;
      const pageLimit = ITEMS_COUNT_PER_PAGE_FOR_TEST;
      const totalRows = await getRowsCount('movie', "release_date BETWEEN '2020-01-01' AND '2020-12-31'");

      const iterations = 3;

      for (let i = startingPage; i < iterations + startingPage; i++) {
        const url =
          i > 1 ? `/api/movies?release_date=2020-01-01,2020-12-31&page=${i}` : '/api/movies?release_date=2020-01-01,2020-12-31';

        const response = await server.get(url);
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        const expectedMovies = await execQuery(`
            SELECT m.id, m.title, m.runtime, m.release_date AS "releaseDate", (
              SELECT ARRAY_AGG(g.genre_name) FROM unnest(m.genre_ids) AS g_ids LEFT JOIN genre AS g ON g.id = g_ids
            ) AS genres,
            (
              SELECT ARRAY_AGG(c.iso_country_code) FROM unnest(m.origin_country_ids) AS c_ids LEFT JOIN country AS c ON c.id = c_ids
            ) AS "countriesOfOrigin",
            ml.iso_language_code as language, m.popularity,
            m.rating_average AS "ratingAverage", m.rating_count AS "ratingCount", m.poster_url AS "posterUrl", m.rental_rate AS "rentalRate"
            FROM movie AS m LEFT JOIN movie_language AS ml ON m.language_id = ml.id
            WHERE m.release_date BETWEEN '2020-01-01' AND '2020-12-31'
            GROUP BY m.id, ml.iso_language_code
            ORDER BY m.id ASC
            OFFSET ${i * pageLimit - pageLimit} LIMIT ${pageLimit};
          `);

        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: expectedMovies.length,
          pagination: {
            pageNumber: i,
            totalPages: Math.ceil(totalRows / pageLimit),
            totalItems: totalRows,
            itemsPerPage: pageLimit,
            next: `?page=${i + 1}&release_date=2020-01-01,2020-12-31`,
            prev: i > 1 ? `?page=${i - 1}&release_date=2020-01-01,2020-12-31` : null,
            first: '?page=first&release_date=2020-01-01,2020-12-31',
            last: '?page=last&release_date=2020-01-01,2020-12-31',
          },
        });
      }
    });

    it('GET /api/movies?release_date=2020-01-01,2020-12-31 should return for the correct page when jumping between pages', async () => {
      const pages = [3, 7, 4];
      const pageLimit = ITEMS_COUNT_PER_PAGE_FOR_TEST;
      const totalRows = await getRowsCount('movie', "release_date BETWEEN '2020-01-01' AND '2020-12-31'");

      for (const i of pages) {
        const response = await server.get(`/api/movies?release_date=2020-01-01,2020-12-31&page=${i}`);
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        const expectedMovies = await execQuery(`
            SELECT m.id, m.title, m.runtime, m.release_date AS "releaseDate", (
              SELECT ARRAY_AGG(g.genre_name) FROM unnest(m.genre_ids) AS g_ids LEFT JOIN genre AS g ON g.id = g_ids
            ) AS genres,
            (
              SELECT ARRAY_AGG(c.iso_country_code) FROM unnest(m.origin_country_ids) AS c_ids LEFT JOIN country AS c ON c.id = c_ids
            ) AS "countriesOfOrigin",
            ml.iso_language_code as language, m.popularity,
            m.rating_average AS "ratingAverage", m.rating_count AS "ratingCount", m.poster_url AS "posterUrl", m.rental_rate AS "rentalRate"
            FROM movie AS m LEFT JOIN movie_language AS ml ON m.language_id = ml.id
            WHERE m.release_date BETWEEN '2020-01-01' AND '2020-12-31'
            GROUP BY m.id, ml.iso_language_code
            ORDER BY m.id ASC
            OFFSET ${i * pageLimit - pageLimit} LIMIT ${pageLimit};
          `);

        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: expectedMovies.length,
          pagination: {
            pageNumber: i,
            totalPages: Math.ceil(totalRows / pageLimit),
            totalItems: totalRows,
            itemsPerPage: pageLimit,
            next: `?page=${i + 1}&release_date=2020-01-01,2020-12-31`,
            prev: i > 1 ? `?page=${i - 1}&release_date=2020-01-01,2020-12-31` : null,
            first: '?page=first&release_date=2020-01-01,2020-12-31',
            last: '?page=last&release_date=2020-01-01,2020-12-31',
          },
        });
      }
    });

    it('GET /api/movies?genres=action,sci_fi should return movies matching either of the given genres', async () => {
      const startingPage = 1;
      const pageLimit = ITEMS_COUNT_PER_PAGE_FOR_TEST;

      const totalRows = await getRowsCount('movie', `genre_ids && '{1,15}'`);

      const iterations = 3;

      for (let i = startingPage; i < iterations + startingPage; i++) {
        const url = i > 1 ? `/api/movies?genres=action,sci_fi&page=${i}` : '/api/movies?genres=action,sci_fi';

        const response = await server.get(url);

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        const expectedMovies = await execQuery(`
            SELECT m.id, m.title, m.runtime, m.release_date AS "releaseDate", (
              SELECT ARRAY_AGG(g.genre_name) FROM unnest(m.genre_ids) AS g_ids LEFT JOIN genre AS g ON g.id = g_ids
            ) AS genres,
            (
              SELECT ARRAY_AGG(c.iso_country_code) FROM unnest(m.origin_country_ids) AS c_ids LEFT JOIN country AS c ON c.id = c_ids
            ) AS "countriesOfOrigin",
            ml.iso_language_code as language, m.popularity,
            m.rating_average AS "ratingAverage", m.rating_count AS "ratingCount", m.poster_url AS "posterUrl", m.rental_rate AS "rentalRate"
            FROM movie AS m LEFT JOIN movie_language AS ml ON m.language_id = ml.id
            WHERE m.genre_ids && '{1,15}'
            GROUP BY m.id, ml.iso_language_code
            ORDER BY m.id ASC
            OFFSET ${i * pageLimit - pageLimit} LIMIT ${pageLimit};
          `);

        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: expectedMovies.length,
          pagination: {
            pageNumber: i,
            totalPages: Math.ceil(totalRows / pageLimit),
            totalItems: totalRows,
            itemsPerPage: pageLimit,
            next: `?page=${i + 1}&genres=action,sci_fi`,
            prev: i > 1 ? `?page=${i - 1}&genres=action,sci_fi` : null,
            first: '?page=first&genres=action,sci_fi',
            last: '?page=last&genres=action,sci_fi',
          },
        });
      }
    });

    it('GET /api/movies?genres=["action","sci_fi"] should return movies that belongs to all the given genres', async () => {
      const startingPage = 1;
      const pageLimit = ITEMS_COUNT_PER_PAGE_FOR_TEST;

      const totalRows = await getRowsCount('movie', `genre_ids @> '{1,15}'`);

      const iterations = 3;

      for (let i = startingPage; i < iterations + startingPage; i++) {
        const url = i > 1 ? `/api/movies?genres=["action","sci_fi"]&page=${i}` : '/api/movies?genres=["action","sci_fi"]';

        const response = await server.get(url);

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        const expectedMovies = await execQuery(`
            SELECT m.id, m.title, m.runtime, m.release_date AS "releaseDate", (
              SELECT ARRAY_AGG(g.genre_name) FROM unnest(m.genre_ids) AS g_ids LEFT JOIN genre AS g ON g.id = g_ids
            ) AS genres,
            (
              SELECT ARRAY_AGG(c.iso_country_code) FROM unnest(m.origin_country_ids) AS c_ids LEFT JOIN country AS c ON c.id = c_ids
            ) AS "countriesOfOrigin",
            ml.iso_language_code as language, m.popularity,
            m.rating_average AS "ratingAverage", m.rating_count AS "ratingCount", m.poster_url AS "posterUrl", m.rental_rate AS "rentalRate"
            FROM movie AS m LEFT JOIN movie_language AS ml ON m.language_id = ml.id
            WHERE m.genre_ids @> '{1,15}'
            GROUP BY m.id, ml.iso_language_code
            ORDER BY m.id ASC
            OFFSET ${i * pageLimit - pageLimit} LIMIT ${pageLimit};
          `);

        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: expectedMovies.length,
          pagination: {
            pageNumber: i,
            totalPages: Math.ceil(totalRows / pageLimit),
            totalItems: totalRows,
            itemsPerPage: pageLimit,
            next: `?page=${i + 1}&genres=["action","sci_fi"]`,
            prev: i > 1 ? `?page=${i - 1}&genres=["action","sci_fi"]` : null,
            first: '?page=first&genres=["action","sci_fi"]',
            last: '?page=last&genres=["action","sci_fi"]',
          },
        });
      }
    });

    it('GET /api/movies?countries=fr,us should return movies matching either of the given countries', async () => {
      const startingPage = 1;
      const pageLimit = ITEMS_COUNT_PER_PAGE_FOR_TEST;

      const totalRows = await getRowsCount('movie', `origin_country_ids && '{78,239}'`);

      const iterations = 3;

      for (let i = startingPage; i < iterations + startingPage; i++) {
        const url = i > 1 ? `/api/movies?countries=fr,us&page=${i}` : '/api/movies?countries=fr,us';

        const response = await server.get(url);

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        const expectedMovies = await execQuery(`
            SELECT m.id, m.title, m.runtime, m.release_date AS "releaseDate", (
              SELECT ARRAY_AGG(g.genre_name) FROM unnest(m.genre_ids) AS g_ids LEFT JOIN genre AS g ON g.id = g_ids
            ) AS genres,
            (
              SELECT ARRAY_AGG(c.iso_country_code) FROM unnest(m.origin_country_ids) AS c_ids LEFT JOIN country AS c ON c.id = c_ids
            ) AS "countriesOfOrigin",
            ml.iso_language_code as language, m.popularity,
            m.rating_average AS "ratingAverage", m.rating_count AS "ratingCount", m.poster_url AS "posterUrl", m.rental_rate AS "rentalRate"
            FROM movie AS m LEFT JOIN movie_language AS ml ON m.language_id = ml.id
            WHERE m.origin_country_ids && '{78,239}'
            GROUP BY m.id, ml.iso_language_code
            ORDER BY m.id ASC
            OFFSET ${i * pageLimit - pageLimit} LIMIT ${pageLimit};
          `);

        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: expectedMovies.length,
          pagination: {
            pageNumber: i,
            totalPages: Math.ceil(totalRows / pageLimit),
            totalItems: totalRows,
            itemsPerPage: pageLimit,
            next: `?page=${i + 1}&countries=fr,us`,
            prev: i > 1 ? `?page=${i - 1}&countries=fr,us` : null,
            first: '?page=first&countries=fr,us',
            last: '?page=last&countries=fr,us',
          },
        });
      }
    });

    it('GET /api/movies?countries=["fr","us"] should return movies that belongs to all the given countries', async () => {
      const startingPage = 1;
      const pageLimit = ITEMS_COUNT_PER_PAGE_FOR_TEST;

      const totalRows = await getRowsCount('movie', `origin_country_ids @> '{78,239}'`);

      const iterations = 3;

      for (let i = startingPage; i < iterations + startingPage; i++) {
        const url = i > 1 ? `/api/movies?countries=["fr","us"]&page=${i}` : '/api/movies?countries=["fr","us"]';

        const response = await server.get(url);

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        const expectedMovies = await execQuery(`
            SELECT m.id, m.title, m.runtime, m.release_date AS "releaseDate", (
              SELECT ARRAY_AGG(g.genre_name) FROM unnest(m.genre_ids) AS g_ids LEFT JOIN genre AS g ON g.id = g_ids
            ) AS genres,
            (
              SELECT ARRAY_AGG(c.iso_country_code) FROM unnest(m.origin_country_ids) AS c_ids LEFT JOIN country AS c ON c.id = c_ids
            ) AS "countriesOfOrigin",
            ml.iso_language_code as language, m.popularity,
            m.rating_average AS "ratingAverage", m.rating_count AS "ratingCount", m.poster_url AS "posterUrl", m.rental_rate AS "rentalRate"
            FROM movie AS m LEFT JOIN movie_language AS ml ON m.language_id = ml.id
            WHERE m.origin_country_ids @> '{78,239}'
            GROUP BY m.id, ml.iso_language_code
            ORDER BY m.id ASC
            OFFSET ${i * pageLimit - pageLimit} LIMIT ${pageLimit};
          `);

        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: expectedMovies.length,
          pagination: {
            pageNumber: i,
            totalPages: Math.ceil(totalRows / pageLimit),
            totalItems: totalRows,
            itemsPerPage: pageLimit,
            next: `?page=${i + 1}&countries=["fr","us"]`,
            prev: i > 1 ? `?page=${i - 1}&countries=["fr","us"]` : null,
            first: '?page=first&countries=["fr","us"]',
            last: '?page=last&countries=["fr","us"]',
          },
        });
      }
    });

    it('GET /api/movies?languages=en,fr should return a list of movies matching the given query', async () => {
      const startingPage = 1;
      const pageLimit = ITEMS_COUNT_PER_PAGE_FOR_TEST;

      const totalRows = await getRowsCount('movie', `language_id IN (40, 47)`);

      const iterations = 3;

      for (let i = startingPage; i < iterations + startingPage; i++) {
        const url = i > 1 ? `/api/movies?languages=fr,en&page=${i}` : '/api/movies?languages=fr,en';

        const response = await server.get(url);
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        const expectedMovies = await execQuery(`
            SELECT m.id, m.title, m.runtime, m.release_date AS "releaseDate", (
              SELECT ARRAY_AGG(g.genre_name) FROM unnest(m.genre_ids) AS g_ids LEFT JOIN genre AS g ON g.id = g_ids
            ) AS genres,
            (
              SELECT ARRAY_AGG(c.iso_country_code) FROM unnest(m.origin_country_ids) AS c_ids LEFT JOIN country AS c ON c.id = c_ids
            ) AS "countriesOfOrigin",
            ml.iso_language_code as language, m.popularity,
            m.rating_average AS "ratingAverage", m.rating_count AS "ratingCount", m.poster_url AS "posterUrl", m.rental_rate AS "rentalRate"
            FROM movie AS m LEFT JOIN movie_language AS ml ON m.language_id = ml.id
            WHERE m.language_id IN (40, 47)
            GROUP BY m.id, ml.iso_language_code
            ORDER BY m.id ASC
            OFFSET ${i * pageLimit - pageLimit} LIMIT ${pageLimit};
          `);

        expect(response.body).toStrictEqual({
          items: expectedMovies,
          length: expectedMovies.length,
          pagination: {
            pageNumber: i,
            totalPages: Math.ceil(totalRows / pageLimit),
            totalItems: totalRows,
            itemsPerPage: pageLimit,
            next: `?page=${i + 1}&languages=fr,en`,
            prev: i > 1 ? `?page=${i - 1}&languages=fr,en` : null,
            first: '?page=first&languages=fr,en',
            last: '?page=last&languages=fr,en',
          },
        });
      }
    });

    it('GET /api/movies should return 404 when there are no more pages available', async () => {
      let response = await server.get('/api/movies');
      const totalPages = Number(response.body.pagination.totalPages);
      response = await server.get(`/api/movies?page=${totalPages + 1}`);
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Page out of range');
    });

    it('GET /api/movies should return 500 on exception', async () => {
      jest.spyOn(MovieModel, 'getRowsCountWhere').mockRejectedValue({ message: 'unit testing exception for /api/movies' });
      const response = await server.get('/api/movies?page=1');
      expect(response.status).toBe(500);
      expect(response.body.message).toEqual('unit testing exception for /api/movies');
    });

    it('GET /api/movies should return 400 for invalid page number', async () => {
      const pageNumber = 'x';
      const response = await server.get(`/api/movies?page=${pageNumber}`);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid page number');
    });

    it('GET /api/movies should return 400 when page number is 0', async () => {
      const pageNumber = 0;
      const response = await server.get(`/api/movies?page=${pageNumber}`);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid page number');
    });

    it('GET /movies should return 400 when genres in query is invalid', async () => {
      const invalidGenres = 'action,drama,invalid_genre';
      const response = await server.get(`/api/movies?genres=${invalidGenres}`);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('[invalid_genre] are invalid genres');
    });
  });

  describe('GET /movies/:id', () => {
    const getMovieData = async (id: number, includeActors: boolean = false) => {
      const [actualMovieData] = await execQuery(`
        SELECT m.id AS "id", m.title AS "title", m.original_title AS "originalTitle",
        m.overview, m.runtime, m.release_date AS "releaseDate",
        ml.iso_language_code AS "language",
        m.movie_status AS "movieStatus",
        m.popularity,
        m.budget, m.revenue, m.rating_average AS "ratingAverage",
        m.rating_count AS "ratingCount", m.poster_url AS "posterUrl",
        m.rental_rate AS "rentalRate",
        ${
          includeActors
            ? `json_agg(
          json_build_object(
            'id', a.id,
            'actorName', a.actor_name,
            'characterName', ma.character_name,
            'castOrder', ma.cast_order,
            'profilePictureUrl', a.profile_picture_url
          )
        ) AS actors,`
            : ''
        }
        (SELECT json_agg(genre_name) FROM genre INNER JOIN unnest(m.genre_ids) AS g_ids ON genre.id = g_ids) AS genres,
        (
          SELECT json_agg(iso_country_code)
          FROM country INNER JOIN unnest(m.origin_country_ids) AS c_ids
          ON country.id = c_ids
        ) AS "countriesOfOrigin"
        FROM movie AS m LEFT JOIN movie_actor AS ma ON m.id = ma.movie_id
        LEFT JOIN actor AS a ON a.id = ma.actor_id
        LEFT JOIN movie_language AS ml ON ml.id = m.language_id
        WHERE m.id = ${id}
        GROUP BY m.id, ml.iso_language_code;
      `);
      return actualMovieData;
    };

    it('should return movie object with the actors', async () => {
      const response = await server.get(`/api/movies/100?include_actors=true`);
      expect(response.status).toBe(200);
      expect(response.get('Content-Type')).toBe('application/json; charset=utf-8');
      const actualMovieData = await getMovieData(100, true);
      expect(response.body).toStrictEqual(actualMovieData);
    });

    it('should return movie object without the actors', async () => {
      const response = await server.get(`/api/movies/100?include_actors=false`);
      expect(response.status).toBe(200);
      expect(response.get('Content-Type')).toBe('application/json; charset=utf-8');
      const actualMovieData = await getMovieData(100);
      expect(response.body).toStrictEqual(actualMovieData);
    });

    it('should return movie object without the actors', async () => {
      const response = await server.get(`/api/movies/100?include_actors=no`);
      expect(response.status).toBe(200);
      expect(response.get('Content-Type')).toBe('application/json; charset=utf-8');
      const actualMovieData = await getMovieData(100);
      expect(response.body).toStrictEqual(actualMovieData);
    });

    it('should return movie object without the actors', async () => {
      const response = await server.get(`/api/movies/100?include_actors=0`);
      expect(response.status).toBe(200);
      expect(response.get('Content-Type')).toBe('application/json; charset=utf-8');
      const actualMovieData = await getMovieData(100);
      expect(response.body).toStrictEqual(actualMovieData);
    });

    it('should return movie object with the actors', async () => {
      const response = await server.get(`/api/movies/100?include_actors=true`);
      expect(response.status).toBe(200);
      expect(response.get('Content-Type')).toBe('application/json; charset=utf-8');
      const actualMovieData = await getMovieData(100, true);
      expect(response.body).toStrictEqual(actualMovieData);
    });

    it('should return the movie stock count at all stores', async () => {
      const id = 680;

      const response = await server.get(`/api/movies/${id}/stores`);
      expect(response.status).toBe(200);
      expect(response.get('Content-Type')).toBe('application/json; charset=utf-8');

      const expectedResult = await execQuery(
        `
          SELECT i.id AS "inventoryId", i.stock_count AS stock, 
          json_build_object(
            'id', s.id,
            'storeManagerId', s.store_manager_id,
            'phoneNumber', s.phone_number, 
            'addressLine', a.address_line, 
            'city', c.city_name, 
            'state', c.state_name, 
            'country', cy.country_name, 
            'postalCode', a.postal_code
          ) as "store" FROM inventory AS i LEFT OUTER JOIN store AS s ON i.store_id = s.id
          LEFT OUTER JOIN address AS a ON s.address_id = a.id
          LEFT OUTER JOIN city AS c on a.city_id = c.id LEFT OUTER JOIN country AS cy ON c.country_id = cy.id
          WHERE i.movie_id = ${id} ORDER BY stock DESC, "inventoryId" ASC;
        `
      );

      expect(response.body).toStrictEqual({
        items: expectedResult,
        length: expectedResult.length,
      });
    });

    it('should return 400 since the movie id is not valid', async () => {
      const response = await server.get(`/api/movies/abc`);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid movie id. Movie id must be a non-zero positive number.');
    });

    it('should return 400 since the includeActors flag has invalid value', async () => {
      const response = await server.get(`/api/movies/100?include_actors=blahblahck`);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        'Invalid value for includeActors in query. Please refer to api specs for more information.'
      );
    });

    it('should return 404 since movie with the given id does not exist', async () => {
      const id = 10394829;
      const response = await server.get(`/api/movies/${id}`);
      expect(response.status).toBe(404);
      expect(response.body.message).toBe(`Movie with id ${id} does not exist`);
    });

    it('should return 400 if id is invalid', async () => {
      const response = await server.get(`/api/movies/blah/stores`);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid movie id');
    });

    it('should return 404 if movie is out of stock', async () => {
      const response = await server.get(`/api/movies/4294292372/stores`);
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Movie is out of stock');
    });
  });

  describe('POST /movies', () => {
    it('should create movie with the data in request body and token in cookie', async () => {
      const moviePayload = await getMoviePayload();

      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const response = await server
        .post('/api/movies')
        .send(moviePayload)
        .set('Cookie', cookie)
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json');

      const newMovieId = response.body.id;
      const [actualMovieData] = await execQuery(`
        SELECT m.id, m.tmdb_id AS "tmdbId", m.title, m.original_title AS "originalTitle",
        m.overview, m.runtime, m.release_date AS "releaseDate", array_agg(g.genre_name) AS "genres", 
        array_agg(DISTINCT c.iso_country_code) AS "countriesOfOrigin", l.iso_language_code AS "language",
        m.movie_status AS "movieStatus", m.popularity, m.budget, m.revenue,
        m.rating_average AS "ratingAverage", m.rating_count AS "ratingCount",
        m.poster_url AS "posterUrl", m.rental_rate AS "rentalRate"
        FROM movie AS m LEFT JOIN genre AS g ON g.id = ANY(m.genre_ids)
        LEFT JOIN country AS c ON c.id = ANY(m.origin_country_ids)
        LEFT JOIN movie_language AS l ON m.language_id = l.id
        WHERE m.id = ${newMovieId}
        GROUP BY m.id, m.tmdb_id, m.imdb_id, m.title, m.original_title, m.overview, l.iso_language_code, m.runtime, 
        m.release_Date, m.movie_status, m.popularity, m.budget, m.revenue, m.rating_average, m.rating_count,
        m.poster_url, m.rental_rate;  
      `);

      expect(response.statusCode).toBe(201);
      expect(response.body).toStrictEqual(actualMovieData);
    });

    it('should create movies with actors', async () => {
      const actors = await getRandomActors(5);
      const moviePayload = await getMoviePayload();

      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const response = await server
        .post('/api/movies')
        .send({
          ...moviePayload,
          actors,
        })
        .set('Cookie', cookie);

      const newMovieId = response.body.id;

      const [actualMovieData] = await execQuery(`
        SELECT m.id AS "id", m.title AS "title", m.original_title AS "originalTitle",
        m.overview, m.runtime, m.release_date AS "releaseDate",
        ml.iso_language_code AS "language",
        m.movie_status AS "movieStatus",
        m.popularity,
        m.budget, m.revenue, m.rating_average AS "ratingAverage",
        m.rating_count AS "ratingCount", m.poster_url AS "posterUrl",
        m.rental_rate AS "rentalRate",
        json_agg(
          json_build_object(
            'id', a.id,
            'actorName', a.actor_name,
            'characterName', ma.character_name,
            'castOrder', ma.cast_order,
            'profilePictureUrl', a.profile_picture_url
          )
        ) AS actors,
        (SELECT json_agg(genre_name) FROM genre INNER JOIN unnest(m.genre_ids) AS g_ids ON genre.id = g_ids) AS genres,
        (
          SELECT json_agg(iso_country_code)
          FROM country INNER JOIN unnest(m.origin_country_ids) AS c_ids
          ON country.id = c_ids
        ) AS "countriesOfOrigin"
        FROM movie AS m LEFT JOIN movie_actor AS ma ON m.id = ma.movie_id
        LEFT JOIN actor AS a ON a.id = ma.actor_id
        LEFT JOIN movie_language AS ml ON ml.id = m.language_id
        WHERE m.id = ${newMovieId}
        GROUP BY m.id, ml.iso_language_code;
      `);
      expect(response.body).toEqual(actualMovieData);
    });

    it('should not let staff to create movie', async () => {
      const moviePayload = await getMoviePayload();

      const credential = await getStaffCredential();
      await login(credential.email, credential.password);

      const response = await server.post('/api/movies').send(moviePayload).set('Cookie', cookie);
      expect(response.status).toEqual(403);
      expect(response.body).toEqual({
        status: 'error',
        message: 'You are not authorized to perform this operation',
      });
    });

    it('should not let customer to create movie', async () => {
      const moviePayload = await getMoviePayload();

      const credential = await getCustomerCredential();
      await login(credential.email, credential.password);

      const response = await server.post('/api/movies').send(moviePayload).set('Cookie', cookie);
      expect(response.status).toEqual(403);
      expect(response.body).toEqual({
        status: 'error',
        message: 'You are not authorized to perform this operation',
      });
    });
  });

  describe('PUT /movies/:id', () => {
    afterEach(() => {
      cookie = '';
    });

    it('should update title and original title of the movie with the payload', async () => {
      const newMoviePayload = await getMoviePayload();

      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const newMovieResponse = await server.post('/api/movies').set('Cookie', cookie).send(newMoviePayload);
      const newMovieId = newMovieResponse.body.id;

      const [beforeUpdate] = await execQuery(`
        SELECT title, original_title AS "originalTitle" FROM movie WHERE id = ${newMovieId}
      `);

      expect(beforeUpdate.title).toEqual(newMovieResponse.body.title);
      expect(beforeUpdate.originalTitle).toEqual(newMovieResponse.body.originalTitle);

      const newMovieTitle = `${getRandomCharacters(5)} ${getRandomCharacters(10)} ${Date.now()}`;
      const response = await server.put(`/api/movies/${newMovieId}`).set('Cookie', cookie).send({
        title: newMovieTitle,
        originalTitle: newMovieTitle,
      });

      expect(response.status).toEqual(204);

      const [afterUpdate] = await execQuery(`
        SELECT title, original_title AS "originalTitle" FROM movie WHERE id = ${newMovieId}
      `);

      expect(afterUpdate.title).toEqual(newMovieTitle);
      expect(afterUpdate.originalTitle).toEqual(newMovieTitle);
    });

    it('should update genre of the movie', async () => {
      const newMoviePayload = await getMoviePayload();
      newMoviePayload.genres = ['Drama', 'Thriller'];

      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      let [genresQueryResult] = await execQuery(`
        SELECT json_agg(id) AS ids 
        FROM genre 
        WHERE genre_name IN (${newMoviePayload.genres.map((g) => `'${g}'`)})
      `);

      const newMovieResponse = await server.post('/api/movies').set('Cookie', cookie).send(newMoviePayload);
      const newMovieId = newMovieResponse.body.id;

      const [beforeUpdate] = await execQuery(`
        SELECT genre_ids AS "genreIds" FROM movie WHERE id = ${newMovieId}
      `);
      expect(beforeUpdate.genreIds).toEqual(genresQueryResult.ids);

      const newGenres = ['Action', 'Adventure', 'Science Fiction'];
      [genresQueryResult] = await execQuery(`
        SELECT json_agg(id) AS ids FROM genre WHERE genre_name IN (${newGenres.map((g) => `'${g}'`)})
      `);

      const response = await server.put(`/api/movies/${newMovieId}`).set('Cookie', cookie).send({
        genres: newGenres,
      });

      expect(response.status).toEqual(204);

      const [afterUpdate] = await execQuery(`
        SELECT genre_ids AS "genreIds" FROM movie WHERE id = ${newMovieId}
      `);

      expect(afterUpdate.genreIds).toEqual(genresQueryResult.ids);
    });

    it('should update genre of the movie when data in payload is mixed casing', async () => {
      const newMoviePayload = await getMoviePayload();
      newMoviePayload.genres = ['drAMA', 'THRILler'];

      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      let [genresQueryResult] = await execQuery(`
        SELECT json_agg(id) AS ids 
        FROM genre 
        WHERE genre_name IN (${newMoviePayload.genres.map((g) => `INITCAP('${g}')`)})
      `);

      const newMovieResponse = await server.post('/api/movies').set('Cookie', cookie).send(newMoviePayload);
      const newMovieId = newMovieResponse.body.id;

      const [beforeUpdate] = await execQuery(`
        SELECT genre_ids AS "genreIds" FROM movie WHERE id = ${newMovieId}
      `);
      expect(beforeUpdate.genreIds).toEqual(genresQueryResult.ids);

      const newGenres = ['actION', 'adVenTURE', 'science fictION'];
      [genresQueryResult] = await execQuery(`
        SELECT json_agg(id) AS ids 
        FROM genre 
        WHERE genre_name IN (${newGenres.map((g) => `INITCAP('${g}')`)})
      `);

      const response = await server.put(`/api/movies/${newMovieId}`).set('Cookie', cookie).send({
        genres: newGenres,
      });

      expect(response.status).toEqual(204);

      const [afterUpdate] = await execQuery(`
        SELECT genre_ids AS "genreIds" FROM movie WHERE id = ${newMovieId}
      `);

      expect(afterUpdate.genreIds).toEqual(genresQueryResult.ids);
    });

    it('should update the country of origin of the movie', async () => {
      const newMoviePayload = await getMoviePayload();
      newMoviePayload.countriesOfOrigin = ['US'];

      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      let [countriesQueryResult] = await execQuery(`
        SELECT json_agg(id) AS ids 
        FROM country 
        WHERE iso_country_code IN (${newMoviePayload.countriesOfOrigin.map((c) => `UPPER('${c}')`)})
      `);

      const newMovieResponse = await server.post('/api/movies').set('Cookie', cookie).send(newMoviePayload);
      const newMovieId = newMovieResponse.body.id;

      const [beforeUpdate] = await execQuery(`
        SELECT origin_country_ids AS "originCountryIds" FROM movie WHERE id = ${newMovieId}
      `);
      expect(beforeUpdate.originCountryIds).toEqual(countriesQueryResult.ids);
      const newOriginCountries = ['IN', 'AU'];
      [countriesQueryResult] = await execQuery(`
        SELECT json_agg(id) AS ids 
        FROM country 
        WHERE iso_country_code IN (${newOriginCountries.map((c) => `UPPER('${c}')`)})
      `);

      const response = await server.put(`/api/movies/${newMovieId}`).set('Cookie', cookie).send({
        countriesOfOrigin: newOriginCountries,
      });

      expect(response.status).toEqual(204);

      const [afterUpdate] = await execQuery(`
        SELECT origin_country_ids AS "originCountryIds" FROM movie WHERE id = ${newMovieId}
      `);

      const expectedValues = JSON.parse(JSON.stringify(afterUpdate.originCountryIds)).sort();
      const actualValues = JSON.parse(JSON.stringify(countriesQueryResult.ids)).sort();
      expect(expectedValues).toEqual(actualValues);
    });

    it('should update the country of origin of the movie when data in payload are mixed casing', async () => {
      const newMoviePayload = await getMoviePayload();
      newMoviePayload.countriesOfOrigin = ['US'];

      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      let [countriesQueryResult] = await execQuery(`
        SELECT json_agg(id) AS ids 
        FROM country 
        WHERE iso_country_code IN (${newMoviePayload.countriesOfOrigin.map((c) => `UPPER('${c}')`)})
      `);

      const newMovieResponse = await server.post('/api/movies').set('Cookie', cookie).send(newMoviePayload);
      const newMovieId = newMovieResponse.body.id;

      const [beforeUpdate] = await execQuery(`
        SELECT origin_country_ids AS "originCountryIds" FROM movie WHERE id = ${newMovieId}
      `);

      expect(beforeUpdate.originCountryIds).toEqual(countriesQueryResult.ids);
      const newOriginCountries = ['IN', 'au'];
      [countriesQueryResult] = await execQuery(`
        SELECT json_agg(id) AS ids 
        FROM country 
        WHERE iso_country_code IN (${newOriginCountries.map((c) => `UPPER('${c}')`)})
      `);

      const response = await server.put(`/api/movies/${newMovieId}`).set('Cookie', cookie).send({
        countriesOfOrigin: newOriginCountries,
      });

      expect(response.status).toEqual(204);

      const [afterUpdate] = await execQuery(`
        SELECT origin_country_ids AS "originCountryIds" FROM movie WHERE id = ${newMovieId}
      `);

      const expectedValues = JSON.parse(JSON.stringify(afterUpdate.originCountryIds)).sort();
      const actualValues = JSON.parse(JSON.stringify(countriesQueryResult.ids)).sort();
      expect(expectedValues).toEqual(actualValues);
    });

    it('should update the movie language of the movie', async () => {
      const newMoviePayload = await getMoviePayload();
      newMoviePayload.genres = ['Drama', 'Thriller'];

      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      let [languageQueryResult] = await execQuery(`
        SELECT id 
        FROM movie_language 
        WHERE iso_language_code = LOWER('${newMoviePayload.language}')
      `);

      const newMovieResponse = await server.post('/api/movies').set('Cookie', cookie).send(newMoviePayload);
      const newMovieId = newMovieResponse.body.id;

      const [beforeUpdate] = await execQuery(`
        SELECT language_id AS "languageId" FROM movie WHERE id = ${newMovieId}
      `);
      expect(beforeUpdate.languageId).toEqual(languageQueryResult.id);
      const newMovieLanguage = 'sd';
      [languageQueryResult] = await execQuery(`
        SELECT id 
        FROM movie_language 
        WHERE iso_language_code = LOWER('${newMovieLanguage}')
      `);

      const response = await server.put(`/api/movies/${newMovieId}`).set('Cookie', cookie).send({
        language: newMovieLanguage,
      });

      expect(response.status).toEqual(204);

      const [afterUpdate] = await execQuery(`
        SELECT language_id AS "languageId" FROM movie WHERE id = ${newMovieId}
      `);

      expect(afterUpdate.languageId).toEqual(languageQueryResult.id);
    });

    it('should update the movie language of the movie when data in payload is upper case', async () => {
      const newMoviePayload = await getMoviePayload();
      newMoviePayload.genres = ['Drama', 'Thriller'];

      let [languageQueryResult] = await execQuery(`
        SELECT id 
        FROM movie_language 
        WHERE iso_language_code = LOWER('${newMoviePayload.language}')
      `);

      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const newMovieResponse = await server.post('/api/movies').set('Cookie', cookie).send(newMoviePayload);
      expect(newMovieResponse.status).toEqual(201);
      const newMovieId = newMovieResponse.body.id;

      const [beforeUpdate] = await execQuery(`
        SELECT language_id AS "languageId" FROM movie WHERE id = ${newMovieId}
      `);
      expect(beforeUpdate.languageId).toEqual(languageQueryResult.id);
      const newMovieLanguage = 'SD';
      [languageQueryResult] = await execQuery(`
        SELECT id 
        FROM movie_language 
        WHERE iso_language_code = LOWER('${newMovieLanguage}')
      `);

      const response = await server.put(`/api/movies/${newMovieId}`).set('Cookie', cookie).send({
        language: newMovieLanguage,
      });

      expect(response.status).toEqual(204);

      const [afterUpdate] = await execQuery(`
        SELECT language_id AS "languageId" FROM movie WHERE id = ${newMovieId}
      `);

      expect(afterUpdate.languageId).toEqual(languageQueryResult.id);
    });

    it('should not let staff to update the movie', async () => {
      const newMoviePayload = await getMoviePayload();

      let credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const newMovieResponse = await server.post('/api/movies').set('Cookie', cookie).send(newMoviePayload);
      const newMovieId = newMovieResponse.body.id;

      credential = await getStaffCredential();
      await login(credential.email, credential.password);

      const response = await server
        .put(`/api/movies/${newMovieId}`)
        .set('Cookie', cookie)
        .send({
          title: `${newMoviePayload.title} UPDATED`,
        });

      expect(response.status).toEqual(403);
      expect(response.body).toEqual({
        status: 'error',
        message: 'You are not authorized to perform this operation',
      });
    });

    it('should not let customer to update the movie', async () => {
      const newMoviePayload = await getMoviePayload();

      let credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const newMovieResponse = await server.post('/api/movies').set('Cookie', cookie).send(newMoviePayload);
      const newMovieId = newMovieResponse.body.id;

      credential = await getCustomerCredential();
      await login(credential.email, credential.password);

      const response = await server
        .put(`/api/movies/${newMovieId}`)
        .set('Cookie', cookie)
        .send({
          title: `${newMoviePayload.title} UPDATED`,
        });

      expect(response.status).toEqual(403);
      expect(response.body).toEqual({
        status: 'error',
        message: 'You are not authorized to perform this operation',
      });
    });
  });

  describe('DELETE /movies/:id', () => {
    const createTestActor = async (actorPayload: MovieActorPayload, movieId?: number) => {
      const newActorResponse = await server
        .post('/api/actors')
        .set('Cookie', cookie)
        .send({
          ...actorPayload,
          characterName: undefined,
          castOrder: undefined,
        });
      expect(newActorResponse.status).toEqual(201);
      if (movieId) {
        const newMovieActorResponse = await server
          .post(`/api/actors/${newActorResponse.body.id}/add_to_movie`)
          .set('Cookie', cookie)
          .send({ movieId, characterName: actorPayload.characterName, castOrder: actorPayload.castOrder });
        expect(newMovieActorResponse.status).toEqual(201);
      }

      const newActorId = newActorResponse.body.id;
      return newActorId;
    };

    it('should delete the movie', async () => {
      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const newMoviePayload = await getMoviePayload();
      const newMovieResponse = await server.post('/api/movies').set('Cookie', cookie).send(newMoviePayload);
      const newMovieId = newMovieResponse.body.id;
      let [movieQueryResult] = await execQuery(`
        SELECT COUNT(*) FROM movie WHERE id = ${newMovieId}  
      `);
      expect(Number(movieQueryResult.count)).toEqual(1);

      const response = await server.delete(`/api/movies/${newMovieId}`).set('Cookie', cookie);
      expect(response.status).toEqual(204);

      [movieQueryResult] = await execQuery(`
        SELECT COUNT(*) FROM movie WHERE id = ${newMovieId}  
      `);
      expect(Number(movieQueryResult.count)).toEqual(0);
    });

    it('should delete the movie and movie actors', async () => {
      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const newMoviePayload = await getMoviePayload();
      const newActors = await getRandomActors(5);
      const newMovieResponse = await server.post('/api/movies').set('Cookie', cookie).send(newMoviePayload);
      const newMovieId = newMovieResponse.body.id;

      // Verify new movie count
      let [movieQueryResult] = await execQuery(`
        SELECT COUNT(*) FROM movie WHERE id = ${newMovieId}  
      `);
      expect(Number(movieQueryResult.count)).toEqual(1);

      const newActorIds = [];
      for (const a of newActors) {
        const newActorId = await createTestActor(a, newMovieId);
        newActorIds.push(newActorId);
      }

      // Verify new actors count before delete
      let [actorsQueryResult] = await execQuery(`
        SELECT COUNT(*) FROM actor WHERE id IN (${newActorIds.join(',')})  
      `);
      expect(Number(actorsQueryResult.count)).toEqual(newActorIds.length);

      // Verify new movie cast count before delete
      let [movieActorsQueryResult] = await execQuery(`
        SELECT COUNT(*) FROM movie_actor WHERE movie_id = ${newMovieId}
      `);
      expect(Number(movieActorsQueryResult.count)).toEqual(newActorIds.length);

      // Delete movie
      await server.delete(`/api/movies/${newMovieId}`).set('Cookie', cookie);
      [movieQueryResult] = await execQuery(`
        SELECT COUNT(*) FROM movie WHERE id = ${newMovieId}  
      `);
      expect(Number(movieQueryResult.count)).toEqual(0);

      // Verify actors count after delete
      [actorsQueryResult] = await execQuery(`
        SELECT COUNT(*) FROM actor WHERE id IN (${newActorIds.join(',')})  
      `);
      expect(Number(actorsQueryResult.count)).toEqual(newActorIds.length);

      // Verify movie cast count after delete
      [movieActorsQueryResult] = await execQuery(`
        SELECT COUNT(*) FROM movie_actor WHERE movie_id = ${newMovieId}
      `);
      expect(Number(movieActorsQueryResult.count)).toEqual(0);
    });

    it('should delete the movie, movie actors and the inventory records', async () => {
      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const newMoviePayload = await getMoviePayload();
      const newActors = await getRandomActors(5);
      const newMovieResponse = await server.post('/api/movies').set('Cookie', cookie).send(newMoviePayload);
      const newMovieId = newMovieResponse.body.id;

      // Verify new movie count
      let [movieQueryResult] = await execQuery(`
        SELECT COUNT(*) FROM movie WHERE id = ${newMovieId}  
      `);
      expect(Number(movieQueryResult.count)).toEqual(1);

      const newActorIds = [];
      for (const a of newActors) {
        const newActorId = await createTestActor(a, newMovieId);
        newActorIds.push(newActorId);
      }

      // Verify new actors count before delete
      let [actorsQueryResult] = await execQuery(`
        SELECT COUNT(*) FROM actor WHERE id IN (${newActorIds.join(',')})  
      `);
      expect(Number(actorsQueryResult.count)).toEqual(newActorIds.length);

      // Verify new movie cast count before delete
      let [movieActorsQueryResult] = await execQuery(`
        SELECT COUNT(*) FROM movie_actor WHERE movie_id = ${newMovieId}
      `);
      expect(Number(movieActorsQueryResult.count)).toEqual(newActorIds.length);

      // Insert inventory rows
      await execQuery(`
        INSERT INTO inventory (movie_id, store_id, stock_count) VALUES (${newMovieId}, 1, 10)
      `);

      // Verify inventory count before delete
      let [inventoryQueryResult] = await execQuery(`
        SELECT COUNT(*) FROM inventory WHERE movie_id = ${newMovieId}
      `);
      expect(Number(inventoryQueryResult.count)).toEqual(1);

      // Delete movie
      await server.delete(`/api/movies/${newMovieId}`).set('Cookie', cookie);
      [movieQueryResult] = await execQuery(`
        SELECT COUNT(*) FROM movie WHERE id = ${newMovieId}  
      `);
      expect(Number(movieQueryResult.count)).toEqual(0);

      // Verify actors count after delete
      [actorsQueryResult] = await execQuery(`
        SELECT COUNT(*) FROM actor WHERE id IN (${newActorIds.join(',')})  
      `);
      expect(Number(actorsQueryResult.count)).toEqual(newActorIds.length);

      // Verify movie cast count after delete
      [movieActorsQueryResult] = await execQuery(`
        SELECT COUNT(*) FROM movie_actor WHERE movie_id = ${newMovieId}
      `);
      expect(Number(movieActorsQueryResult.count)).toEqual(0);

      // Verify inventory count after delete
      [inventoryQueryResult] = await execQuery(`
        SELECT COUNT(*) FROM inventory WHERE movie_id = ${newMovieId}
      `);
      expect(Number(inventoryQueryResult.count)).toEqual(0);
    });

    it('should not let staff to delete the movie', async () => {
      let credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const newMoviePayload = await getMoviePayload();
      const newMovieResponse = await server.post('/api/movies').set('Cookie', cookie).send(newMoviePayload);
      const newMovieId = newMovieResponse.body.id;

      credential = await getStaffCredential();
      await login(credential.email, credential.password);
      const response = await server.delete(`/api/movies/${newMovieId}`).set('Cookie', cookie);
      expect(response.status).toEqual(403);
      expect(response.body).toEqual({
        status: 'error',
        message: 'You are not authorized to perform this operation',
      });
    });

    it('should not let customer to delete the movie', async () => {
      let credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const newMoviePayload = await getMoviePayload();
      const newMovieResponse = await server.post('/api/movies').set('Cookie', cookie).send(newMoviePayload);
      const newMovieId = newMovieResponse.body.id;

      credential = await getCustomerCredential();
      await login(credential.email, credential.password);
      const response = await server.delete(`/api/movies/${newMovieId}`).set('Cookie', cookie);
      expect(response.status).toEqual(403);
      expect(response.body).toEqual({
        status: 'error',
        message: 'You are not authorized to perform this operation',
      });
    });
  });

  describe('POST /movies/upload', () => {
    const cleanUpMovies = async (filePath: string) => {
      const csvRows = await readCsv(filePath);
      const tmdbIds = csvRows.filter((r) => !isNaN(r.tmdbId)).map((r) => r.tmdbId);
      await deleteMoviesByTmdbId(tmdbIds);
    };

    it('should be able to upload the movies from csv file that has no errors', async () => {
      jest.spyOn(MovieModel, 'create').mockImplementation(
        // @ts-ignore
        async (
          row: ParsedCsvRow,
          options: { fields: string[]; ignoreDuplicates: boolean; validate: boolean; t?: Transaction }
        ) => {
          const getDataValue = (key: string) => {
            if (key === 'id') {
              return Number(row.tmdbId) * 2;
            }
            return row[key as keyof ParsedCsvRow];
          };
          return {
            ...row,
            getDataValue,
          };
        }
      );

      const file = path.join(__dirname, 'csv', 'movies_testdata.csv');
      await cleanUpMovies(file);

      const response = await server.post('/api/movies/upload').attach('file', file);

      const rowToIdMap = response.body.successRows as { rowNumber: number; id: number }[];
      expect(response.body.failedRows.length).toEqual(0);

      const csvRows = await readCsv(file);

      for (let i = 0; i < rowToIdMap.length; i++) {
        const args = csvRows[i];
        const expectedArgs = {
          tmdbId: args.tmdbId.toString(),
          imdbId: args.imdbId,
          title: args.title,
          originalTitle: args.originalTitle,
          overview: args.overview,
          releaseDate: args.releaseDate,
          genreIds: args.genres.map((g) => availableGenres[g.toUpperCase()]),
          originCountryIds: args.countriesOfOrigin.map((c) => availableCountries[c.toUpperCase()]),
          languageId: availableMovieLanguages[args.language.toUpperCase()],
          movieStatus: args.movieStatus,
          popularity: args.popularity,
          budget: BigInt(args.budget),
          revenue: BigInt(args.revenue),
          runtime: args.runtime,
          ratingAverage: Number(args.ratingAverage),
          ratingCount: args.ratingCount,
          posterUrl: args.posterUrl,
          rentalRate: Number(args.rentalRate),
        };
        expect(MovieModel.create).toHaveBeenNthCalledWith(i + 1, expectedArgs, {
          fields: movieFields,
          ignoreDuplicates: false,
          validate: true,
        });
      }

      const files = fs.readdirSync(path.join(process.cwd(), 'movie_uploads'));
      expect(files.length).toEqual(0);
    });

    it('should be able to upload movies from csv file which has some invalid rows', async () => {
      jest.spyOn(MovieModel, 'create').mockImplementation(
        // @ts-ignore
        async (
          row: ParsedCsvRow,
          options: { fields: string[]; ignoreDuplicates: boolean; validate: boolean; t?: Transaction }
        ) => {
          const getDataValue = (key: string) => {
            if (key === 'id') {
              return Number(row.tmdbId) * 2;
            }
            return row[key as keyof ParsedCsvRow];
          };
          return {
            ...row,
            getDataValue,
          };
        }
      );

      const file = path.join(__dirname, 'csv', 'movies_testdata_errors.csv');
      await cleanUpMovies(file);

      const invalidRowsIndex = [2, 3, 4, 5];

      const response = await server.post('/api/movies/upload').attach('file', file);
      const successRows = response.body.successRows as { rowNumber: number; id: number }[];
      const failedRows = response.body.failedRows as { rowNumber: number; id: number }[];

      expect(successRows.filter((row) => invalidRowsIndex.includes(row.rowNumber)).length).toEqual(0);
      expect(failedRows.filter((row) => invalidRowsIndex.includes(row.rowNumber)).length).toEqual(invalidRowsIndex.length);

      const rowToIdMap = response.body.successRows as { rowNumber: number; id: number }[];

      let csvRows = await readCsv(file);
      csvRows = csvRows.filter((r, i) => !invalidRowsIndex.includes(i + 1));

      for (let i = 0; i < rowToIdMap.length; i++) {
        const args = csvRows[i];
        const expectedArgs = {
          tmdbId: args.tmdbId.toString(),
          imdbId: args.imdbId,
          title: args.title,
          originalTitle: args.originalTitle,
          overview: args.overview,
          releaseDate: args.releaseDate,
          genreIds: args.genres.map((g) => availableGenres[g.toUpperCase()]),
          originCountryIds: args.countriesOfOrigin.map((c) => availableCountries[c.toUpperCase()]),
          languageId: availableMovieLanguages[args.language.toUpperCase()],
          movieStatus: args.movieStatus,
          popularity: args.popularity,
          budget: BigInt(args.budget),
          revenue: BigInt(args.revenue),
          runtime: args.runtime,
          ratingAverage: Number(args.ratingAverage),
          ratingCount: args.ratingCount,
          posterUrl: args.posterUrl,
          rentalRate: Number(args.rentalRate),
        };
        expect(MovieModel.create).toHaveBeenNthCalledWith(i + 1, expectedArgs, {
          fields: movieFields,
          ignoreDuplicates: false,
          validate: true,
        });
      }

      expect(failedRows[0]).toEqual({
        rowNumber: 2,
        reasons: ['(tmdbId: should_be_number) The tmdb_id is not a number'],
      });

      expect(failedRows[1]).toEqual({
        rowNumber: 3,
        reasons: ["(genres: ['adventure','fantasy','unknown_genre']) The given genres are invalid"],
      });

      expect(failedRows[2]).toEqual({
        rowNumber: 4,
        reasons: ['(tmdbId: invalid_tmdb_id) The tmdb_id is not a number'],
      });

      const files = fs.readdirSync(path.join(process.cwd(), 'movie_uploads'));
      expect(files.length).toEqual(0);
    });

    it('should stop the upload of movies from csv file which has some invalid rows', async () => {
      jest.spyOn(MovieModel, 'create').mockImplementation(
        // @ts-ignore
        async (
          row: ParsedCsvRow,
          options: { fields: string[]; ignoreDuplicates: boolean; validate: boolean; t?: Transaction }
        ) => {
          const getDataValue = (key: string) => {
            if (key === 'id') {
              return Number(row.tmdbId) * 2;
            }
            return row[key as keyof ParsedCsvRow];
          };
          return {
            ...row,
            getDataValue,
          };
        }
      );

      const file = path.join(__dirname, 'csv', 'movies_testdata_errors.csv');
      await cleanUpMovies(file);

      const response = await server.post('/api/movies/upload?stop_on_error').attach('file', file);

      expect(response.status).toEqual(400);
      expect(response.body).toEqual([
        {
          rowNumber: 2,
          name: 'ValidationFailed',
          message: '(tmdbId: should_be_number) The tmdb_id is not a number',
        },
      ]);

      const csvRows = await readCsv(file);
      const tmdbIds = csvRows.filter((r) => !isNaN(r.tmdbId)).map((r) => r.tmdbId);

      let [queryResult] = await execQuery(
        `
        SELECT count(*) FROM movie WHERE tmdb_id IN (${tmdbIds.join(',')});
      `,
        {},
        true,
        false
      );

      expect(Number(queryResult.count)).toEqual(0);

      const files = fs.readdirSync(path.join(process.cwd(), 'movie_uploads'));
      expect(files.length).toEqual(0);
    });

    it('should stream the upload result for the rows in the csv file', (done) => {
      jest.spyOn(MovieModel, 'create').mockImplementation(
        // @ts-ignore
        async (
          row: ParsedCsvRow,
          options: { fields: string[]; ignoreDuplicates: boolean; validate: boolean; t?: Transaction }
        ) => {
          const getDataValue = (key: string) => {
            if (key === 'id') {
              return Number(row.tmdbId) * 2;
            }
            return row[key as keyof ParsedCsvRow];
          };
          return {
            ...row,
            getDataValue,
          };
        }
      );

      const file = path.join(__dirname, 'csv', 'movies_testdata_errors.csv');

      const expectedFailedRowsNumber = [2, 3, 4, 5];
      const expectedTotalRows = 30;

      const expectedFailedRows: { [key: number]: string[] } = {
        2: ['(tmdbId: should_be_number) The tmdb_id is not a number'],
        3: ["(genres: ['adventure','fantasy','unknown_genre']) The given genres are invalid"],
        4: ['(tmdbId: invalid_tmdb_id) The tmdb_id is not a number'],
        5: ["(countries_of_origin: ['mx','zz']) The given countries are invalid"],
      };
      const expectedRowNumbers = Array.from({ length: expectedTotalRows }, (_, i) => i + 1);

      const parseEventData = (event: string) => {
        const statusCheckRegex = /^data: \{"status":"(processing|done)"/.exec(event);
        const status = statusCheckRegex?.at(1);

        if (status === 'processing') {
          const processingEventData =
            /^data: \{"status":"(processing|done)","outcome":"(success|failed)","rowNumber":(\d+)(,"id":(\d+))?(,"reasons":(\[.*\]))?\}\n\n$/.exec(
              event
            );
          // status - 1
          // outcome - 2
          // rowNumber - 3
          // id - 5
          // reasons - 7
          const outcome = processingEventData?.at(2) ? String(processingEventData.at(2)) : '';
          const rowNumber = processingEventData?.at(3) ? Number(processingEventData.at(3)) : -1;
          const newMovieId = processingEventData?.at(4) ? Number(processingEventData.at(5)) : -1;

          const reasonsMatchingText = processingEventData?.at(7);
          const reasonsText = reasonsMatchingText ? reasonsMatchingText : JSON.stringify([]);
          const reasons = JSON.parse(reasonsText);

          return { status, outcome, rowNumber, id: newMovieId, reasons };
        } else {
          const doneEventData =
            /^data: \{"status":"(processing|done)","totalRows":(\d+),"successRows":(\[.*\]),"failedRows":(\[.*\])\}\n\n$/.exec(
              event
            );
          const totalRows = doneEventData?.at(2) ? Number(doneEventData.at(2)) : -1;
          const successRowsMatchingText = doneEventData?.at(3);
          const failedRowsMatchingText = doneEventData?.at(4);

          const successRowsText = successRowsMatchingText ? successRowsMatchingText : JSON.stringify([]);
          const failedRowsText = failedRowsMatchingText ? failedRowsMatchingText : JSON.stringify([]);

          const successRows = JSON.parse(successRowsText) as { rowNumber: number; id: number }[];
          const failedRows = JSON.parse(failedRowsText) as { rowNumber: number; reasons: string[] }[];

          return { status: 'done', totalRows, successRows, failedRows };
        }
      };

      getStoreManagerCredential().then((cred) => {
        login(cred.email, cred.password)
          .then(() => {
            if (!cookie) {
              throw new Error(`Login failed for ${cred.email}`);
            }

            supertest(app)
              .post('/api/movies/upload?enable_tracking')
              .attach('file', file)
              .set('Cookie', cookie)
              .then((res) => {
                if (res.statusCode === 401) {
                  throw new Error(`(/api/movies/upload?enable_tracking) Authentication failed for ${res.statusCode}`);
                }

                let iteration = 0;
                return supertest(app)
                  .get('/api/movies/upload/track')
                  .set('Accept', 'text/event-stream')
                  .set('Cookie', cookie)
                  .timeout({ deadline: 10000 })
                  .buffer()
                  .parse((res, cb) => {
                    if (res.statusCode === 401) {
                      cb(new Error(`(/api/movies/upload/track) Authentication failed for ${cred.email}`), null);
                    } else {
                      const data: (UploadEventData | UploadEventSummary)[] = [];
                      res
                        .on('data', (chunk) => {
                          const eventData = parseEventData(chunk.toString());
                          data.push({ index: iteration, ...eventData });
                          iteration++;
                        })
                        .on('error', (err) => {
                          cb(err, null);
                        })
                        .on('end', () => {
                          cb(null, data);
                        });
                    }
                  });
              })
              .then((res) => {
                const events = res.body as (UploadEventData | UploadEventSummary)[];
                const eventSummary = events.pop() as UploadEventSummary;
                expect(eventSummary).toMatchObject({
                  index: expectedTotalRows,
                  status: 'done',
                  totalRows: expectedTotalRows,
                });

                // Validate each item of success rows (id and rowNumber)
                const expectedSuccessRowsNumber = expectedRowNumbers.filter((num) => !expectedFailedRowsNumber.includes(num));
                eventSummary.successRows.forEach((r, i) => {
                  expect(r.id).toBeGreaterThan(0);
                  expect(r.rowNumber).toEqual(expectedSuccessRowsNumber[i]);
                });

                // Validate each item of failed rows (rowNumber and reasons)
                eventSummary.failedRows.forEach((r) => {
                  expect(expectedFailedRowsNumber).toContain(r.rowNumber);
                  expect(r.reasons).toEqual(expectedFailedRows[r.rowNumber]);
                });

                const newMovieIds: number[] = [];

                for (let i = 0; i < expectedTotalRows; i++) {
                  const actualEventData = events.at(i);
                  if (expectedFailedRowsNumber.includes(i + 1)) {
                    expect(actualEventData).toEqual({
                      index: i,
                      rowNumber: i + 1,
                      status: 'processing',
                      outcome: 'failed',
                      id: -1,
                      reasons: expectedFailedRows[i + 1],
                    });
                  } else {
                    newMovieIds.push((actualEventData as UploadEventData).id);
                    expect(actualEventData).toEqual({
                      index: i,
                      rowNumber: i + 1,
                      status: 'processing',
                      outcome: 'success',
                      id: expect.any(Number),
                      reasons: [],
                    });
                  }
                }

                done();
              })
              .catch((err) => {
                done(err);
              });
          })
          .catch((err) => done(err));
      });
    });
  });

  describe('POST /movies/upload/validate', () => {
    it('should validate the movies data contained in csv file', async () => {
      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const expectedInvalidRows = [
        { rowNumber: 2, reasons: ['(tmdbId: should_be_number) The tmdb_id is not a number'] },
        { rowNumber: 3, reasons: ["(genres: ['adventure','fantasy','unknown_genre']) The given genres are invalid"] },
        { rowNumber: 4, reasons: ['(tmdbId: invalid_tmdb_id) The tmdb_id is not a number'] },
        { rowNumber: 5, reasons: ["(countries_of_origin: ['mx','zz']) The given countries are invalid"] },
      ];

      const file = path.join(__dirname, 'csv', 'movies_testdata_errors.csv');
      const csvRows = await readCsv(file);
      const response = await server.post('/api/movies/upload/validate').attach('file', file).set('Cookie', cookie);

      expect(response.status).toEqual(200);
      expect(response.body.totalRows).toEqual(csvRows.length);

      const actualInvalidRows = JSON.parse(JSON.stringify(response.body.invalidRows)) as { rowNumber: 2; reasons: string[] }[];
      expect(actualInvalidRows).toEqual(expectedInvalidRows);

      const files = fs.readdirSync(path.join(process.cwd(), 'movie_uploads'));
      expect(files.length).toEqual(0);
    });

    it('should stream the validation result for the rows in the csv file', (done) => {
      const file = path.join(__dirname, 'csv', 'movies_testdata_errors.csv');

      const expectedInvalidRowsNumber = [2, 3, 4, 5];
      const expectedTotalRows = 30;

      const expectedInvalidRows: { [key: number]: string[] } = {
        2: ['(tmdbId: should_be_number) The tmdb_id is not a number'],
        3: ["(genres: ['adventure','fantasy','unknown_genre']) The given genres are invalid"],
        4: ['(tmdbId: invalid_tmdb_id) The tmdb_id is not a number'],
        5: ["(countries_of_origin: ['mx','zz']) The given countries are invalid"],
      };

      const parseEventData = (event: string) => {
        const statusCheckRegex = /^data: \{"status":"(processing|done)"/.exec(event);
        const status = statusCheckRegex?.at(1);

        if (status === 'processing') {
          const processingEventData =
            /^data: \{"status":"(processing|done)","rowNumber":(\d+),"isValid":(true|false)(,"reasons":(\[.*\]))?\}\n\n$/.exec(
              event
            );

          const rowNumber = processingEventData?.at(2) ? Number(processingEventData.at(2)) : -1;
          const isValid = processingEventData?.at(3) === 'true';

          const reasonsMatchingText = processingEventData?.at(5);
          const reasonsText = reasonsMatchingText ? reasonsMatchingText : JSON.stringify([]);
          const reasons = JSON.parse(reasonsText);

          return { rowNumber, status, isValid, reasons };
        } else {
          const doneEventData =
            /^data: \{"status":"(processing|done)","totalRows":(\d+),"validRowsCount":(\d+),"invalidRowsCount":(\d+)\}\n\n$/.exec(
              event
            );
          const totalRows = doneEventData?.at(2) ? Number(doneEventData.at(2)) : -1;
          const validRowsCount = doneEventData?.at(3) ? Number(doneEventData.at(3)) : -1;
          const invalidRowsCount = doneEventData?.at(4) ? Number(doneEventData.at(4)) : -1;

          return { status, totalRows, validRowsCount, invalidRowsCount };
        }
      };

      getStoreManagerCredential().then((cred) => {
        login(cred.email, cred.password)
          .then(() => {
            if (!cookie) {
              throw new Error(`Login failed for ${cred.email}`);
            }

            supertest(app)
              .post('/api/movies/upload/validate?enable_tracking')
              .attach('file', file)
              .set('Cookie', cookie)
              .then((res) => {
                if (res.statusCode === 401) {
                  throw new Error(`(/api/movies/upload/validate?enable_tracking) Authentication failed for ${res.statusCode}`);
                }

                let iteration = 0;
                return supertest(app)
                  .get('/api/movies/upload/track_validation')
                  .set('Accept', 'text/event-stream')
                  .set('Cookie', cookie)
                  .timeout({ deadline: 10000 })
                  .buffer()
                  .parse((res, cb) => {
                    if (res.statusCode === 401) {
                      cb(new Error(`(/api/movies/upload/track_validation) Authentication failed for ${cred.email}`), null);
                    } else {
                      const data: (ValidationEventData | ValidationEventSummary)[] = [];
                      res
                        .on('data', (chunk) => {
                          const eventData = parseEventData(chunk.toString());
                          data.push({ index: iteration, ...eventData });
                          iteration++;
                        })
                        .on('error', (err) => {
                          cb(err, null);
                        })
                        .on('end', () => {
                          cb(null, data);
                        });
                    }
                  });
              })
              .then((res) => {
                const events = res.body as (ValidationEventData | ValidationEventSummary)[];
                const eventSummary = events.pop();
                expect(eventSummary).toEqual({
                  index: expectedTotalRows,
                  status: 'done',
                  totalRows: expectedTotalRows,
                  validRowsCount: expectedTotalRows - expectedInvalidRowsNumber.length,
                  invalidRowsCount: expectedInvalidRowsNumber.length,
                });

                for (let i = 0; i < expectedTotalRows; i++) {
                  const actualEventData = events.at(i);
                  if (expectedInvalidRowsNumber.includes(i + 1)) {
                    expect(actualEventData).toEqual({
                      index: i,
                      rowNumber: i + 1,
                      status: 'processing',
                      isValid: false,
                      reasons: expectedInvalidRows[i + 1],
                    });
                  } else {
                    expect(actualEventData).toEqual({
                      index: i,
                      rowNumber: i + 1,
                      status: 'processing',
                      isValid: true,
                      reasons: [],
                    });
                  }
                }

                const files = fs.readdirSync(path.join(process.cwd(), 'movie_uploads'));
                expect(files.length).toEqual(0);
                done();
              })
              .catch((err) => {
                done(err);
              });
          })
          .catch((err) => done(err));
      });
    });
  });
});
