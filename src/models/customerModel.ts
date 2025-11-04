import { WhereOptions, DataTypes } from 'sequelize';
import sequelize from '../sequelize.config';
import BaseModel from './baseModel';
import { addressUtils, AppError } from '../utils';
import { ERROR_MESSAGES } from '../constants';
import StoreModel from './storeModel';
import StaffModel from './staffModel';

class Customer extends BaseModel {
  public static async getRowsCountWhere(conditions?: WhereOptions) {
    const countOfRows = await Customer.count({
      where: conditions,
    });
    return countOfRows;
  }

  public static async getCustomerDetail(id: number) {
    const instance = await Customer.findByPk(id, {
      attributes: { exclude: ['addressId', 'preferredStoreId'] },
      include: [
        {
          model: StoreModel,
          as: 'preferredStore',
          attributes: ['id', 'phoneNumber'],
          required: false,
          include: [
            {
              model: StaffModel,
              as: 'storeManager',
              attributes: ['id', 'firstName', 'lastName', 'email', 'active', 'phoneNumber', 'avatar'],
              required: false,
              include: [addressUtils.includeAddress({ addressPath: 'preferredStore->storeManager->address' })],
            },
            addressUtils.includeAddress({ addressPath: 'preferredStore->address' }),
          ],
        },
        addressUtils.includeAddress({ addressPath: 'address' }, false),
      ],
    });

    if (!instance) {
      throw new AppError(ERROR_MESSAGES.RESOURCES_NOT_FOUND, 404);
    }

    const detail = instance.toJSON();

    return detail;
  }
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
