import { WhereOptions, DataTypes } from 'sequelize';
import sequelize from '../sequelize.config';
import { addressUtils } from '../utils';
import BaseModel from './baseModel';

class Customer extends BaseModel {
  public static async getRowsCountWhere(conditions?: WhereOptions) {
    const countOfRows = await Customer.count({
      where: conditions,
    });
    return countOfRows;
  }

  // public static async getRecordIds(conditions?: WhereOptions) {
  //   const results = await Customer.findAll({
  //     attributes: ['id'],
  //     include: [addressUtils.includeAddress({})],
  //     where: conditions,
  //     order: [['id', 'ASC']],
  //   });
  //   const ids = results.map<number>((res) => res.toJSON().id);
  //   return ids;
  // }
}

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
    phoneNumber: {
      type: DataTypes.STRING(30),
      field: 'phone_number',
    },
    avatar: {
      type: DataTypes.STRING(120),
      field: 'avatar',
    },
    registeredOn: {
      type: DataTypes.DATEONLY,
      field: 'registered_on',
    },
    userPassword: {
      type: DataTypes.STRING(120),
      field: 'user_password',
    },
  },
  {
    sequelize,
    modelName: 'Customer',
    tableName: 'customer',
    timestamps: false,
    defaultScope: {
      attributes: {
        exclude: ['userPassword'],
      },
    },
  }
);

export default Customer;
