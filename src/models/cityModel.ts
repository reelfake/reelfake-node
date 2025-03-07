import { DataTypes, Model } from 'sequelize';
import Country from './countryModel';
import sequelize from '../sequelize.config';

class City extends Model {}

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

City.belongsTo(Country, { as: 'country', foreignKey: 'country_id' });

export default City;
