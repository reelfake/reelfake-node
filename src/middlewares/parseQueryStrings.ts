import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils';

export default function (req: Request, res: Response, next: NextFunction) {
  // pagenumber, releasefrom, releaseto, releaseyear, includeactors, name, namelike
  const { query } = req;
  const updatedQuery: { [key: string]: string } = {};

  const lowercaseKeys = Object.keys(query).map((k) => k.toLowerCase());
  lowercaseKeys.forEach((key, i) => {
    if (lowercaseKeys.indexOf(key) !== i) {
      throw new AppError('Duplicate query strings found', 400);
    }
  });

  const queryStrings = Object.entries(query).reduce<{ [key: string]: string }>((acc, curr) => {
    const key = curr[0].toLowerCase();
    acc[key] = String(curr[1]);
    return acc;
  }, {});

  if ('pagenumber' in queryStrings) {
    updatedQuery['pageNumber'] = String(queryStrings['pagenumber']);
  }

  if ('releasefrom' in queryStrings) {
    updatedQuery['releaseFrom'] = String(queryStrings['releasefrom']);
  }

  if ('releaseto' in queryStrings) {
    updatedQuery['releaseTo'] = String(queryStrings['releaseto']);
  }

  if ('releaseyear' in queryStrings) {
    updatedQuery['releaseYear'] = String(queryStrings['releaseyear']);
  }

  if ('includeactors' in queryStrings) {
    updatedQuery['includeActors'] = String(queryStrings['includeactors']);
  }

  if ('name' in queryStrings) {
    updatedQuery['name'] = String(queryStrings['name']);
  }

  if ('namelike' in queryStrings) {
    updatedQuery['nameLike'] = String(queryStrings['namelike']);
  }

  req.query = updatedQuery;

  next();
}
