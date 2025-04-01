import { DataTypes } from 'sequelize';
import BaseModel from './baseModel';
import sequelize from '../sequelize.config';

class Store extends BaseModel {}

Store.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      field: 'id',
    },
    storeManagerId: {
      type: DataTypes.INTEGER,
      field: 'store_manager_id',
    },
    addressId: {
      type: DataTypes.INTEGER,
      field: 'address_id',
    },
    phoneNumber: {
      type: DataTypes.STRING(30),
      field: 'phone_number',
    },
  },
  {
    sequelize,
    modelName: 'Store',
    tableName: 'store',
    timestamps: false,
  }
);

export default Store;
