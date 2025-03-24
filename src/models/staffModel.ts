import { DataTypes } from 'sequelize';
import BaseModel from './baseModel';
import sequelize from '../sequelize.config';

class Staff extends BaseModel {}

Staff.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      field: 'id',
    },
    firstName: {
      type: DataTypes.STRING(45),
      field: 'first_name',
    },
    lastName: {
      type: DataTypes.STRING(45),
      field: 'last_name',
    },
    email: {
      type: DataTypes.STRING(50),
      field: 'email',
    },
    addressId: {
      type: DataTypes.INTEGER,
      field: 'address_id',
    },
    storeId: {
      type: DataTypes.INTEGER,
      field: 'store_id',
    },
    active: {
      type: DataTypes.BOOLEAN,
      field: 'active',
    },
    phoneNumber: {
      type: DataTypes.STRING(30),
      field: 'phone_number',
    },
    avatar: {
      type: DataTypes.TEXT,
      field: 'avatar',
    },
  },
  {
    sequelize,
    modelName: 'Staff',
    tableName: 'staff',
    timestamps: false,
  }
);

export default Staff;
