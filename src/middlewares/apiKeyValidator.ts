import type { Request, Response, NextFunction } from 'express';
import { ApiKeyModel } from '../models';
import { AppError } from '../utils';
import { ERROR_MESSAGES } from '../constants';

export default async function (req: Request, res: Response, next: NextFunction) {
  const skipAuth =
    new RegExp('/api/v1/(re)?docs/').test(req.path) ||
    req.path === '/openapi/v1' ||
    req.path === '/api/v1/api_key';

  if (skipAuth) {
    return next();
  }

  const apiKey = req.get('api-key');

  if (apiKey === undefined) {
    return next(new AppError(ERROR_MESSAGES.INVALID_MISSING_API_KEY, 401));
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
