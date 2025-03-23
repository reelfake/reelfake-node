import { DataTypes } from 'sequelize';
import BaseModel from './baseModel';
import sequelize from '../sequelize.config';

class ApiKey extends BaseModel {}

ApiKey.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      field: 'id',
    },
    apiKey: {
      type: DataTypes.UUIDV4,
      field: 'api_key',
    },
    emailAddress: {
      type: DataTypes.STRING,
      unique: true,
      field: 'email_address',
    },
    expiringAt: {
      type: DataTypes.DATE,
      field: 'expiring_at',
    },
  },
  {
    sequelize,
    modelName: 'ApiKey',
    tableName: 'api_key',
    timestamps: false,
  }
);

export default ApiKey;
