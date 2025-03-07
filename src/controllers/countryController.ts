import type { Request, Response } from 'express';
import { queryCountries } from '../utils';

export const getCountries = async (req: Request, res: Response) => {
  try {
    const countries = await queryCountries();
    res.status(200).json({ items: countries, length: countries.length });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
};
