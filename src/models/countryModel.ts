import { DataTypes, Model } from 'sequelize';
import sequelize from '../sequelize.config';

class Country extends Model {}

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
