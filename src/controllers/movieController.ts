import type { Request, Response, NextFunction } from 'express';
import { queryMovies, AppError } from '../utils';

export const getMovies = async (req: Request, res: Response, next: NextFunction) => {
  const { page_number, limit_per_page } = req.query;

  if (!req.query.page_number || !req.query.limit_per_page) {
    throw new AppError('Page number and limit per page are required in the request', 400);
  }

  const pageNumber = Number(page_number);
  const limitPerPage = Number(limit_per_page);

  if (isNaN(pageNumber) || isNaN(limitPerPage)) {
    throw new AppError('Page number and limit per page must be a valid non-zero number', 400);
  }

  if (pageNumber < 1) {
    throw new AppError('Page number must be a valid non-zero number', 400);
  }

  if (limitPerPage < 2) {
    throw new AppError('The limit per page must to be at least 2', 400);
  }

  const movies = await queryMovies(pageNumber, limitPerPage);
  res.status(200).json({ items: movies, length: movies.length });
};
