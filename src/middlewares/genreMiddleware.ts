import type { Request, Response, NextFunction } from 'express';
import { GENRES } from '../constants';

export function validateGenresInQuery(req: Request, res: Response, next: NextFunction) {
  const { genres } = req.query as { genres: string };

  if (genres) {
    const genresArr = genres.split(',');
    const availableGenres = Object.values(GENRES);
    const invalidGenres = genresArr.filter((g) => !availableGenres.includes(g.trim() as GENRES));
    if (invalidGenres.length > 0) {
      res.status(400).json({ error: `Invalid genres - ${invalidGenres.join(', ')}` });
      return;
    }
  }

  next();
}
