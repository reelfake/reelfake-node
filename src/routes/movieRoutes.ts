import { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { routeFnWrapper, AppError } from '../utils';
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
import { GENRES, USER_ROLES, RELEASE_DATE_FORMAT, ERROR_MESSAGES } from '../constants';
import { CustomRequest } from '../types';

const validGenres = Object.entries(GENRES).reduce<{ [key: string]: string }>((acc, curr) => {
  const [key, value] = curr;
  acc[key] = value;
  return acc;
}, {});

const router = Router();

function validateReleaseDate(releaseDate: string) {
  const dateRegex = new RegExp(/^(\d{4})-(\d{2})-(\d{2})$/);
  const matchResult = dateRegex.exec(releaseDate);
  const year = Number(matchResult?.at(1));
  const month = Number(matchResult?.at(2));
  const date = Number(matchResult?.at(3));

  const isValid =
    !isNaN(year) && // Valid number
    !isNaN(month) && // Valid number
    month > 0 && // month between 01 and 12
    month < 13 &&
    !isNaN(date) && // Valid number
    date > 0 && // Date between 01 and 31
    date < 32;
  return isValid;
}

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
    throw new AppError(
      'Invalid value for includeActors in query. Please refer to api specs for more information.',
      400
    );
  }

  req.query.includeActors = String(includeActorsTruthies.includes(includeActorsText));

  next();
}

function validateMoviesRouteQuery(req: CustomRequest, res: Response, next: NextFunction) {
  const { page: pageNumberText = '1', release_date: releaseDate, rating } = req.query;
  const genresText = (req.query.genres as string) || '';

  // Validate page query
  if (
    pageNumberText !== 'first' &&
    pageNumberText !== 'last' &&
    (isNaN(Number(pageNumberText)) || Number(pageNumberText) < 1)
  ) {
    return next(new AppError('Invalid page number', 400));
  }

  if (pageNumberText === 'first') {
    req.query.page = '1';
  }

  if (pageNumberText === 'last') {
    req.query.page = '-1';
  }

  // Validate genres query
  const updatedGenres = [];
  const invalidGenres = [];
  const requestedGenres = genresText ? genresText.split(',') : [];
  for (const g of requestedGenres) {
    const genreName = validGenres[g.toUpperCase()];
    if (genreName) {
      updatedGenres.push(genreName);
    } else {
      invalidGenres.push(g);
    }
  }

  if (invalidGenres.length > 0) {
    return next(new AppError(`[${invalidGenres.join(',')}] are invalid genres`, 400));
  }

  req.query.genres = updatedGenres.join(',');

  // Validate release date query
  const releaseDateRange = releaseDate ? releaseDate.toString().split(',') : [];
  if (releaseDateRange.length > 2) {
    return next(new AppError(ERROR_MESSAGES.INVALID_RELEASE_DATE, 400));
  }

  for (const date of releaseDateRange) {
    if (date) continue;

    const dateParts = RELEASE_DATE_FORMAT.exec(date);
    if (
      !dateParts ||
      (dateParts && (Number(dateParts.at(2)) > 12 || Number(dateParts.at(3)) > 31)) ||
      isNaN(new Date(date).getTime())
    ) {
      return next(new AppError(ERROR_MESSAGES.RELEASE_DATE_INVALID_FORMAT, 400));
    }
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
router.post(
  '/:id/add_actors',
  validateAuthToken,
  validateUserRole(USER_ROLES.STORE_MANAGER),
  routeFnWrapper(addActors)
);
router.get('/search', routeFnWrapper(searchMovies));
router.get('/:id/stores', routeFnWrapper(findInStores));

export default router;
