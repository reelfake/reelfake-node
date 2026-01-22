import { WhereOptions, DataTypes } from 'sequelize';
import sequelize from '../sequelize.config';
import BaseModel from './baseModel';

class Wishlist extends BaseModel {
  public static async getRowsCountWhere(conditions?: WhereOptions) {
    const countOfRows = await Wishlist.count({
      where: conditions,
    });
    return countOfRows;
  }
}

Wishlist.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      field: 'id',
    },
    customerId: {
      type: DataTypes.INTEGER,
      field: 'customer_id',
    },
    movieId: {
      type: DataTypes.INTEGER,
      field: 'movie_id',
    },
  },
  {
    sequelize,
    modelName: 'Wishlist',
    tableName: 'wishlist',
    timestamps: false,
  },
);

export default Wishlist;
