import { DataTypes } from 'sequelize';
import sequelize from '../sequelize.config';
import BaseModel from './baseModel';

class Customer extends BaseModel {}

Customer.init(
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
    preferredStoreId: {
      type: DataTypes.INTEGER,
      field: 'preferred_store_id',
    },
    active: {
      type: DataTypes.BOOLEAN,
      field: 'active',
    },
    userName: {
      type: DataTypes.STRING(40),
      field: 'user_name',
    },
    userPassword: {
      type: DataTypes.STRING(40),
      field: 'user_password',
    },
    avatar: {
      type: DataTypes.STRING(120),
      field: 'avatar',
    },
    registeredOn: {
      type: DataTypes.DATEONLY,
      field: 'registered_on',
    },
  },
  {
    sequelize,
    modelName: 'Customer',
    tableName: 'customer',
    timestamps: false,
  }
);

export default Customer;
