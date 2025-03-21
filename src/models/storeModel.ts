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
    managerStaffId: {
      type: DataTypes.INTEGER,
      field: 'manager_staff_id',
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
