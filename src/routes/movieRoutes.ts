import { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { routeFnWrapper, AppError } from '../utils';
import { getMovies, getMoviesByYear } from '../controllers';

const router = Router();

function validateHeaders(req: Request, res: Response, next: NextFunction) {
  const { pageNumber: pageNumberText } = req.query;

  if (!pageNumberText) {
    return next();
  }

  if (pageNumberText && (isNaN(Number(pageNumberText)) || Number(pageNumberText) < 1)) {
    throw new AppError('Page number should be a valid non-zero positive number', 400);
  }

  const pageNumber = Number(pageNumberText);

  if (pageNumber === 1) {
    return next();
  }

  next();
}

router.use(validateHeaders);

router.get('/', routeFnWrapper(getMovies));
router.get('/:releaseYear', routeFnWrapper(getMoviesByYear));

export default router;
