import type { Request } from 'express';

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
