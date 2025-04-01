import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models';
import { AppError } from '../utils';
import { ERROR_MESSAGES } from '../constants';
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
    const userUUID = (decodedToken as { [key: string]: string })['id'];
    const userEmail = (decodedToken as { [key: string]: string })['userEmail'];
    const customerId = (decodedToken as { [key: string]: string })['customerId'];
    const staffId = (decodedToken as { [key: string]: string })['staffId'];
    const managerStaffId = (decodedToken as { [key: string]: string })['managerStaffId'];
    (req as CustomRequest).user = {
      userUUID,
      userEmail,
      customerId: Number(customerId),
      staffId: Number(staffId),
      managerStaffId: Number(managerStaffId),
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

// export async function validateUserIsManagerStaff(req: Request, res: Response, next: NextFunction) {
//   const token = req.cookies.auth_token;

//   try {
//     const decodedToken = jwt.verify(token, process.env.JWT_SECRET || '');
//     const userUUID = (decodedToken as { [key: string]: string })['id'];
//     const userEmail = (decodedToken as { [key: string]: string })['email'];
//     const user = await UserModel.findOne({
//       where: {
//         userUUID,
//         userEmail,
//       },
//     });
//     if (user && user.getDataValue('managerStaffId')) {
//       return next();
//     }
//     next(new AppError('You are not authorized to perform this operation', 403));
//   } catch (err: unknown) {
//     if (process.env.NODE_ENV === 'prod') {
//       next(new AppError('Error validating token', 401));
//     } else {
//       next(err);
//     }
//   }
// }
