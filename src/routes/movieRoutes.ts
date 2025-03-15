import { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { routeFnWrapper, AppError } from '../utils';
import { getMovieById, getMovies } from '../controllers';
import { GENRES } from '../constants';

const router = Router();

function validateReleaseDate(releaseDate: string) {
  const dateRegex = new RegExp(/^(\d{4})-(\d{2})-(\d{2})$/);
  const matchResult = dateRegex.exec(releaseDate);
  const year = Number(matchResult?.at(1));
  const month = Number(matchResult?.at(2));
  const date = Number(matchResult?.at(3));

  const isValid =
    !isNaN(year) && // Valid number
    year >= 1970 && // Year is between 1970 and 2050
    year <= 2050 &&
    !isNaN(month) && // Valid number
    month > 0 && // month between 01 and 12
    month < 13 &&
    !isNaN(date) && // Valid number
    date > 0 && // Date between 01 and 31
    date < 32;
  return isValid;
}

function validateMovieIdRouteQuery(req: Request, res: Response, next: NextFunction) {
  const { movieId: idText } = req.params;
  let { includeActors: includeActorsText } = req.query;
  includeActorsText = includeActorsText ? String(includeActorsText).trim().toLowerCase() : '';

  const id = Number(idText);

  if (isNaN(id) || id <= 0) {
    throw new AppError('Invalid movie id. Movie id must be a non-zero positive number.', 400);
  }

  const includeActorsTruthies = ['true', 'yes', '1'];
  const includeActorsFalsies = ['false', 'no', '0'];

  if (
    includeActorsText &&
    ![...includeActorsTruthies, ...includeActorsFalsies].includes(includeActorsText)
  ) {
    throw new AppError(
      'Invalid value for includeActors in query. Please refer to api specs for more information.',
      400
    );
  }

  req.query.includeActors = String(includeActorsTruthies.includes(includeActorsText));

  next();
}

function validateMoviesRouteQuery(req: Request, res: Response, next: NextFunction) {
  const {
    pageNumber: pageNumberText = '1',
    releaseYear: releaseYearText,
    releaseFrom,
    releaseTo,
  } = req.query;
  const genresText = (req.query.genres as string) || '';

  if (isNaN(Number(pageNumberText)) || Number(pageNumberText) < 1) {
    throw new AppError('Page number should be a valid non-zero positive number', 400);
  }

  const updatedGenres = [];
  const invalidGenres = [];
  const requestedGenres = genresText ? genresText.split(',') : [];
  for (const g of requestedGenres) {
    const genreName = GENRES[g.toLowerCase()];
    if (genreName) {
      updatedGenres.push(genreName);
    } else {
      invalidGenres.push(g);
    }
  }

  if (invalidGenres.length > 0) {
    throw new AppError(`[${invalidGenres.join(',')}] are invalid genres`, 400);
  }

  const releaseYear = Number(releaseYearText);
  if (releaseYearText && (isNaN(releaseYear) || releaseYear < 1970 || releaseYear > 2050)) {
    throw new AppError('Release year must be between 1970 and 2050', 400);
  }

  if ((releaseFrom && !releaseTo) || (!releaseFrom && releaseTo)) {
    throw new AppError('To filter by release dates, release date from and to are required.', 400);
  }

  if (releaseYear && releaseFrom && releaseTo) {
    throw new AppError('Release year and release dates cannot be used together', 400);
  }

  if (
    (releaseFrom && !validateReleaseDate(String(releaseFrom))) ||
    (releaseTo && !validateReleaseDate(String(releaseTo)))
  ) {
    throw new AppError(
      'Invalid release date. Please refer to api specs for more information.',
      400
    );
  }

  req.query.genres = updatedGenres.join(',');

  next();
}

router.get('/', validateMoviesRouteQuery, routeFnWrapper(getMovies));
router.get('/:movieId', validateMovieIdRouteQuery, routeFnWrapper(getMovieById));

export default router;
