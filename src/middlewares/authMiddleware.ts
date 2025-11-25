import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError, comparePasswordWithActual } from '../utils';
import { ERROR_MESSAGES, USER_ROLES } from '../constants';
import { CustomerModel, StaffModel } from '../models';
import { CustomRequest, CustomRequestWithBody } from '../types';

export default function (req: Request, res: Response, next: NextFunction) {
  const token = req.cookies.auth_token;
  if (!token) {
    return next(new AppError(ERROR_MESSAGES.INVALID_AUTH_TOKEN, 401));
  }
  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET || '', {
      ignoreExpiration: false, // default
    });

    const userId = (decodedToken as { [key: string]: string })['id'];
    const userEmail = (decodedToken as { [key: string]: string })['email'];
    const userRole = (decodedToken as { [key: string]: USER_ROLES })['role'];
    if (!userRole) {
      throw new AppError(ERROR_MESSAGES.INVALID_AUTH_TOKEN, 401);
    }
    (req as CustomRequest).user = {
      id: Number(userId),
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

export async function validateNewPassword(
  req: CustomRequestWithBody<{ currentPassword: string; newPassword: string; confirmedNewPassword: string }>,
  res: Response,
  next: NextFunction
) {
  const { user } = req;
  const { currentPassword, newPassword, confirmedNewPassword } = req.body;
  const { id: idText } = req.params;
  const id = idText ? Number(idText) : Number(user?.id);

  if (isNaN(id) || id <= 0) {
    return next(new AppError('Invalid resource id', 400));
  }

  const isChangingPassword = req.path.endsWith('/change_password');

  if ((isChangingPassword && !currentPassword) || !newPassword || !confirmedNewPassword) {
    return next(new AppError(ERROR_MESSAGES.REQUEST_BODY_MISSING, 400));
  }

  let isPasswordInRequestCorrect = true;

  if (isChangingPassword && req.originalUrl.startsWith('/api/customers')) {
    isPasswordInRequestCorrect = await comparePasswordWithActual<CustomerModel>(CustomerModel, id, currentPassword);
  }

  if (isChangingPassword && req.originalUrl.startsWith('/api/staff')) {
    isPasswordInRequestCorrect = await comparePasswordWithActual<StaffModel>(StaffModel, id, currentPassword);
  }

  if (!isPasswordInRequestCorrect) {
    return next(new AppError(ERROR_MESSAGES.RESET_PASSWORD_CURRENT_ACTUAL_MISMATCH, 400));
  }

  if (newPassword !== confirmedNewPassword) {
    return next(new AppError(ERROR_MESSAGES.RESET_PASSWORD_MISMATCH, 400));
  }

  if (String(newPassword).length < 8 || String(confirmedNewPassword).length < 8) {
    return next(new AppError(ERROR_MESSAGES.PASSWORD_LENGTH_NOT_MET, 400));
  }

  next();
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

export function allowOnlyMe(req: Request, res: Response, next: NextFunction) {
  const isProdEnvironment = process.env['NODE_ENV'] === 'production';

  if (
    isProdEnvironment &&
    process.env['SHOULD_BLOCK_NON_OWNER'] === 'true' &&
    process.env['API_OWNER_SECRET_KEY'] === undefined
  ) {
    next(new AppError(ERROR_MESSAGES.NON_OWNER_NOT_ALLOWED, 403));
    return;
  }

  if (
    isProdEnvironment &&
    process.env['SHOULD_BLOCK_NON_OWNER'] === 'true' &&
    process.env['API_OWNER_SECRET_KEY'] === undefined &&
    req.headers['API_OWNER_SECRET_KEY'] !== process.env['API_OWNER_SECRET_KEY']
  ) {
    const disallowedMethods = ['PUT', 'PATCH', 'DELETE', 'POST'];
    const disallowedGETPaths = ['/api/movies/upload/track'];
    const allowedPOSTPaths = ['/api/movies/upload/validate'];
    const allowedPaths = [
      /^\/api\/auth\/(login|logout)$/,
      /\/api\/(staff|customers)\/register^$/,
      /^\/api\/(staff|customers)\/[0-9]+\/(forgot_password|change_password)$/,
    ];

    if (
      (disallowedMethods.includes(req.method) && !allowedPaths.some((path) => path.test(req.path))) ||
      (req.method === 'GET' && disallowedGETPaths.includes(req.path)) ||
      (req.method === 'POST' && !allowedPOSTPaths.includes(req.path))
    ) {
      next(new AppError(ERROR_MESSAGES.NON_OWNER_NOT_ALLOWED, 403));
    } else {
      next();
    }
  } else {
    next();
  }
}
