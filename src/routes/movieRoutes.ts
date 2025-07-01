import { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { routeFnWrapper, AppError, validateDateRangeInRequest, validateArrayTypeQuery } from '../utils';
import {
  findInStores,
  getMovieById,
  getMovies,
  searchMovies,
  createMovie,
  addActors,
  updateMovie,
  deleteMovie,
} from '../controllers';
import { validateAuthToken, validateUserRole } from '../middlewares';
import { USER_ROLES, ERROR_MESSAGES } from '../constants';
import { CustomRequest } from '../types';

const router = Router();

function validateMovieByIdRouteQuery(req: Request, res: Response, next: NextFunction) {
  const { id: idText } = req.params;
  let { includeActors: includeActorsText } = req.query;
  includeActorsText = includeActorsText ? String(includeActorsText).trim().toLowerCase() : '';

  const id = Number(idText);

  if (isNaN(id) || id <= 0) {
    throw new AppError('Invalid movie id. Movie id must be a non-zero positive number.', 400);
  }

  const includeActorsTruthies = ['true', 'yes', '1'];
  const includeActorsFalsies = ['false', 'no', '0'];

  if (includeActorsText && ![...includeActorsTruthies, ...includeActorsFalsies].includes(includeActorsText)) {
    throw new AppError('Invalid value for includeActors in query. Please refer to api specs for more information.', 400);
  }

  req.query.includeActors = String(includeActorsTruthies.includes(includeActorsText));

  next();
}

function validateMoviesRouteQuery(req: CustomRequest, res: Response, next: NextFunction) {
  const { page: pageNumberText = '1', release_date: releaseDate, rating } = req.query;

  if (pageNumberText !== 'first' && pageNumberText !== 'last' && (isNaN(Number(pageNumberText)) || Number(pageNumberText) < 1)) {
    // Validate page query
    return next(new AppError(ERROR_MESSAGES.INVALID_PAGE_NUMBER, 400));
  }

  if (pageNumberText === 'first') {
    req.query.page = '1';
  }

  if (pageNumberText === 'last') {
    req.query.page = '-1';
  }

  // Validate genres, countries and languages queries
  try {
    validateArrayTypeQuery(req, 'genres');
    validateArrayTypeQuery(req, 'countries');
    validateArrayTypeQuery(req, 'languages');
  } catch (err) {
    return next(err);
  }

  // Validate release date query
  const releaseDateRange = releaseDate ? releaseDate.toString().split(',') : [];
  try {
    validateDateRangeInRequest(
      releaseDateRange,
      () => {
        throw new AppError(ERROR_MESSAGES.INVALID_RELEASE_DATE, 400);
      },
      () => {
        throw new AppError(ERROR_MESSAGES.RELEASE_DATE_INVALID_FORMAT, 400);
      }
    );
  } catch (err) {
    return next(err);
  }

  // Validate rating query
  const ratingRange = rating ? rating.toString().split(',') : [];
  if (ratingRange.length > 2 || ratingRange.some((r) => r && isNaN(Number(r)))) {
    return next(new AppError(ERROR_MESSAGES.INVALID_RATING, 400));
  }

  next();
}

router.get('/', validateMoviesRouteQuery, routeFnWrapper(getMovies));
router.post('/', validateAuthToken, validateUserRole(USER_ROLES.STORE_MANAGER), routeFnWrapper(createMovie));
router.get('/:id', validateMovieByIdRouteQuery, routeFnWrapper(getMovieById));
router.put('/:id', validateAuthToken, validateUserRole(USER_ROLES.STORE_MANAGER), routeFnWrapper(updateMovie));
router.delete('/:id', validateAuthToken, validateUserRole(USER_ROLES.STORE_MANAGER), routeFnWrapper(deleteMovie));
router.post('/:id/add_actors', validateAuthToken, validateUserRole(USER_ROLES.STORE_MANAGER), routeFnWrapper(addActors));
router.get('/search', routeFnWrapper(searchMovies));
router.get('/:id/stores', routeFnWrapper(findInStores));

export default router;
