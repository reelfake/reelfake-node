import type { NextFunction, Request, Response } from 'express';
import { queryCities } from '../utils';

export const getCities = async (req: Request, res: Response, next: NextFunction) => {
  const includeCountry = req.query.includeCountry == 'true' || req.query.includeCountry == 'yes';
  const cities = await queryCities(includeCountry);
  res.status(200).json({ items: cities, length: cities.length });
};

export const getCitiesByCountry = async (req: Request, res: Response, next: NextFunction) => {
  try {
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
};
