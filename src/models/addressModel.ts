import { DataTypes } from 'sequelize';
import BaseModel from './baseModel';
import sequelize from '../sequelize.config';

class Address extends BaseModel {}

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
