import type { Request, Response } from 'express';
import { queryMovieLanguages } from '../utils';

export const getMovieLanguages = async (req: Request, res: Response) => {
  try {
    const movieLanguages = await queryMovieLanguages();
    res.status(200).json({ items: movieLanguages, length: movieLanguages.length });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
};
