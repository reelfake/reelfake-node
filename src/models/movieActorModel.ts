import { DataTypes } from 'sequelize';
import BaseModel from './baseModel';
import sequelize from '../sequelize.config';

class MovieActor extends BaseModel {}

MovieActor.init(
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      field: 'id',
    },
    movieId: {
      type: DataTypes.BIGINT,
      field: 'movie_id',
    },
    actorId: {
      type: DataTypes.BIGINT,
      field: 'actor_id',
    },
    characterName: {
      type: DataTypes.STRING,
      field: 'character_name',
    },
    castOrder: {
      type: DataTypes.INTEGER,
      field: 'cast_order',
    },
  },
  {
    sequelize,
    modelName: 'MovieActor',
    tableName: 'movie_actor',
    timestamps: false,
  }
);

export default MovieActor;
