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

    const userEmail = (decodedToken as { [key: string]: string })['email'];
    const userRole = (decodedToken as { [key: string]: USER_ROLES })['role'];

    if (!userRole) {
      throw new AppError(ERROR_MESSAGES.INVALID_AUTH_TOKEN, 401);
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

export async function validateNewPassword(
  req: CustomRequestWithBody<{ currentPassword: string; newPassword: string; confirmedNewPassword: string }>,
  res: Response,
  next: NextFunction
) {
  const { currentPassword, newPassword, confirmedNewPassword } = req.body;
  const { id: idText } = req.params;

  const id = Number(idText);
  if (isNaN(id) || id <= 0) {
    throw new AppError('Invalid resource id', 400);
  }

  const forgotPassword = req.path.endsWith('/forgot_password');

  if ((!forgotPassword && !currentPassword) || !newPassword || !confirmedNewPassword) {
    throw new AppError(ERROR_MESSAGES.REQUEST_BODY_MISSING, 400);
  }

  let isPasswordInRequestCorrect = true;

  if (!forgotPassword && req.originalUrl.startsWith('/api/customers')) {
    isPasswordInRequestCorrect = await comparePasswordWithActual<CustomerModel>(CustomerModel, id, currentPassword);
  }

  if (!forgotPassword && req.originalUrl.startsWith('/api/staff')) {
    isPasswordInRequestCorrect = await comparePasswordWithActual<StaffModel>(StaffModel, id, currentPassword);
  }

  if (!isPasswordInRequestCorrect) {
    throw new AppError(ERROR_MESSAGES.RESET_PASSWORD_CURRENT_ACTUAL_MISMATCH, 400);
  }

  if (newPassword !== confirmedNewPassword) {
    throw new AppError(ERROR_MESSAGES.RESET_PASSWORD_MISMATCH, 400);
  }

  if (String(newPassword).length < 8 || String(confirmedNewPassword).length < 8) {
    throw new AppError(ERROR_MESSAGES.PASSWORD_LENGTH_NOT_MET, 400);
  }

  next();
}

export function validateUserRole(...roles: USER_ROLES[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { user } = req as CustomRequest;
    // console.log('hello 1', user);
    if (!user) {
      throw new AppError(ERROR_MESSAGES.INVALID_AUTH_TOKEN, 401);
    }
    // console.log('hello 2', roles, user.role);
    if (!roles.includes(user.role)) {
      throw new AppError(ERROR_MESSAGES.FORBIDDEN, 403);
    }

    next();
  };
}
