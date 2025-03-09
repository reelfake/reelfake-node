import type { Request, Response, NextFunction } from 'express';
import { queryMoviesPage } from '../utils';
import { MovieModel } from '../models';
import { PAGINATION_HEADERS, ITEMS_PER_PAGE_FOR_PAGINATION } from '../constants';

export const getMovies = async (req: Request, res: Response, next: NextFunction) => {
  const { page_number } = req.query;

  const pageNumber = Number(page_number);
  const limitPerPage = ITEMS_PER_PAGE_FOR_PAGINATION;

  const lastSeenPageNumber = Number(req.get(PAGINATION_HEADERS.LAST_SEEN_PAGE_NUMBER));
  const lastIdOfLastSeenPage = Number(req.get(PAGINATION_HEADERS.LAST_SEEN_PAGE_LAST_ID));

  const totalMovies = await MovieModel.getTotalRowsCount();

  const movies = await queryMoviesPage(
    pageNumber,
    limitPerPage,
    lastSeenPageNumber,
    lastIdOfLastSeenPage
  );
  const moviesLength = movies.length;
  const lastMovieId = movies[moviesLength - 1].getDataValue('id');

  res
    .status(200)
    .set({ 'page-number': pageNumber, 'last-seen-id': lastMovieId })
    .json({
      items: movies,
      length: movies.length,
      totalPages: Math.floor(totalMovies / limitPerPage),
      totalItems: Number(totalMovies),
    });
};
