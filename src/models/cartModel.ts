import { WhereOptions, DataTypes } from 'sequelize';
import sequelize from '../sequelize.config';
import BaseModel from './baseModel';

class Cart extends BaseModel {
  public static async getRowsCountWhere(conditions?: WhereOptions) {
    const countOfRows = await Cart.count({
      where: conditions,
    });
    return countOfRows;
  }
}

Cart.init(
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
    quantity: {
      type: DataTypes.INTEGER,
      field: 'quantity',
    },
  },
  {
    sequelize,
    modelName: 'Cart',
    tableName: 'cart',
    timestamps: false,
  },
);

export default Cart;
