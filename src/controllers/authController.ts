import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models';
import { AppError } from '../utils';

const JWT_SECRET = process.env.JWT_SECRET || '';

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

  const auth_token = jwt.sign(
    {
      id: user.getDataValue('userUUID'),
      email: user.getDataValue('userEmail'),
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
