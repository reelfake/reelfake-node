import type { Request, Response } from 'express';
import { queryGenres } from '../utils';

export const getGenres = async (req: Request, res: Response) => {
  try {
    const genres = await queryGenres();
    res.status(200).json({ items: genres, length: genres.length });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
};
