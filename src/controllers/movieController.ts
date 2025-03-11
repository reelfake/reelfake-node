import type { Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import {
  executeQuery,
  queryMoviesPage,
  AppError,
  queryMoviesCountByYear,
  queryMovies1,
} from '../utils';
import { MovieModel } from '../models';
import { ITEMS_PER_PAGE_FOR_PAGINATION } from '../constants';

export const getMovies = async (req: Request, res: Response, next: NextFunction) => {
  const { pageNumber: pageNumberText } = req.query;

  const pageNumber = pageNumberText ? Number(pageNumberText) : 1;
  const limitPerPage = ITEMS_PER_PAGE_FOR_PAGINATION;

  /*
    Example
    pageNumber = 3
    page 1 starts at id = 1
    page 2 starts at id = 51
    page 3 starts at id = 101 which ((3 - 1) * 50) + 1
  */
  const idOffset = (pageNumber - 1) * limitPerPage + 1;

  const totalMovies = await MovieModel.getTotalRowsCount();

  const movies = await queryMoviesPage(pageNumber, limitPerPage, idOffset);
  if (movies.length === 0) {
    throw new AppError('Page out of range', 404);
  }

  res
    .status(200)
    .set('rf-page-number', pageNumber.toString())
    .json({
      items: movies,
      length: movies.length,
      totalPages: Math.ceil(totalMovies / limitPerPage),
      totalItems: Number(totalMovies),
    });
};

export const getMoviesByYear = async (req: Request, res: Response, next: NextFunction) => {
  const { pageNumber: pageNumberText } = req.query;
  const { releaseYear: releaseYearText } = req.params;

  const releaseYear = Number(releaseYearText);

  if (!MovieModel.sequelize) {
    throw new AppError('Server encoutered unhandled exception', 500);
  }

  const totalMovies = await queryMoviesCountByYear(releaseYear);

  const pageNumber = pageNumberText ? Number(pageNumberText) : 1;
  const startingRowNumber =
    pageNumber * ITEMS_PER_PAGE_FOR_PAGINATION - ITEMS_PER_PAGE_FOR_PAGINATION;
  const queryText = `
    WITH movies_with_row_number AS (
      SELECT ROW_NUMBER() OVER (ORDER BY release_date, id ASC) AS "rowNumber", *
      FROM v_movie WHERE release_date BETWEEN '${releaseYear}-01-01' AND '${releaseYear}-12-31'
    )
    SELECT id, imdb_id AS "imdbId", title, original_title AS "originalTitle", overview, runtime, 
    release_date AS "releaseDate", genres, country, movie_language AS "language", movie_status AS "movieStatus", 
    popularity, budget, revenue, rating_average AS "ratingAverage", rating_count AS "ratingCount", 
    poster_url AS "posterUrl", rental_rate AS "rentalRate", rental_duration AS "rentalDuration" 
    from movies_with_row_number WHERE "rowNumber" > ${startingRowNumber} LIMIT ${ITEMS_PER_PAGE_FOR_PAGINATION}
  `;

  const movies = await executeQuery(MovieModel.sequelize, queryText);
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
