import { DataTypes } from 'sequelize';
import BaseModel from './baseModel';
import sequelize, { sequelize_users } from '../sequelize.config';

class User extends BaseModel {
  declare customerId: number;
  declare staffId: number;
  declare storeManagerId: number;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      autoIncrementIdentity: true,
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
    customerId: {
      type: DataTypes.INTEGER,
      field: 'customer_id',
    },
    staffId: {
      type: DataTypes.INTEGER,
      field: 'staff_id',
    },
    storeManagerId: {
      type: DataTypes.INTEGER,
      field: 'store_manager_id',
    },
    email: {
      type: DataTypes.STRING(150),
      field: 'email',
      allowNull: false,
    },
    userPassword: {
      type: DataTypes.STRING(60),
      field: 'user_password',
      allowNull: false,
    },
  },
  {
    sequelize: sequelize_users,
    modelName: 'User',
    tableName: 'user',
    timestamps: process.env.NODE_ENV !== 'test',
  }
);

export default User;
