import { DataTypes } from 'sequelize';
import BaseModel from './baseModel';
import sequelize from '../sequelize.config';

class Genre extends BaseModel {}

Genre.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      field: 'id',
    },
    genreName: {
      type: DataTypes.STRING(25),
      field: 'genre_name',
    },
  },
  {
    sequelize,
    modelName: 'Genre',
    tableName: 'genre',
    timestamps: false,
  }
);

export default Genre;
