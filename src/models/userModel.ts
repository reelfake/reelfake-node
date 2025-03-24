import { DataTypes } from 'sequelize';
import BaseModel from './baseModel';
import sequelize from '../sequelize.config';

class User extends BaseModel {}

User.init(
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
    staffId: {
      type: DataTypes.INTEGER,
      field: 'staff_id',
    },
    managerStaffId: {
      type: DataTypes.INTEGER,
      field: 'manager_staff_id',
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
