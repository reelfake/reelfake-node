import { DataTypes, Transaction, Op } from 'sequelize';
import BaseModel from './baseModel';
import CountryModel from './countryModel';
import CityModel from './cityModel';
import { AppError } from '../utils';
import { Address as AddressType } from '../types';
import sequelize from '../sequelize.config';

class Address extends BaseModel {
  public static async isAddressExist(
    address: AddressType,
    t: Transaction | undefined = undefined,
    excludeAddressId: number | undefined = undefined
  ) {
    const { addressLine, cityName, stateName, country, postalCode } = address;

    const similarAddressCount = await Address.count({
      where: {
        id: {
          [Op.not]: excludeAddressId,
        },
        addressLine: {
          [Op.eq]: addressLine,
        },
        postalCode: {
          [Op.eq]: postalCode,
        },
      },
      include: [
        {
          model: CityModel,
          as: 'city',
          attributes: [],
          where: {
            cityName: {
              [Op.eq]: cityName,
            },
            stateName: {
              [Op.eq]: stateName,
            },
          },
          include: [
            {
              model: CountryModel,
              as: 'country',
              attributes: [],
              where: {
                countryName: {
                  [Op.eq]: country,
                },
              },
            },
          ],
        },
      ],
    });

    const isDuplicateAddress = similarAddressCount > 0;
    return isDuplicateAddress;
  }

  public static async findOrCreateAddress(address: AddressType, t: Transaction | undefined = undefined) {
    const { addressLine, cityName, stateName, country, postalCode } = address;

    if (!addressLine || !cityName || !stateName || !country || !postalCode) {
      throw new AppError('Incomplete address', 400);
    }

    const countryInstance = await CountryModel.findOne({
      where: {
        countryName: country,
      },
      transaction: t,
    });

    if (!countryInstance) {
      throw new AppError('Country not found', 404);
    }

    const countryId = countryInstance.getDataValue('id');

    const cityInstance = await CityModel.findOne({
      where: {
        cityName,
        stateName,
        countryId,
      },
      transaction: t,
    });

    if (!cityInstance) {
      throw new AppError('City not found', 404);
    }

    const cityId = cityInstance.getDataValue('id');

    const [addressInstance, isCreated] = await Address.findOrCreate({
      where: {
        addressLine,
        cityId,
        postalCode,
      },
      fields: ['addressLine', 'cityId', 'postalCode'],
      transaction: t,
    });

    const addressId: number = addressInstance.getDataValue('id');

    return { addressId, isNew: isCreated };
  }

  public static async getUnusedAddresses() {
    const result = await Address.sequelize?.query(`
        with store_staff as (
          select array_append(
            array_agg(staff.address_id), store.address_id
          ) as items from store inner join staff on store.id = staff.store_id
          group by store.address_id
        )
        select a.id, a.address_line, c.city_name, c.state_name, cy.country_name 
        from address as a left join city as c on a.city_id = c.id 
        left join country as cy on c.country_id = cy.id 
        where a.id not in (select distinct unnest(items) from store_staff) order by a.id;
      `);

    return result;
  }

  public static async updateAddress(id: number, address: Partial<AddressType>, t: Transaction | undefined = undefined) {
    const { addressLine, cityName, stateName, country, postalCode } = address;

    if (!addressLine || !cityName || !stateName || !country || !postalCode) {
      throw new AppError('Incomplete address', 400);
    }

    const currentAddressInstance = await Address.findByPk(id, { transaction: t });
    if (!currentAddressInstance) {
      throw new AppError('Address not found', 404);
    }

    let cityId, countryId;

    if (country) {
      const countryInstance = await CountryModel.findOne({
        where: {
          countryName: country,
        },
        transaction: t,
      });

      if (!countryInstance) {
        throw new AppError('Country not found', 404);
      }

      countryId = countryInstance.getDataValue('id');
    }

    if (cityName) {
      const cityInstance = await CityModel.findOne({
        where: {
          cityName,
          stateName: stateName || currentAddressInstance.getDataValue('stateName'),
          countryId: countryId || currentAddressInstance.getDataValue('countryId'),
        },
        transaction: t,
      });

      if (!cityInstance) {
        throw new AppError('City not found', 404);
      }

      cityId = cityInstance.getDataValue('id');
    }

    const newAddressData: { [key: string]: string } = {};
    if (addressLine) {
      newAddressData['addressLine'] = addressLine;
    }
    if (cityId) {
      newAddressData['cityId'] = cityId;
    }
    if (countryId) {
      newAddressData['countryId'] = countryId;
    }
    if (postalCode) {
      newAddressData['postalCode'] = postalCode;
    }

    await currentAddressInstance.update({ ...newAddressData });
    await currentAddressInstance.save({ transaction: t });
  }
}

Address.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      field: 'id',
    },
    addressLine: {
      type: DataTypes.STRING(120),
      field: 'address_line',
    },
    cityId: {
      type: DataTypes.INTEGER,
      field: 'city_id',
    },
    postalCode: {
      type: DataTypes.STRING(10),
      field: 'postal_code',
    },
  },
  {
    sequelize,
    modelName: 'Address',
    tableName: 'address',
    timestamps: false,
  }
);

export default Address;
