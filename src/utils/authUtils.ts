import jwt from 'jsonwebtoken';
import { USER_ROLES } from '../constants';

const JWT_SECRET = process.env.JWT_SECRET || '';

export function generateAuthToken(email: string, role: USER_ROLES) {
  const auth_token = jwt.sign(
    {
      email,
      role,
      createdAt: new Date().toISOString(),
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  return auth_token;
}
