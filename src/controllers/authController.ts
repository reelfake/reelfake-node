import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models';
import { AppError } from '../utils';
import { ERROR_MESSAGES } from '../constants';

const JWT_SECRET = process.env.JWT_SECRET || '';

export const registerUser = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await UserModel.findOne({
    where: {
      userEmail: email,
    },
  });

  if (user) {
    throw new AppError('User already exists', 400);
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  await UserModel.create(
    { userEmail: email, userPassword: hashedPassword },
    { fields: ['userEmail', 'userPassword'] }
  );
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

  const token = jwt.sign(
    { id: user.getDataValue('userUUID'), email: user.getDataValue('userEmail') },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  res.cookie('auth_token', token, { httpOnly: true }).json({ message: 'Login successful!' });
};

export const logout = (req: Request, res: Response) => {
  res.status(204).clearCookie('auth_token');
};
