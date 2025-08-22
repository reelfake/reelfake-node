import { DataTypes } from 'sequelize';
import BaseModel from './baseModel';
import sequelize from '../sequelize.config';

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
    },
    userPassword: {
      type: DataTypes.STRING(10),
      field: 'user_password',
    },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'user',
    timestamps: false,
  }
);

export default User;
