import { AppError, validateArrayTypeQuery, validateDateRangeInRequest } from '../utils';
import { ERROR_MESSAGES } from '../constants';
import type { Response, NextFunction } from 'express';
import type { CustomRequest } from '../types';

export default function (req: CustomRequest, res: Response, next: NextFunction) {
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
