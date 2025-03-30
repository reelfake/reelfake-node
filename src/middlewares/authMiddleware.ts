import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils';
import { ERROR_MESSAGES } from '../constants';
import { RequestWithToken } from '../types';

export default async function (req: Request, res: Response, next: NextFunction) {
  const token = req.cookies.auth_token;

  if (!token) {
    return next(new AppError(ERROR_MESSAGES.INVALID_AUTH_TOKEN, 401));
  }

  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET || '', {
      ignoreExpiration: false, // default
    });
    (req as RequestWithToken).token = decodedToken;
    next();
  } catch (err: unknown) {
    if ((err as Error).name === 'TokenExpiredError') {
      return next(new AppError(ERROR_MESSAGES.INVALID_AUTH_TOKEN, 401));
    }
    if (process.env.NODE_ENV === 'prod') {
      throw new AppError('Invalid token', 401);
    } else {
      next(err);
    }
  }
}
