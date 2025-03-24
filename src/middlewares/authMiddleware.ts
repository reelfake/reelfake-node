import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiKeyModel } from '../models';
import { AppError } from '../utils';
import { ERROR_MESSAGES } from '../constants';
import { RequestWithToken } from '../types';

export default async function (req: Request, res: Response, next: NextFunction) {
  const skipAuth =
    new RegExp('/api/v1/(re)?docs/').test(req.path) ||
    req.path === '/openapi/v1' ||
    req.path === '/api/v1/api_key' ||
    req.path === '/api/v1/auth/register' ||
    req.path === '/api/v1/auth/login' ||
    req.path === '/api/v1/auth/logout';

  if (skipAuth) {
    return next();
  }

  const apiKey = req.get('api-key');
  const token = req.cookies.token;

  if (apiKey === undefined && !token) {
    return next(new AppError(ERROR_MESSAGES.INVALID_MISSING_API_KEY, 401));
  }

  if (token) {
    try {
      const decodedToken = jwt.verify(token, process.env.JWT_SECRET || '');
      (req as RequestWithToken).token = decodedToken;
      return next();
    } catch {
      throw new AppError('Invalid token', 401);
    }
  }

  const result = await ApiKeyModel.findOne({
    attributes: ['apiKey', 'expiringAt'],
    where: {
      apiKey,
    },
  });

  if (!result) {
    return next(new AppError(ERROR_MESSAGES.INVALID_MISSING_API_KEY, 401));
  }

  const expiringAt = result.getDataValue('expiringAt');

  if (new Date(expiringAt).getTime() <= new Date().getTime()) {
    return next(new AppError(ERROR_MESSAGES.INVALID_MISSING_API_KEY, 401));
  }

  next();
}
