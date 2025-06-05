import { DataTypes } from 'sequelize';
import BaseModel from './baseModel';
import Country from './countryModel';
import sequelize from '../sequelize.config';

class City extends BaseModel {
  public static async isCityInState(cityName: string, stateName: string) {
    const cityInstance = await City.findAll({
      where: {
        stateName,
      },
    });

    const cities = cityInstance.map((c) => c.getDataValue('cityName'));
    const cityExist = cities.includes(cityName);
    return cityExist;
  }
}

City.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      field: 'id',
    },
    cityName: {
      type: DataTypes.STRING(50),
      field: 'city_name',
    },
    stateName: {
      type: DataTypes.STRING(60),
      field: 'state_name',
    },
    countryId: {
      type: DataTypes.INTEGER,
      field: 'country_id',
    },
  },
  {
    sequelize,
    modelName: 'City',
    tableName: 'city',
    timestamps: false,
  }
);

export default City;
