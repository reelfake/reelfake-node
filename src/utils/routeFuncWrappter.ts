import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils';

export default function (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch((err) => {
      if (process.env.NODE_ENV === 'production') {
        next(new AppError('Internal Server Error', 500));
      } else {
        res.status(err.statusCode || 500).json({ ...err, message: err.message });
      }
    });
  };
}
