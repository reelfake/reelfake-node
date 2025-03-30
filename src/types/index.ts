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

export type NewMovieData = {
  // id INT,
  // tmdb_id INT,
  // imdb_id CHARACTER VARYING(60),
  // title CHARACTER VARYING(255),
  // original_title CHARACTER VARYING(255),
  // overview TEXT,
  // runtime INT,
  // release_date DATE,
  // genres CHARACTER VARYING(25)[],
  // country CHARACTER VARYING(60)[],
  // movie_language CHARACTER VARYING(60),
  // movie_status CHARACTER VARYING(20),
  // popularity REAL,
  // budget INTEGER,
  // revenue INTEGER,
  // rating_average REAL,
  // rating_count INT,
  // poster_url CHARACTER VARYING(90),
  // rental_rate NUMERIC(4,2),
  // rental_duration SMALLINT
};
