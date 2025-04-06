import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models';
import { AppError } from '../utils';
import { CustomRequest } from '../types';
import { Op, WhereOptions } from 'sequelize';

const JWT_SECRET = process.env.JWT_SECRET || '';

export const getUser = async (req: CustomRequest, res: Response) => {
  const userFromToken = req.user;

  if (!userFromToken) {
    throw new AppError('Invalid token', 401);
  }

  const { userUUID, userEmail } = userFromToken;

  const existingUser = await UserModel.findOne({
    where: {
      userUUID,
      userEmail,
    },
    attributes: ['userUUID', 'userEmail', 'customerId', 'staffId', 'storeManagerId'],
  });

  res.status(200).json(existingUser);
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

  const { userUUID, userEmail } = currentUser;
  const user = await UserModel.findOne({
    where: {
      userUUID,
      userEmail,
    },
  });

  if (!user) {
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
          userUUID,
        },
      },
    },
  });

  if (usersWithDuplicateSetup > 0) {
    throw new AppError(`Another user with the same config already exist.`, 400);
  }

  user.set({ ...changes });
  await user.save();

  res.status(200).json({
    message: 'User data is updated successfully. You will need to log in again for the changes to take effect.',
  });
};

export const registerUser = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await UserModel.findOne({
    where: {
      userEmail: email,
    },
  });

  if (user) {
    throw new AppError('User already exist', 400);
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  await UserModel.create({ userEmail: email, userPassword: hashedPassword }, { fields: ['userEmail', 'userPassword'] });
  res.status(201).json({ message: 'User is registered successfully' });
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await UserModel.findOne({
    where: {
      userEmail: email,
    },
  });

  if (!user) {
    throw new AppError('Invalid credentials', 401);
  }

  const isPasswordMatch = await bcrypt.compare(password, user.getDataValue('userPassword'));
  if (!isPasswordMatch) {
    throw new AppError('Invalid credentials', 401);
  }

  const auth_token = jwt.sign(
    {
      id: user.getDataValue('userUUID'),
      userEmail: user.getDataValue('userEmail'),
      customerId: user.getDataValue('customerId'),
      staffId: user.getDataValue('staffId'),
      storeManagerId: user.getDataValue('storeManagerId'),
      createdAt: Date.now(),
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  res
    .status(201)
    .cookie('auth_token', auth_token, { httpOnly: true, secure: true, sameSite: 'strict' })
    .json({ message: 'Login successful' });
};

export const logout = (req: Request, res: Response) => {
  res.clearCookie('auth_token').json({ message: 'Logged out successfully' });
};
