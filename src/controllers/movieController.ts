import { type Request, type Response } from 'express';
import { Op, WhereOptions } from 'sequelize';
import { Fn } from 'sequelize/lib/utils';
import { executeQuery, AppError } from '../utils';
import { MovieModel } from '../models';
import { ITEMS_PER_PAGE_FOR_PAGINATION } from '../constants';
import sequelize from '../sequelize.config';

function getReleaseDatesRangeFromQuery(req: Request) {
  const { releaseYear: releaseYearText, releaseFrom, releaseTo } = req.query;
  const releaseYear = Number(releaseYearText);

  if (!isNaN(releaseYear)) {
    return [`${releaseYear}-01-01`, `${releaseYear}-12-31`];
  }

  if (releaseFrom && releaseTo) {
    return [releaseFrom, releaseTo];
  }

  return [];
}

const getMoviesUsingQuery = async (
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

  const conditions: WhereOptions[] = [];

  if (genres.length > 0) {
    conditions.push({
      genres: {
        [Op.contains]: genres,
      },
    });
  }

  const [startDate, endDate] = getReleaseDatesRangeFromQuery(req);

  const queryHasReleaseDates = startDate && endDate;

  if (queryHasReleaseDates) {
    conditions.push({
      releaseDate: {
        [Op.between]: [startDate, endDate],
      },
    });
  }

  const totalMovies = await MovieModel.getRowsCountWhere(conditions);

  const movies = await getMoviesUsingQuery(
    pageNumber,
    genres,
    queryHasReleaseDates ? 'release_date, id' : 'id',
    queryHasReleaseDates ? `release_date BETWEEN '${startDate}' AND '${endDate}'` : ''
  );
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

export const getMovieById = async (req: Request, res: Response) => {
  const { movieId: idText } = req.params;
  const { includeActors: includeActorsText } = req.query;

  const id = Number(idText);

  const attributes: (string | [Fn, string])[] = [
    'id',
    'imdbId',
    'title',
    'originalTitle',
    'overview',
    'runtime',
    'releaseDate',
    'genres',
    'country',
    'language',
    'movieStatus',
    'popularity',
    'budget',
    'revenue',
    'ratingAverage',
    'ratingCount',
    'posterUrl',
    'rentalRate',
    'rentalDuration',
  ];

  const includeActors = includeActorsText === 'true';
  if (includeActors) {
    attributes.push([sequelize.fn('public.get_actors', id), 'actors']);
  }

  const movie = await MovieModel.findOne({
    where: {
      id,
    },
    attributes,
  });

  if (!movie) {
    throw new AppError(`Movie with id ${id} does not exist`, 404);
  }

  res.status(200).json(movie);
};
