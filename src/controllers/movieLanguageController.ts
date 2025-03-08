import type { NextFunction, Request, Response } from 'express';
import { queryMovieLanguages } from '../utils';

export const getMovieLanguages = async (req: Request, res: Response, next: NextFunction) => {
  const movieLanguages = await queryMovieLanguages();
  res.status(200).json({ items: movieLanguages, length: movieLanguages.length });
};
