import type { Request } from 'express';
import { DataType } from 'sequelize';
import { JwtPayload } from 'jsonwebtoken';
import type { Sequelize } from 'sequelize';

export type ModelField = {
  [key: string]: {
    type: DataType;
    primaryKey?: boolean;
    field: string;
  };
};

export type ModelConfig = {
  modelName: string;
  tableName: string;
  sequelize: Sequelize;
  fields: ModelField;
};

export interface RequestWithToken extends Request {
  token: string | JwtPayload;
}
