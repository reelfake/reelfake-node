import type { Response } from 'express';
import { literal } from 'sequelize';
import { InventoryModel, MovieModel, StoreModel, MovieLanguageModel, StaffModel, BaseModel } from '../models';
import { AppError, addressUtils } from '../utils';
import { ERROR_MESSAGES, movieModelAttributes } from '../constants';
import { CustomRequest } from '../types';
import sequelize from '../sequelize.config';

const isMovieExist = async (id: number) => {
  const storeInstance = await MovieModel.findByPk(id);
  if (!storeInstance) {
    throw new AppError(ERROR_MESSAGES.STORE_NOT_FOUND, 404);
  }
};

export const addInventory = async (req: CustomRequest, res: Response) => {
  const { user } = req;

  if (!user) {
    throw new AppError(ERROR_MESSAGES.INVALID_AUTH_TOKEN, 401);
  }

  const { movie_id: movieId, store_id: storeId, stock_count } = req.body;
  if (!movieId || !storeId || !stock_count) {
    throw new AppError(ERROR_MESSAGES.REQUEST_BODY_MISSING, 400);
  }

  const stockCount = Number(stock_count);

  if ((stock_count && isNaN(stockCount)) || stockCount <= 0) {
    throw new AppError(ERROR_MESSAGES.STOCK_COUNT_MUST_BE_NUMBER, 400);
  }

  const movieInstance = await MovieModel.findByPk(movieId, { attributes: ['id'] });
  if (!movieInstance) {
    throw new AppError(ERROR_MESSAGES.MOVIE_NOT_FOUND, 404);
  }

  const storeInstance = await StoreModel.findByPk(storeId, { attributes: ['id'] });
  if (!storeInstance) {
    throw new AppError(ERROR_MESSAGES.STORE_NOT_FOUND, 404);
  }

  const multipleInventory = await InventoryModel.findAll({
    where: {
      movieId,
      storeId,
    },
  });

  if (multipleInventory.length > 1) {
    throw new AppError(`Multiple inventory found with movie id ${movieId} and store id ${storeId}`, 500);
  }

  if (multipleInventory.length === 1) {
    throw new AppError('Inventory with given movie already exist in the given store', 400);
  }

  const inventoryData = await sequelize.transaction(async (t) => {
    const newInventory = await InventoryModel.create(
      {
        movieId,
        storeId,
        stock: stockCount,
      },
      {
        fields: ['movieId', 'storeId', 'stock'],
        isNewRecord: true,
        validate: true,
        ignoreDuplicates: false,
        transaction: t,
        returning: ['id'],
      }
    );

    const newInventoryId = Number(newInventory.getDataValue('id'));
    // const newInventoryId = 13192302;
    const newInventoryData = await InventoryModel.findByPk(newInventoryId, {
      attributes: ['id', 'stock'],
      include: [
        {
          model: MovieModel,
          as: 'movie',
          attributes: [...movieModelAttributes, [literal(`"movie->movieLanguage"."iso_language_code"`), 'language']],
          include: [
            {
              model: MovieLanguageModel,
              as: 'movieLanguage',
              attributes: [],
            },
          ],
        },
        {
          model: StoreModel,
          as: 'store',
          attributes: ['id', 'storeManagerId', 'phoneNumber'],
          include: [addressUtils.includeAddress({ addressPath: 'store->address' })],
        },
      ],
      transaction: t,
    });

    if (!newInventoryData) {
      throw new AppError('Error adding inventory', 500);
    }

    return newInventoryData;
  });

  const inventoryJson = inventoryData.toJSON();
  res.json(inventoryJson);
};

export const deleteInventory = async (req: CustomRequest, res: Response) => {
  const { user } = req;

  if (!user) {
    throw new AppError(ERROR_MESSAGES.INVALID_AUTH_TOKEN, 401);
  }

  const id = req.params.id;
  const inventoryId = Number(id);

  if (isNaN(inventoryId)) {
    throw new AppError('Invalid id', 400);
  }

  const instance = await InventoryModel.findByPk(inventoryId);
  if (!instance) {
    throw new AppError(ERROR_MESSAGES.RESOURCES_NOT_FOUND, 404);
  }

  await instance.destroy();

  res.status(204).send();
};

export const updateInventory = async (req: CustomRequest, res: Response) => {
  const { user } = req;

  if (!user) {
    throw new AppError(ERROR_MESSAGES.INVALID_AUTH_TOKEN, 401);
  }

  const id = req.params.id;
  const inventoryId = Number(id);

  if (isNaN(inventoryId)) {
    throw new AppError('Invalid id', 400);
  }

  const { movie_id: movieId, store_id: storeId, stock_count } = req.body;
  const stockCount = Number(stock_count);

  if (movieId && isNaN(Number(movieId))) {
    throw new AppError('Movie id must be a number', 400);
  }
  if (storeId && isNaN(Number(storeId))) {
    throw new AppError('Store id must be a number', 400);
  }
  if ((stock_count && isNaN(stockCount)) || stockCount <= 0) {
    throw new AppError(ERROR_MESSAGES.STOCK_COUNT_MUST_BE_NUMBER, 400);
  }

  const instance = await InventoryModel.findByPk(inventoryId);
  if (!instance) {
    throw new AppError(ERROR_MESSAGES.RESOURCES_NOT_FOUND, 404);
  }

  if (stock_count) {
    instance.setDataValue('stock', stockCount);
  }

  if (movieId) {
    const movieExist = await MovieModel.isResourceExist(movieId);
    if (!movieExist) {
      throw new AppError(ERROR_MESSAGES.MOVIE_NOT_FOUND, 404);
    }
    instance.setDataValue('movieId', movieId);
  }

  if (storeId) {
    const storeExist = await StoreModel.isResourceExist(storeId);
    if (!storeExist) {
      throw new AppError(ERROR_MESSAGES.STORE_NOT_FOUND, 404);
    }
    instance.setDataValue('storeId', storeId);
  }

  await instance.save({ validate: true });

  res.status(204).send();
};
