import type { Locals, Request } from 'express';
import { DataType, Model } from 'sequelize';
import type { Sequelize } from 'sequelize';

export type KeyValuePair = {
  [key: string]: string | number | boolean | KeyValuePair;
};

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
  validateUserRole?: (fn: () => boolean) => void;
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
  validateUserRole?: (fn: () => boolean) => void;
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
};

export type Address = {
  addressLine: string;
  cityName: string;
  stateName: string;
  country: string;
  postalCode: string;
};

export type ActorPayload = {
  tmdbId: number;
  imdbId?: string;
  actorName: string;
  biography?: string;
  birthday?: Date;
  deathday?: Date;
  placeOfBirth?: string;
  popularity?: number;
  profilePictureUrl?: string;
};

export type MovieActorPayload = ActorPayload & {
  characterName: string;
  castOrder: number;
};

export type StaffPayload = {
  firstName: string;
  lastName: string;
  email: string;
  address: Address;
  storeId: number;
  active: boolean;
  phoneNumber: string;
  avatar: string;
};

export type StorePayload = {
  storeManagerId?: number;
  storeManager?: StaffPayload;
  phoneNumber: string;
  address: Address;
};

export type CustomerPayload = {
  firstName: string;
  lastName: string;
  email: string;
  address: Address;
  active?: boolean;
  preferredStoreId?: string;
  phoneNumber: string;
  avatar?: string;
};
