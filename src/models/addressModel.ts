import { DataTypes, Transaction } from 'sequelize';
import BaseModel from './baseModel';
import CountryModel from './countryModel';
import CityModel from './cityModel';
import { AppError } from '../utils';
import { Address as AddressType } from '../types';
import sequelize from '../sequelize.config';

class Address extends BaseModel {
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

    const [addressInstance] = await Address.findOrCreate({
      where: {
        addressLine,
        cityId,
        postalCode,
      },
      fields: ['addressLine', 'cityId', 'postalCode'],
      transaction: t,
    });

    const addressId = addressInstance.getDataValue('id');

    return addressId;
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
