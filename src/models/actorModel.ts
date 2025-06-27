import { DataTypes, CreationOptional, WhereOptions } from 'sequelize';
import BaseModel from './baseModel';
import sequelize from '../sequelize.config';

class Actor extends BaseModel {
  declare id: CreationOptional<number>;
  declare tmdbId: number;
  declare imdbId: string;
  declare actorName: string;
  declare biography: string;
  declare birthday: Date;
  declare deathday: Date;
  declare placeOfBirth: string;
  declare popularity: number;
  declare profilePictureUrl: string;

  public static async getRowsCountWhere(conditions?: WhereOptions) {
    const countOfRows = await Actor.count({
      where: conditions,
    });
    return countOfRows;
  }

  public static async getRecordIds(conditions?: WhereOptions) {
    const results = await Actor.findAll({
      attributes: ['id'],
      where: conditions,
      order: [['id', 'ASC']],
    });
    const ids = results.map<number>((res) => res.toJSON().id);
    return ids;
  }
}

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
      unique: true,
    },
    imdbId: {
      type: DataTypes.INTEGER,
      field: 'imdb_id',
      allowNull: true,
      unique: true,
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
      type: DataTypes.DATEONLY,
      field: 'birthday',
    },
    deathday: {
      type: DataTypes.DATEONLY,
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
