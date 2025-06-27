import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { validateAuthToken, validateUserRole } from '../middlewares';
import { getActors, searchActor, getActorById, updateActor, deleteActor, addActor, addToMovie } from '../controllers';
import { routeFnWrapper, AppError, validateDateRangeInRequest, validatePopularityRangeInRequest } from '../utils';
import { USER_ROLES, ERROR_MESSAGES } from '../constants';

const router = Router();

function validateActorsRouteQuery(req: Request, res: Response, next: NextFunction) {
  const { page: pageNumberText = '1', birth_day: birthday, death_day: deathday, popularity } = req.query;

  // Validate page number
  if (pageNumberText !== 'first' && pageNumberText !== 'last' && (isNaN(Number(pageNumberText)) || Number(pageNumberText) < 1)) {
    throw new AppError(ERROR_MESSAGES.INVALID_PAGE_NUMBER, 400);
  }

  if (pageNumberText === 'first') {
    req.query.page = '1';
  }

  if (pageNumberText === 'last') {
    req.query.page = '-1';
  }

  // Validate birthday
  const birthdayDateRange = birthday ? birthday.toString().split(',') : [];
  validateDateRangeInRequest(
    birthdayDateRange,
    () => {
      throw new AppError(ERROR_MESSAGES.INVALID_ACTOR_BIRTHDATE, 400);
    },
    () => {
      throw new AppError(ERROR_MESSAGES.ACTOR_BIRTHDATE_INVALID_FORMAT, 400);
    }
  );

  // Validate deathday
  const deathdayDateRange = deathday ? deathday.toString().split(',') : [];
  validateDateRangeInRequest(
    deathdayDateRange,
    () => {
      throw new AppError(ERROR_MESSAGES.INVALID_ACTOR_DEATHDATE, 400);
    },
    () => {
      throw new AppError(ERROR_MESSAGES.ACTOR_DEATHDATE_INVALID_FORMAT, 400);
    }
  );

  // Validate popularity
  const popularityRange = popularity ? popularity.toString().split(',') : [];
  try {
    validatePopularityRangeInRequest(popularityRange, () => {
      throw new AppError(ERROR_MESSAGES.INVALID_ACTOR_POPULARITY, 400);
    });
  } catch (err) {
    return next(err);
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

  if (includeMoviesText && ![...includeMoviesTruthies, ...includeMoviesFalsies].includes(includeMoviesText)) {
    throw new AppError('Invalid value for includeMovies in query. Please refer to api specs for more information.', 400);
  }

  req.query.includeMovies = String(includeMoviesTruthies.includes(includeMoviesText));

  next();
}

router.get('/', validateActorsRouteQuery, routeFnWrapper(getActors));
router.post('/', validateAuthToken, validateUserRole(USER_ROLES.STORE_MANAGER), routeFnWrapper(addActor));
router.post('/:id/add_to_movie', validateAuthToken, validateUserRole(USER_ROLES.STORE_MANAGER), routeFnWrapper(addToMovie));
router.get('/search', validateSearchRouteQuery, routeFnWrapper(searchActor));
router.get('/:id', validateActorByIdRouteQuery, routeFnWrapper(getActorById));
router.put('/:id', validateAuthToken, validateUserRole(USER_ROLES.STORE_MANAGER), routeFnWrapper(updateActor));
router.delete('/:id', validateAuthToken, validateUserRole(USER_ROLES.STORE_MANAGER), routeFnWrapper(deleteActor));

export default router;
