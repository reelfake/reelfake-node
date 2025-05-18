import { DataTypes, WhereOptions, Op, fn, col, literal } from 'sequelize';
import BaseModel from './baseModel';
import StoreModel from './storeModel';
import AddressModel from './addressModel';
import CityModel from './cityModel';
import CountryModel from './countryModel';
import { Address as AddressType } from '../types';
import { AppError, addressUtils } from '../utils';
import sequelize from '../sequelize.config';

class Staff extends BaseModel {
  public static async getAddress(staffId: number) {
    const staffInstance = await Staff.findOne({
      attributes: [
        [col(`"address"."address_line"`), 'addressLine'],
        [literal(`"address->city"."city_name"`), 'cityName'],
        [literal(`"address->city"."state_name"`), 'stateName'],
        [literal(`"address->city->country"."country_name"`), 'country'],
        [col(`"address"."postal_code"`), 'postalCode'],
      ],
      include: [addressUtils.getAddressAssociations()],
      where: {
        id: staffId,
      },
    });

    if (!staffInstance) {
      throw new AppError(`Staff with id ${staffId} not found`, 404);
    }

    return staffInstance.toJSON();
  }

  public static async isAddressInUse(address: AddressType, exemptedId: number | undefined = undefined) {
    const { addressLine, cityName, stateName, country, postalCode } = address;

    const staffCountInstance = await Staff.count({
      include: [
        addressUtils.getAddressAssociations(
          { addressLine, postalCode },
          { cityName, stateName },
          { countryName: country }
        ),
      ],
      where: exemptedId ? { id: { [Op.not]: exemptedId } } : undefined,
    });

    return staffCountInstance > 0;
  }

  public static async isPhoneNumberInUse(phoneNumber: string, exemptedId: number | undefined = undefined) {
    const where: WhereOptions = {
      phoneNumber,
    };

    if (exemptedId) {
      where['id'] = {
        [Op.not]: exemptedId,
      };
    }

    const storeCountInstance = await Staff.count({
      where,
    });

    return storeCountInstance > 0;
  }

  public static async isEmailInUse(email: string, exemptedId: number | undefined = undefined) {
    const where: WhereOptions = {
      email,
    };

    if (exemptedId) {
      where['id'] = {
        [Op.not]: exemptedId,
      };
    }

    const storeCountInstance = await Staff.count({
      where,
    });

    return storeCountInstance > 0;
  }

  public static async getStore(staffId: number) {
    const storeInstance = await Staff.findByPk(staffId, {
      attributes: [
        [col(`"store"."id"`), 'id'],
        [col(`"store"."phone_number"`), 'phoneNumber'],
        [col(`"store"."store_manager_id"`), 'storeManagerId'],
        [
          fn(
            'json_build_object',
            'addressLine',
            literal(`"store->address"."address_line"`),
            'cityName',
            literal(`"store->address->city"."city_name"`),
            'stateName',
            literal(`"store->address->city"."state_name"`),
            'country',
            literal(`"store->address->city->country"."country_name"`),
            'postalCode',
            literal(`"store->address"."postal_code"`)
          ),
          'address',
        ],
      ],
      include: [
        {
          model: StoreModel,
          as: 'store',
          attributes: [],
          include: [
            {
              model: AddressModel,
              as: 'address',
              attributes: [],
              include: [
                {
                  model: CityModel,
                  as: 'city',
                  attributes: [],
                  include: [
                    {
                      model: CountryModel,
                      as: 'country',
                      attributes: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    if (!storeInstance?.getDataValue('id')) {
      return undefined;
    }

    const storeData = storeInstance?.toJSON();
    return storeData;
  }

  public static async getStoreId(staffId: number) {
    const staff = await Staff.findByPk(staffId, {
      attributes: ['storeId'],
    });

    if (!staff) {
      return null;
    }

    return Number(staff.getDataValue('id'));
  }
}

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
    userPassword: {
      type: DataTypes.STRING(120),
      field: 'user_password',
    },
  },
  {
    sequelize,
    modelName: 'Staff',
    tableName: 'staff',
    timestamps: false,
    defaultScope: {
      attributes: {
        exclude: ['userPassword'],
      },
    },
  }
);

Staff.addHook('beforeCreate', async (instance, options) => {
  const { firstName, lastName, email, addressId, phoneNumber } = instance.dataValues;

  const staffCount = await Staff.count({
    where: {
      firstName: firstName,
      lastName: lastName,
      addressId,
      phoneNumber: phoneNumber,
    },
  });

  if (staffCount > 1) {
    throw new AppError('ATTENTION: More than 1 staff with the similar data', 500);
  }

  if (staffCount === 1) {
    throw new AppError('Staff already exist with the similar data', 400);
  }
});

export default Staff;
