import type { NextFunction, Request, Response } from 'express';
import { queryCountries } from '../utils';

export const getCountries = async (req: Request, res: Response, next: NextFunction) => {
  const countries = await queryCountries();
  res.status(200).json({ items: countries, length: countries.length });
};
