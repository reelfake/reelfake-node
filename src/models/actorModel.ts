import { DataTypes } from 'sequelize';
import BaseModel from './baseModel';
import sequelize from '../sequelize.config';

class Actor extends BaseModel {}

Actor.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      field: 'id',
    },
    tmdbId: {
      type: DataTypes.INTEGER,
      field: 'tmdb_id',
    },
    imdbId: {
      type: DataTypes.INTEGER,
      field: 'imdb_id',
    },
    actorName: {
      type: DataTypes.STRING,
      field: 'actor_name',
    },
    biography: {
      type: DataTypes.TEXT,
      field: 'biography',
    },
    birthday: {
      type: DataTypes.DATE,
      field: 'birthday',
    },
    deathday: {
      type: DataTypes.DATE,
      field: 'deathday',
    },
    placeOfBirth: {
      type: DataTypes.STRING,
      field: 'place_of_birth',
    },
    popularity: {
      type: DataTypes.REAL,
      field: 'popularity',
    },
    profilePictureUrl: {
      type: DataTypes.STRING,
      field: 'profile_picture_url',
    },
  },
  {
    sequelize,
    modelName: 'Actor',
    tableName: 'actor',
    timestamps: false,
  }
);

export default Actor;
