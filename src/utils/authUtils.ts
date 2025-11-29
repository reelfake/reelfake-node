import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import sequelize from '../sequelize.config';
import bcrypt from 'bcryptjs';
import { USER_ROLES, ERROR_MESSAGES, envVars } from '../constants';
import { BaseModel, CustomerModel, StaffModel } from '../models';
import { AppError } from '../utils';
import type { GenericModelConstraint } from '../types';

const JWT_SECRET = envVars.jwtSecret || '';

export function generateAuthToken(id: number, email: string, role: USER_ROLES) {
  const auth_token = jwt.sign(
    {
      id,
      email,
      role,
      createdAt: new Date().toISOString(),
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  return auth_token;
}

export async function comparePasswordWithActual<T extends BaseModel & (StaffModel | CustomerModel)>(
  model: GenericModelConstraint<T>,
  id: number,
  password: string | null
) {
  const userInstance = await model.findByPk(id, { attributes: ['userPassword'] });

  if (!userInstance) {
    throw new AppError(ERROR_MESSAGES.RESOURCES_NOT_FOUND, 400);
  }

  const userPassword = userInstance.getDataValue('userPassword');

  const hashedActualPassword = String(userPassword);
  const isPasswordVadlid = await bcrypt.compare(String(password), hashedActualPassword);
  return isPasswordVadlid;
}

export async function updateUserPassword<T extends BaseModel & CustomerModel>(
  modelStatic: GenericModelConstraint<T>,
  id: number,
  newPassword: string
) {
  const email = await sequelize.transaction(async (t) => {
    const modelInstance = await modelStatic.findByPk(id, { transaction: t });

    if (!modelInstance) {
      throw new AppError(ERROR_MESSAGES.RESOURCES_NOT_FOUND, 404);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);

    await modelInstance.update({
      userPassword: hashedNewPassword,
    });
    await modelInstance.save({ transaction: t });

    const email = modelInstance.getDataValue('email');
    return email;
  });

  return email;
}
