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

export interface CustomRequest extends Request {
  user?: {
    userUUID: string;
    userEmail: string;
    customerId?: number;
    staffId?: number;
    managerStaffId?: number;
  };
  genres?: string[];
  languages?: string[];
  languageIds?: number[];
}

export type IncomingMovie = {
  tmdbId: number;
  imdbId: string;
  title: string;
  originalTitle: string;
  overview: string;
  runtime: number;
  releaseDate: Date;
  genres: string[];
  countriesOfOrigin: string[];
  language: string;
  movieStatus: string;
  popularity: number;
  budget: bigint;
  revenue: bigint;
  ratingAverage: number;
  ratingCount: number;
  posterUrl: string;
  rentalRate: number;
  rentalDuration: number;
};
