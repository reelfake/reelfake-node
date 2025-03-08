import type { NextFunction, Request, Response } from 'express';
import { queryGenres } from '../utils';

export const getGenres = async (req: Request, res: Response, next: NextFunction) => {
  const genres = await queryGenres();
  res.status(200).json({ items: genres, length: genres.length });
};
