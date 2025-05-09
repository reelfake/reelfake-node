import { Op } from 'sequelize';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { UserModel } from '../models';
import { AppError, generateAuthToken } from '../utils';
import { ERROR_MESSAGES } from '../constants';
import { CustomRequest } from '../types';

async function findUser(email: string) {
  const user = await UserModel.findOne({
    where: {
      email,
    },
  });

  return user;
}

export const getUser = async (req: CustomRequest, res: Response) => {
  const { user } = req;

  if (!user) {
    throw new AppError(ERROR_MESSAGES.INVALID_AUTH_TOKEN, 401);
  }

  const { email } = user;

  const userInstance = await UserModel.findOne({
    where: {
      email,
    },
    attributes: ['email', 'customerId', 'staffId', 'storeManagerId'],
  });

  if (!userInstance) {
    throw new AppError(ERROR_MESSAGES.USER_NOT_FOUND, 404);
  }

  const userData = userInstance.toJSON();

  res.status(200).json(userData);
};

export const updateUser = async (req: CustomRequest, res: Response) => {
  const currentUser = req.user;
  const { customerId, staffId, storeManagerId } = req.body as {
    customerId?: number;
    staffId?: number;
    storeManagerId?: number;
  };

  if (!customerId && !staffId && !storeManagerId) {
    throw new AppError('Either of customer, staff or manager staff id is required', 400);
  }

  if (!currentUser) {
    throw new AppError('Invalid token', 401);
  }

  const { email } = currentUser;
  const userToUpdate = await findUser(email);

  if (!userToUpdate) {
    throw new AppError('Error finding user with the given user remail', 500);
  }

  const conditions = [];
  const changes: { customerId?: number; staffId?: number; storeManagerId?: number } = {};

  if (customerId) {
    conditions.push({ customerId });
    changes.customerId = customerId;
  }

  if (staffId) {
    conditions.push({ staffId });
    changes.staffId = staffId;
  }

  if (storeManagerId) {
    conditions.push({ storeManagerId });
    changes.storeManagerId = storeManagerId;
  }

  const usersWithDuplicateSetup = await UserModel.count({
    where: {
      [Op.and]: {
        [Op.or]: conditions,
        [Op.not]: {
          email: currentUser.email,
        },
      },
    },
  });

  if (usersWithDuplicateSetup > 0) {
    throw new AppError(`Another user with the same config already exist`, 400);
  }

  userToUpdate.set({ ...changes });
  await userToUpdate.save();

  const updatedUser = await findUser(email);

  if (!updatedUser) {
    throw new AppError('Error updating the user details', 500);
  }

  const newAuthToken = generateAuthToken(currentUser.email, currentUser.role);

  res.status(204).cookie('auth_token', newAuthToken, { httpOnly: true, secure: true, sameSite: 'strict' }).send();
};

export const registerUser = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await UserModel.findOne({
    where: {
      email,
    },
  });

  if (user) {
    throw new AppError('User already exist', 400);
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  await UserModel.create({ email, userPassword: hashedPassword }, { fields: ['email', 'userPassword'] });
  res.status(201).json({ message: 'User is registered successfully' });
};
