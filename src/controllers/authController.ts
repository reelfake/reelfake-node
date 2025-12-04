import type { Request, Response } from 'express';
import { literal, Op } from 'sequelize';
import bcrypt from 'bcryptjs';
import { CustomerModel, StaffModel, StoreModel } from '../models';
import { ERROR_MESSAGES, USER_ROLES, TOKEN_EXPIRING_IN_MS } from '../constants';
import { AppError, generateAuthToken } from '../utils';
import { CustomRequest } from '../types';

async function findUser(email: string) {
  const customer = await CustomerModel.findOne({
    attributes: ['id', 'userPassword'],
    where: {
      email,
    },
  });

  if (customer) {
    return {
      id: customer.getDataValue('id'),
      email,
      password: customer.getDataValue('userPassword'),
      role: USER_ROLES.CUSTOMER,
    };
  }

  const storeManager = await StaffModel.findOne({
    where: {
      id: {
        [Op.eq]: literal(`"store"."store_manager_id"`),
      },
      email,
    },
    attributes: ['id', 'userPassword'],
    include: [
      {
        model: StoreModel,
        as: 'store',
        attributes: [],
      },
    ],
  });

  if (storeManager) {
    return {
      id: storeManager.getDataValue('id'),
      email,
      password: storeManager.getDataValue('userPassword'),
      role: USER_ROLES.STORE_MANAGER,
    };
  }

  const staff = await StaffModel.findOne({
    attributes: ['id', 'userPassword'],
    where: {
      email,
    },
  });

  if (staff) {
    return {
      id: staff.getDataValue('id'),
      email,
      password: staff.getDataValue('userPassword'),
      role: USER_ROLES.STAFF,
    };
  }

  return undefined;
}

async function getUserData(id: number, userRole: USER_ROLES) {
  let userData;

  switch (userRole) {
    case USER_ROLES.CUSTOMER:
      userData = await CustomerModel.getCustomerDetail(id);
      break;
    case USER_ROLES.STAFF:
    case USER_ROLES.STORE_MANAGER:
      userData = await StaffModel.getStaffDetail(id);
      break;
    default:
      throw new AppError(ERROR_MESSAGES.INVALID_AUTH_TOKEN, 401);
  }

  return userData;
}

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError(ERROR_MESSAGES.INVALID_LOGIN_DETAIL, 401);
  }

  const user = await findUser(email);

  if (!user) {
    throw new AppError(ERROR_MESSAGES.INVALID_LOGIN_DETAIL, 401);
  }

  if (!user.password) {
    throw new AppError(ERROR_MESSAGES.INVALID_LOGIN_DETAIL, 401);
  }

  const isPasswordMatch = await bcrypt.compare(password, user.password);
  if (!isPasswordMatch) {
    throw new AppError(ERROR_MESSAGES.INVALID_LOGIN_DETAIL, 401);
  }

  const authToken = generateAuthToken(user.id, user.email, user.role);

  const userData = await getUserData(user.id, user.role);

  res
    .status(200)
    .cookie('auth_token', authToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: TOKEN_EXPIRING_IN_MS,
    })
    .send(userData);
};

export const logout = (req: Request, res: Response) => {
  res.clearCookie('auth_token').status(200).json({ message: 'Logged out successfully' });
};

export const getUserProfile = async (req: CustomRequest, res: Response) => {
  const { user } = req;

  if (!user) {
    throw new AppError(ERROR_MESSAGES.INVALID_AUTH_TOKEN, 401);
  }

  const userData = await getUserData(user.id, user.role);

  res.status(200).send(userData);
};
