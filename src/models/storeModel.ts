import { DataTypes, CreationOptional, Op, col, literal, fn, Includeable, WhereOptions } from 'sequelize';
import BaseModel from './baseModel';
import StaffModel from './staffModel';
import AddressModel from './addressModel';
import CityModel from './cityModel';
import CountryModel from './countryModel';
import { AppError, addressUtils } from '../utils';
import { Address } from '../types';
import sequelize from '../sequelize.config';

class Store extends BaseModel {
  declare id: CreationOptional<number>;
  declare storeManagerId: number;
  declare phoneNumber: string;
  declare cityName: string;
  declare stateName: string;
  declare country: string;
  declare postalCode: string;

  public static async getAddress(storeId: number) {
    const storeAddressInstance = await Store.findOne({
      where: {
        id: storeId,
      },
      attributes: [
        [col(`"address"."address_line"`), 'addressLine'],
        [literal(`"address->city"."city_name"`), 'cityName'],
        [literal(`"address->city"."state_name"`), 'stateName'],
        [literal(`"address->city->country"."country_name"`), 'country'],
        [col(`"address"."postal_code"`), 'postalCode'],
      ],
      include: [addressUtils.includeAddress()],
    });

    if (!storeAddressInstance) {
      throw new AppError(`Store with id ${storeId} not found`, 404);
    }

    return storeAddressInstance.toJSON();
  }

  public static async isAddressInUse(address: Address, exemptedStoreId: number | undefined = undefined) {
    const { addressLine, cityName, stateName, country, postalCode } = address;

    const storeCountInstance = await Store.count({
      include: [
        addressUtils.includeAddress({
          whereAddress: {
            addressLine,
            postalCode,
          },
          whereCity: { cityName, stateName },
          whereCountry: {
            countryName: country,
          },
        }),
      ],
      where: exemptedStoreId
        ? {
            id: {
              [Op.not]: exemptedStoreId,
            },
          }
        : undefined,
    });

    return storeCountInstance > 0;
  }

  public static async getStoreManagerId(storeId: number, includeAddress: boolean) {
    const includes: Includeable[] = [
      {
        model: Store,
        as: 'store',
        attributes: [],
        where: {
          id: {
            [Op.eq]: storeId,
          },
        },
      },
    ];

    if (includeAddress) {
      includes.push({
        model: AddressModel,
        as: 'address',
        attributes: includeAddress
          ? [
              'addressLine',
              [literal(`"address->city"."city_name"`), 'cityName'],
              [literal(`"address->city"."state_name"`), 'stateName'],
              [literal(`"address->city->country"."country_name"`), 'countryName'],
              'postalCode',
            ]
          : [],
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
      });
    }

    const staffInstance = await StaffModel.findOne({
      attributes: ['id'],
      where: {
        id: {
          [Op.eq]: literal(`"store"."store_manager_id"`),
        },
      },
      include: includes,
    });

    if (!staffInstance) {
      throw new AppError('Store not found', 404);
    }

    const storeManagerIdAndAddress = staffInstance.toJSON();
    return storeManagerIdAndAddress;
  }

  public static async isStoreManager(staffId: number, exemptedStoreId: number | undefined = undefined) {
    const where: WhereOptions = {
      storeManagerId: staffId,
    };

    if (exemptedStoreId) {
      where['id'] = {
        [Op.not]: exemptedStoreId,
      };
    }
    const storeInstance = await Store.findOne({
      where,
    });

    return !!storeInstance;
  }

  public static validateAddressAgainstManagerAddress(storeAddress: Address, managerAddress: Address) {
    if (storeAddress.stateName.toLowerCase() !== managerAddress.stateName.toLowerCase()) {
      throw new AppError('Cannot assign manager to store outside state', 400);
    }

    if (
      managerAddress.addressLine.toLowerCase() === storeAddress.addressLine.toLowerCase() &&
      managerAddress.cityName.toLowerCase() === storeAddress.cityName.toLowerCase()
    ) {
      throw new AppError('Store manager address cannot be same as store address', 400);
    }
  }

  public static async getStaffCount(storeId: number) {
    const staffCount = await StaffModel.count({
      where: {
        storeId,
      },
    });

    return staffCount;
  }

  public static async isPhoneNumberInUse(phoneNumber: string, exemptedId: number | undefined = undefined) {
    const where: WhereOptions = { phoneNumber };
    if (exemptedId) {
      where['id'] = {
        [Op.not]: exemptedId,
      };
    }

    const storeCountInstance = await Store.count({
      where,
    });

    return storeCountInstance > 0;
  }
}

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
