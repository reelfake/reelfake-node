import type { Request, Response } from 'express';
import { literal, Op } from 'sequelize';
import bcrypt from 'bcryptjs';
import { CustomerModel, StaffModel, StoreModel, UserModel } from '../models';
import { ERROR_MESSAGES, USER_ROLES } from '../constants';
import { AppError, generateAuthToken } from '../utils';

async function findUser(email: string) {
  const user = await UserModel.findOne({
    attributes: ['id', 'userPassword'],
    where: {
      email,
    },
  });

  if (user) {
    return {
      id: user.getDataValue('id'),
      email,
      password: user.getDataValue('userPassword'),
      role: USER_ROLES.USER,
    };
  }

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

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await findUser(email);

  if (!user) {
    throw new AppError(ERROR_MESSAGES.INVALID_LOGIN_DETAIL, 401);
  }

  const isPasswordMatch = await bcrypt.compare(password, user.password);
  if (!isPasswordMatch) {
    throw new AppError('Invalid credentials', 401);
  }

  const authToken = generateAuthToken(user.email, user.role);

  res
    .status(201)
    .cookie('auth_token', authToken, { httpOnly: true, secure: true, sameSite: 'strict' })
    .json({ message: 'Login successful' });
};

export const logout = (req: Request, res: Response) => {
  res.clearCookie('auth_token').status(200).json({ message: 'Logged out successfully' });
};
