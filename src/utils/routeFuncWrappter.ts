import type { Request, Response, NextFunction } from 'express';
import { ValidationError, BaseError } from 'sequelize';
import { AppError } from '../utils';

export default function (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const isProdEnvironment = process.env['NODE_ENV'] === 'production';
    fn(req, res, next).catch((err) => {
      if (err instanceof ValidationError) {
        const errMessages = err.errors.map((error) => error.message);
        res.status(400).json({
          status: 'error',
          message: errMessages.join('\n'),
          stack: isProdEnvironment ? undefined : err.stack,
        });
      } else if (err instanceof BaseError) {
        res.status(500).json({
          status: 'error',
          message: err.message,
          stack: isProdEnvironment ? undefined : err.stack,
        });
      } else if (err instanceof AppError) {
        res
          .status(err.statusCode)
          .json({ status: 'error', message: err.message, stack: isProdEnvironment ? undefined : err.stack });
      } else {
        res.status(err.statusCode || 500).json({ status: 'error', message: err.message });
      }
    });
  };
}
