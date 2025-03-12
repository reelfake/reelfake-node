import { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { routeFnWrapper, AppError } from '../utils';
import { getMovies, getMoviesByYear } from '../controllers';
import { GENRES } from '../constants';
import { ENUM } from 'sequelize';

const router = Router();

function validateRequestQuery(req: Request, res: Response, next: NextFunction) {
  const { pageNumber: pageNumberText = '1' } = req.query;
  const genresText = (req.query.genres as string) || '';

  if (isNaN(Number(pageNumberText)) || Number(pageNumberText) < 1) {
    throw new AppError('Page number should be a valid non-zero positive number', 400);
  }

  const updatedGenres = [];
  const invalidGenres = [];
  const requestedGenres = genresText ? genresText.split(',') : [];
  for (const g of requestedGenres) {
    const genreName = GENRES[g];
    if (genreName) {
      updatedGenres.push(genreName);
    } else {
      invalidGenres.push(g);
    }
  }

  if (invalidGenres.length > 0) {
    throw new AppError(`The [${invalidGenres.join(',')}] are invalid genres`, 400);
  }

  req.query.genres = updatedGenres.join(',');

  next();
}

router.use(validateRequestQuery);

router.get('/', routeFnWrapper(getMovies));
router.get('/:releaseYear', routeFnWrapper(getMoviesByYear));

export default router;
