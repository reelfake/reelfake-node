import type { Request } from 'express';
import { DATE_FORMAT_IN_REQUEST } from '../constants';

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
