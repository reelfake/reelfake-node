import { DataTypes } from 'sequelize';
import BaseModel from './baseModel';
import sequelize from '../sequelize.config';

class Inventory extends BaseModel {}

Inventory.init(
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      field: 'id',
    },
    movieId: {
      type: DataTypes.INTEGER,
      field: 'movie_id',
    },
    storeId: {
      type: DataTypes.INTEGER,
      field: 'store_id',
    },
    stock: {
      type: DataTypes.INTEGER,
      field: 'stock_count',
    },
  },
  {
    sequelize,
    modelName: 'Inventory',
    tableName: 'inventory',
    timestamps: false,
  }
);

export default Inventory;
