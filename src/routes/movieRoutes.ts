import { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { routeFnWrapper, AppError } from '../utils';
import {
  findInStores,
  getMovieById,
  getMovies,
  searchMovies,
  addMovie,
  addActors,
  updateMovie,
  deleteMovie,
} from '../controllers';
import { validateAuthToken } from '../middlewares';
import { GENRES } from '../constants';
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
  const { pageNumber: pageNumberText = '1', releaseYear: releaseYearText, releaseFrom, releaseTo } = req.query;
  const genresText = (req.query.genres as string) || '';

  if (isNaN(Number(pageNumberText)) || Number(pageNumberText) < 1) {
    return next(new AppError('Page number should be a valid non-zero positive number', 400));
  }

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

  const releaseYear = Number(releaseYearText);
  if (releaseYearText && isNaN(releaseYear)) {
    return next(new AppError('Invalid release year', 400));
  }

  if ((releaseFrom && !releaseTo) || (!releaseFrom && releaseTo)) {
    return next(new AppError('To filter by release dates, release date from and to are required.', 400));
  }

  if (releaseYear && releaseFrom && releaseTo) {
    return next(new AppError('Release year and release dates cannot be used together', 400));
  }

  if (
    (releaseFrom && !validateReleaseDate(String(releaseFrom))) ||
    (releaseTo && !validateReleaseDate(String(releaseTo)))
  ) {
    return next(new AppError('Invalid release date', 400));
  }

  req.query.genres = updatedGenres.join(',');

  next();
}

router.get('/', validateMoviesRouteQuery, routeFnWrapper(getMovies));
router.post('/', validateAuthToken, routeFnWrapper(addMovie));
router.get('/:id', validateMovieByIdRouteQuery, routeFnWrapper(getMovieById));
router.put('/:id', validateAuthToken, routeFnWrapper(updateMovie));
router.delete('/:id', validateAuthToken, routeFnWrapper(deleteMovie));
router.post('/:id/add_actors', validateAuthToken, routeFnWrapper(addActors));
router.get('/search', routeFnWrapper(searchMovies));
router.get('/:id/stores', routeFnWrapper(findInStores));

export default router;
