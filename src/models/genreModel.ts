import { DataTypes, Model } from 'sequelize';
import sequelize from '../sequelize.config';

class Genre extends Model {}

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
