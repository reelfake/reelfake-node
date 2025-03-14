import type { Request, Response } from 'express';
import {
  executeQuery,
  AppError,
  queryMoviesCountByYear,
  getMoviesCountByReleaseDates,
} from '../utils';
import { MovieModel } from '../models';
import { ITEMS_PER_PAGE_FOR_PAGINATION } from '../constants';

const fetchMoviesByDates = async (
  pageNumber: number,
  genres: string[],
  orderBy: string,
  filter: string = ''
) => {
  if (!MovieModel.sequelize) {
    throw new AppError('Server encoutered unhandled exception', 500);
  }

  const startingRowNumber =
    pageNumber * ITEMS_PER_PAGE_FOR_PAGINATION - ITEMS_PER_PAGE_FOR_PAGINATION;

  const filters: string[] = [];
  if (genres.length > 0) {
    const genresQuery = `genres @> '{${genres.map((g) => `"${g}"`).join(',')}}'`;
    filters.push(genresQuery);
  }
  if (filter) {
    filters.push(`${filter}`);
  }

  let filterText = filters.length > 1 ? filters.join(' AND ').trim() : filters[0];
  const whereClause = filterText ? `WHERE ${filterText}` : '';

  const queryText = `
    WITH movies_with_row_number AS (
      SELECT ROW_NUMBER() OVER (ORDER BY ${orderBy} ASC) AS "rowNumber", *
      FROM v_movie ${whereClause}
    )
    SELECT id, tmdb_id AS "tmdbId", imdb_id AS "imdbId", title, original_title AS "originalTitle", overview, runtime, 
    release_date AS "releaseDate", genres, country, movie_language AS "language", movie_status AS "movieStatus", 
    popularity, budget, revenue, rating_average AS "ratingAverage", rating_count AS "ratingCount", 
    poster_url AS "posterUrl", rental_rate AS "rentalRate", rental_duration AS "rentalDuration" 
    from movies_with_row_number WHERE "rowNumber" > ${startingRowNumber} LIMIT ${ITEMS_PER_PAGE_FOR_PAGINATION}
  `;

  const movies = await executeQuery(MovieModel.sequelize, queryText);

  return movies;
};

export const getMovies = async (req: Request, res: Response) => {
  if (!MovieModel.sequelize) {
    throw new AppError('Server encoutered unhandled exception', 500);
  }

  const { pageNumber: pageNumberText, genres: genresText } = req.query;
  const pageNumber = pageNumberText ? Number(pageNumberText) : 1;

  const genres = genresText ? genresText.toString().split(',') : [];
  const limitPerPage = ITEMS_PER_PAGE_FOR_PAGINATION;

  let totalMovies = -1;
  if (genres.length > 0) {
    totalMovies = await MovieModel.getRowsCountByGenres(genres);
  } else {
    totalMovies = await MovieModel.getTotalRowsCount();
  }

  const movies = await fetchMoviesByDates(pageNumber, genres, 'id');
  const moviesCount = movies.length;

  if (moviesCount === 0) {
    throw new AppError('Page out of range', 404);
  }

  res
    .status(200)
    .set({
      'rf-page-number': pageNumber,
    })
    .json({
      items: movies,
      length: moviesCount,
      totalPages: Math.ceil(totalMovies / limitPerPage),
      totalItems: Number(totalMovies),
    });
};

export const getMoviesByYear = async (req: Request, res: Response) => {
  const { pageNumber: pageNumberText, genres: genresText } = req.query;
  const { releaseYear: releaseYearText } = req.params;
  const genres = genresText ? genresText.toString().split(',') : [];
  const releaseYear = Number(releaseYearText);

  if (!MovieModel.sequelize) {
    throw new AppError('Server encoutered unhandled exception', 500);
  }

  const totalMovies = await queryMoviesCountByYear(releaseYear, genres);

  const pageNumber = pageNumberText ? Number(pageNumberText) : 1;
  const movies = await fetchMoviesByDates(
    pageNumber,
    genres,
    'release_date, id',
    `release_date BETWEEN '${releaseYear}-01-01' AND '${releaseYear}-12-31'`
  );

  res
    .status(200)
    .set('rf-page-number', pageNumber.toString())
    .json({
      items: movies,
      length: movies.length,
      totalPages: Math.ceil(totalMovies / ITEMS_PER_PAGE_FOR_PAGINATION),
      totalItems: Number(totalMovies),
    });
};

export const getMoviesByDateRange = async (req: Request, res: Response) => {
  const { pageNumber: pageNumberText, genres: genresText } = req.query;
  const { startDate, endDate } = req.params;

  if (!MovieModel.sequelize) {
    throw new AppError('Server encoutered unhandled exception', 500);
  }

  const genres = genresText ? genresText.toString().split(',') : [];

  const totalMovies = await getMoviesCountByReleaseDates(startDate, endDate, genres);

  const pageNumber = pageNumberText ? Number(pageNumberText) : 1;
  const movies = await fetchMoviesByDates(
    pageNumber,
    genres,
    'release_date, id',
    `release_date BETWEEN '${startDate}' AND '${endDate}'`
  );

  res
    .status(200)
    .set('rf-page-number', pageNumber.toString())
    .json({
      items: movies,
      length: movies.length,
      totalPages: Math.ceil(totalMovies / ITEMS_PER_PAGE_FOR_PAGINATION),
      totalItems: Number(totalMovies),
    });
};
