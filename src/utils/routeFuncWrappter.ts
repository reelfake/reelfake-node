import type { Request, Response, NextFunction } from 'express';
import { ValidationError, BaseError } from 'sequelize';
import { AppError } from '../utils';

export default function (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const isDevEnvironment = process.env['NODE_ENV'] === 'development';
    fn(req, res, next).catch((err) => {
      if (err instanceof ValidationError) {
        const errMessages = err.errors.map((error) => error.message);
        res.status(400).json({
          status: 'error',
          message: errMessages.join('\n'),
          stack: isDevEnvironment ? err.stack : undefined,
        });
      } else if (err instanceof BaseError) {
        res.status(500).json({
          status: 'error',
          message: err.message,
          stack: isDevEnvironment ? err.stack : undefined,
        });
      } else if (err instanceof AppError) {
        res
          .status(err.statusCode)
          .json({ status: 'error', message: err.message, stack: isDevEnvironment ? err.stack : undefined });
      } else {
        res.status(err.statusCode || 500).json({ status: 'error', message: err.message });
      }
    });
  };
}
