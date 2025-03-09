import { DataTypes } from 'sequelize';
import BaseModel from './baseModel';
import sequelize from '../sequelize.config';

class MovieLanguage extends BaseModel {}

MovieLanguage.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      field: 'id',
    },
    languageName: {
      type: DataTypes.STRING(60),
      field: 'language_name',
    },
    languageCode: {
      type: DataTypes.STRING(2),
      field: 'iso_language_code',
    },
  },
  {
    sequelize,
    modelName: 'MovieLanguage',
    tableName: 'movie_language',
    timestamps: false,
  }
);

export default MovieLanguage;
