import { DataTypes, Op, WhereOptions } from 'sequelize';
import BaseModel from './baseModel';
import sequelize from '../sequelize.config';

class Inventory extends BaseModel {
  public static async getMovieIdsInStore(storeId: number) {
    const results = await Inventory.findAll({
      attributes: ['movieId'],
      where: {
        [Op.and]: {
          storeId,
          stockCount: {
            [Op.gt]: 0,
          },
        },
      },
      order: [['movieId', 'ASC']],
    });

    const ids = results.map<number>((res) => res.toJSON().id);
    return ids;
  }

  public static async getRowsCountWhere(conditions?: WhereOptions) {
    const countOfRows = await Inventory.count({
      where: conditions,
    });
    return countOfRows;
  }
}

Inventory.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      field: 'id',
    },
    movieId: {
      type: DataTypes.INTEGER,
      field: 'movie_id',
    },
    storeId: {
      type: DataTypes.INTEGER,
      field: 'store_id',
    },
    stock: {
      type: DataTypes.INTEGER,
      field: 'stock_count',
    },
  },
  {
    sequelize,
    modelName: 'Inventory',
    tableName: 'inventory',
    timestamps: false,
  }
);

export default Inventory;
