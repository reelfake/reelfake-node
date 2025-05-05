import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils';
import { ERROR_MESSAGES, USER_ROLES } from '../constants';
import { CustomRequest } from '../types';

export default async function (req: Request, res: Response, next: NextFunction) {
  const token = req.cookies.auth_token;
  if (!token) {
    return next(new AppError(ERROR_MESSAGES.INVALID_AUTH_TOKEN, 401));
  }
  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET || '', {
      ignoreExpiration: false, // default
    });

    const userEmail = (decodedToken as { [key: string]: string })['email'];
    const userRole = (decodedToken as { [key: string]: USER_ROLES })['role'];

    if (!userRole) {
      throw new AppError(ERROR_MESSAGES.INVALID_AUTH_TOKEN, 403);
    }

    (req as CustomRequest).user = {
      email: userEmail,
      role: userRole,
    };

    next();
  } catch (err: unknown) {
    if ((err as Error).name === 'TokenExpiredError') {
      return next(new AppError(ERROR_MESSAGES.INVALID_AUTH_TOKEN, 401));
    }
    if (process.env.NODE_ENV === 'prod') {
      next(new AppError('Error validating token', 401));
    } else {
      next(err);
    }
  }
}

export function validateUserRole(...roles: USER_ROLES[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { user } = req as CustomRequest;

    if (!user) {
      throw new AppError(ERROR_MESSAGES.INVALID_AUTH_TOKEN, 401);
    }

    if (!roles.includes(user.role)) {
      throw new AppError(ERROR_MESSAGES.FORBIDDEN, 403);
    }

    next();
  };
}
