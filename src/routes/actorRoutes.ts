import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { routeFnWrapper, AppError } from '../utils';
import { getActors, searchActor, getActorById } from '../controllers';

const router = Router();

function validateActorsRouteQuery(req: Request, res: Response, next: NextFunction) {
  const { pageNumber: pageNumberText = '1' } = req.query;

  if (isNaN(Number(pageNumberText)) || Number(pageNumberText) < 1) {
    throw new AppError('Page number should be a valid non-zero positive number', 400);
  }

  next();
}

function validateSearchRouteQuery(req: Request, res: Response, next: NextFunction) {
  const { name, q } = req.query;

  if (!name && !q) {
    throw new AppError('Request is missing the search parameter', 400);
  }

  if (name && q) {
    throw new AppError('Request cannot have search by name and query together', 400);
  }

  next();
}

function validateActorByIdRouteQuery(req: Request, res: Response, next: NextFunction) {
  const { id: idText } = req.params;
  let { includeMovies: includeMoviesText } = req.query;
  includeMoviesText = includeMoviesText ? String(includeMoviesText).trim().toLowerCase() : '';

  const id = Number(idText);

  if (isNaN(id) || id <= 0) {
    throw new AppError('Invalid movie id. Movie id must be a non-zero positive number.', 400);
  }

  const includeMoviesTruthies = ['true', 'yes', '1'];
  const includeMoviesFalsies = ['false', 'no', '0'];

  if (
    includeMoviesText &&
    ![...includeMoviesTruthies, ...includeMoviesFalsies].includes(includeMoviesText)
  ) {
    throw new AppError(
      'Invalid value for includeMovies in query. Please refer to api specs for more information.',
      400
    );
  }

  req.query.includeMovies = String(includeMoviesTruthies.includes(includeMoviesText));

  next();
}

router.get('/', validateActorsRouteQuery, routeFnWrapper(getActors));
router.get('/search', validateSearchRouteQuery, routeFnWrapper(searchActor));
router.get('/:id', validateActorByIdRouteQuery, getActorById);

export default router;
