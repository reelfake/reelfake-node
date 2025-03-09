import { DataTypes } from 'sequelize';
import BaseModel from './baseModel';
import sequelize from '../sequelize.config';

class Country extends BaseModel {}

Country.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      field: 'id',
    },
    countryName: {
      type: DataTypes.STRING(60),
      field: 'country_name',
    },
    countryCode: {
      type: DataTypes.STRING(2),
      field: 'iso_country_code',
    },
  },
  {
    sequelize,
    modelName: 'Country',
    tableName: 'country',
    timestamps: false,
  }
);

export default Country;
