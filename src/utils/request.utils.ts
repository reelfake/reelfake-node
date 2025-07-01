import type { Request } from 'express';
import { AppError } from '../utils';
import { DATE_FORMAT_IN_REQUEST, availableCountries, availableGenres, availableMovieLanguages } from '../constants';

export function parseRequestQuery(req: Request, skipKeys: string[] = []) {
  let queryObject: { [key: string]: string } = {};
  for (const key in req.query) {
    if (Object.hasOwn(req.query, key)) {
      if (!skipKeys.includes(key) && req.query[key]) {
        queryObject = {
          ...queryObject,
          [key]: req.query[key].toString(),
        };
      }
    }
  }
  return queryObject;
}

export function validateArrayTypeQuery(req: Request, queryName: string) {
  const queryValue = (req.query[queryName] as string) || '';

  if ((queryValue.startsWith('[') && !queryValue.endsWith(']')) || (!queryValue.startsWith('[') && queryValue.endsWith(']'))) {
    throw new AppError(`Invalid ${queryName} provided in query`, 400);
  }

  if (queryValue.startsWith('[') && queryValue.endsWith(']')) {
    try {
      JSON.parse(queryValue);
      return;
    } catch {
      throw new AppError(`Invalid ${queryName} provided in query`, 400);
    }
  }

  const availableItems = [];

  switch (queryName) {
    case 'genres':
      availableItems.push(...Object.keys(availableGenres));
      break;
    case 'countries':
      availableItems.push(...Object.keys(availableCountries));
      break;
    case 'languages':
      availableItems.push(...Object.keys(availableMovieLanguages));
      break;
    default:
      return;
  }

  const updatedItems = [];
  const invalidItems = [];
  const requestedItems = queryValue.split(',').filter((val) => val);
  for (const item of requestedItems) {
    if (availableItems.includes(item.toUpperCase())) {
      updatedItems.push(item);
    } else {
      invalidItems.push(item);
    }
  }

  if (invalidItems.length > 0) {
    throw new AppError(`[${invalidItems.join(',')}] are invalid ${queryName}`, 400);
  }

  req.query[queryName] = queryValue;
}

export function validatePopularityRangeInRequest(popularityRange: string[], onInvalidPopularity: () => void) {
  if (popularityRange.length > 2) {
    onInvalidPopularity();
  }

  for (const popularity of popularityRange) {
    if (!popularity) continue;

    if (isNaN(Number(popularity))) {
      onInvalidPopularity();
    }
  }
}

export function validateDateRangeInRequest(dateRange: string[], onInvalidDate: () => void, onInvalidDateFormat: () => void) {
  if (dateRange.length > 2) {
    onInvalidDate();
  }

  for (const date of dateRange) {
    if (!date) continue;

    const dateParts = DATE_FORMAT_IN_REQUEST.exec(date);
    if (
      !dateParts ||
      (dateParts && (Number(dateParts.at(2)) > 12 || Number(dateParts.at(3)) > 31)) ||
      isNaN(new Date(date).getTime())
    ) {
      onInvalidDateFormat();
    }
  }
}
