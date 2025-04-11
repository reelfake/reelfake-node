import type { Locals, Request } from 'express';
import { DataType, Model } from 'sequelize';
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

export type TransactionResult = {
  status: 'success' | 'error';
  errorMessage: string;
  data: Model;
};

export interface CustomRequest extends Request {
  user?: {
    userUUID: string;
    userEmail: string;
    customerId?: number;
    staffId?: number;
    storeManagerId?: number;
  };
  genres?: string[];
  languages?: string[];
  languageIds?: number[];
}

export interface CustomRequestWithBody<M> extends Request<{ [key: string]: string }, {}, M> {
  user?: {
    userUUID: string;
    userEmail: string;
    customerId?: number;
    staffId?: number;
    storeManagerId?: number;
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
  rentalRate?: number;
  rentalDuration?: number;
  actors?: NewMovieActorPayload[];
};

export type NewMovieActorPayload = {
  tmdbId: number;
  imdbId: string;
  actorName: string;
  biography: string;
  birthday: Date;
  deathday: Date;
  placeOfBirth: string;
  popularity: number;
  profilePictureUrl: string;
  characterName: string;
  castOrder: number;
};

export type StorePayload = {
  storeManagerId: number;
  phoneNumber: string;
  address: {
    addressLine: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
};
