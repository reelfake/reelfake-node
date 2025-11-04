import type { Request, Response } from 'express';
import { literal, Op, WhereOptions } from 'sequelize';
import sequelize from '../sequelize.config';
import { StoreModel, AddressModel, CityModel, InventoryModel, MovieModel, StaffModel, MovieLanguageModel } from '../models';
import { ERROR_MESSAGES, ITEMS_PER_PAGE_FOR_PAGINATION, movieModelAttributes } from '../constants';
import {
  AppError,
  addressUtils,
  parseMoviesPaginationFilters,
  getPaginationOffsetWithFilters,
  getPaginationOffset,
  parseRequestQuery,
  getPaginationMetadata,
} from '../utils';
import { StorePayload, CustomRequest, CustomRequestWithBody, KeyValuePair, Address } from '../types';

async function getStoreData(storeId: number) {
  const storeInstance = await StoreModel.findOne({
    attributes: ['id', 'phoneNumber'],
    include: [
      {
        model: StaffModel,
        as: 'storeManager',
        attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber', 'storeId', 'active', 'avatar'],
        include: [addressUtils.includeAddress({ addressPath: 'address' })],
      },
      addressUtils.includeAddress({ addressPath: 'address' }),
    ],
    where: {
      id: storeId,
    },
  });

  return storeInstance;
}

async function getMoviesPaginationOffset(storeId: number, pageNumber: number, limitPerPage: number, filters?: WhereOptions) {
  if (filters) {
    const movieIds = await InventoryModel.getMovieIdsInStore(storeId);
    const idOffset = await getPaginationOffsetWithFilters(pageNumber, limitPerPage, movieIds);
    return { idOffset, totalMovies: movieIds.length };
  }

  const totalMovies = await InventoryModel.getRowsCountWhere({ storeId });
  const idOffset = await getPaginationOffset(pageNumber, limitPerPage);
  return { idOffset, totalMovies };
}

export const getStaffInStore = async (req: CustomRequest, res: Response) => {
  const { user } = req;
  const { id } = req.params;

  if (!user) {
    throw new AppError('Invalid token', 401);
  }

  const storeId = Number(id);

  if (isNaN(storeId)) {
    throw new AppError('Invalid store id', 400);
  }

  const staffInStore = await StaffModel.findAll({
    attributes: {
      include: [[literal(`"Staff"."id" = "store"."store_manager_id"`), 'isStoreManager']],
    },
    include: [
      {
        model: StoreModel,
        as: 'store',
      },
    ],
    where: {
      storeId,
    },
  });

  res.status(200).json({
    items: staffInStore,
    length: staffInStore.length,
  });
};

export const getStoreById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const storeId = Number(id);

  if (isNaN(storeId)) {
    throw new AppError('Invalid store id', 400);
  }

  const storeInstance = await getStoreData(storeId);

  if (!storeInstance) {
    throw new AppError(ERROR_MESSAGES.RESOURCES_NOT_FOUND, 404);
  }

  const staffCount = await StoreModel.getStaffCount(storeId);

  res.status(200).json({ ...storeInstance.toJSON(), staffCount });
};

export const getStores = async (req: Request, res: Response) => {
  const stores = await StoreModel.findAll({
    attributes: ['id', 'storeManagerId', 'phoneNumber'],
    include: [addressUtils.includeAddress({ addressPath: 'address' })],
    order: [['id', 'ASC']],
  });

  res.status(200).json({
    items: stores,
    length: stores.length,
  });
};

export const getStockCount = async (req: Request, res: Response) => {
  const { id: idText } = req.params;
  const storeId = Number(idText);
  if (isNaN(storeId)) {
    throw new AppError('Invalid store id', 400);
  }

  const stockCount = await InventoryModel.sum('stock', {
    where: {
      storeId,
    },
  });

  res.status(200).json({ id: storeId, stock: stockCount });
};

export const getMoviesInStore = async (req: Request, res: Response) => {
  const { page: pageNumberText = '1' } = req.query;
  const { id: idText } = req.params;

  const pageNumber = Number(pageNumberText);

  if (isNaN(pageNumber)) {
    throw new AppError(ERROR_MESSAGES.INVALID_PAGE_NUMBER, 400);
  }

  const storeId = Number(idText);

  if (isNaN(storeId)) {
    throw new AppError('Invalid store id', 400);
  }

  const limitPerPage = ITEMS_PER_PAGE_FOR_PAGINATION;
  const filters = parseMoviesPaginationFilters(req);
  const { idOffset, totalMovies } = await getMoviesPaginationOffset(storeId, pageNumber, limitPerPage, filters);

  if (totalMovies === 0) {
    throw new AppError(ERROR_MESSAGES.NO_DATA_FOUND_WITH_QUERY, 404);
  }

  const totalPages = Math.ceil(totalMovies / limitPerPage);
  if (pageNumber > totalPages) {
    throw new AppError('Page out of range', 404);
  }

  const pageResult = await InventoryModel.findAll({
    attributes: { exclude: ['movieId', 'storeId'] },
    include: [
      {
        model: MovieModel,
        as: 'movie',
        attributes: [...movieModelAttributes, [literal(`"movie->movieLanguage"."iso_language_code"`), 'language']],
        required: true,
        include: [
          {
            model: MovieLanguageModel,
            as: 'movieLanguage',
            required: true,
            attributes: [],
          },
        ],
      },
    ],
    where: {
      [Op.and]: {
        id: {
          [idOffset >= 0 ? Op.gte : Op.lte]: idOffset >= 0 ? idOffset : totalMovies,
        },
        storeId,
        stock: {
          [Op.gt]: 0,
        },
      },
    },
    order: [['id', idOffset >= 0 ? 'ASC' : 'DESC']],
    limit: idOffset >= 0 ? limitPerPage : totalMovies % limitPerPage,
  });

  const queryObject = parseRequestQuery(req, ['page']);
  const pagination = getPaginationMetadata(pageNumber, totalMovies, limitPerPage, totalPages, queryObject, !!filters);

  res.status(200).json({
    items: pageNumber > 0 ? pageResult : pageResult.reverse(),
    length: pageResult.length,
    pagination,
  });

  // if (pageResult.length === 0) {
  //   throw new AppError(`No movies found in store ${storeId}`, 404);
  // }

  // const moviesStock = pageResult.map((res) => ({
  //   ...res.getDataValue('movie').dataValues,
  //   stock: res.getDataValue('stock'),
  // }));

  // res
  //   .status(200)
  //   .set('rf-page-number', String(pageNumber))
  //   .json({
  //     items: moviesStock,
  //     length: moviesStock.length,
  //     totalItems: totalMovies,
  //     totalPages: Math.ceil(totalMovies / ITEMS_PER_PAGE_FOR_PAGINATION),
  //   });
};

export const updateStore = async (req: CustomRequestWithBody<Partial<StorePayload>>, res: Response) => {
  const { id: idText } = req.params;

  const storeId = Number(idText);
  if (isNaN(storeId)) {
    throw new AppError('Invalid store id', 400);
  }

  const { phoneNumber, address } = req.body;

  if (address && (!address.addressLine || !address.cityName || !address.stateName || !address.country || !address.postalCode)) {
    throw new AppError(ERROR_MESSAGES.INCOMPLETE_ADDRESS, 400);
  }

  if (req.body.storeManagerId && req.body.storeManager) {
    throw new AppError('Duplicate store manager data in request', 400);
  }

  const currentStoreInstance = await StoreModel.findByPk(storeId);
  if (!currentStoreInstance) {
    throw new AppError(ERROR_MESSAGES.RESOURCES_NOT_FOUND, 404);
  }

  if (address) {
    if (await StoreModel.isAddressInUse(address, storeId)) {
      throw new AppError('The address is in use by other store', 400);
    }
  }

  if (phoneNumber) {
    const otherStoreUsingPhoneNumber = await StoreModel.findOne({
      where: {
        phoneNumber,
        id: {
          [Op.not]: storeId,
        },
      },
    });

    if (otherStoreUsingPhoneNumber) {
      throw new AppError('The phone number is in use by other store', 400);
    }
  }

  let { id: storeManagerId, address: storeManagerAddress } = req.body.storeManagerId
    ? {
        id: req.body.storeManagerId,
        address: await StaffModel.getAddress(req.body.storeManagerId),
      }
    : await StoreModel.getStoreManagerId(storeId, true);

  const originalStoreAddress = await StoreModel.getAddress(storeId);
  if (address && address.stateName && address.stateName !== originalStoreAddress.stateName)
    throw new AppError('Changing state of the store is not allowed', 400);
  if (address && address.country && address.country !== originalStoreAddress.country)
    throw new AppError('Changing country of the store is not allowed', 400);

  const newStoreAddress = {
    addressLine: address?.addressLine ?? originalStoreAddress.addressLine,
    cityName: address?.cityName ?? originalStoreAddress.cityName,
    stateName: address?.stateName ?? originalStoreAddress.stateName,
    country: address?.country ?? originalStoreAddress.country,
    postalCode: address?.postalCode ?? originalStoreAddress.postalCode,
  };

  const isCityInState = await CityModel.isCityInState(newStoreAddress.cityName, newStoreAddress.stateName);
  if (!isCityInState) {
    throw new AppError('City belongs to a different state', 400);
  }

  if (storeManagerId) {
    const isManagerOfOtherStore = await StoreModel.isStoreManager(storeManagerId, storeId);
    if (isManagerOfOtherStore) {
      throw new AppError('Store manager is assigned to existing store', 400);
    }
  }

  StoreModel.validateAddressAgainstManagerAddress(newStoreAddress, storeManagerAddress);

  await sequelize.transaction(async (t) => {
    const storeData: { [key: string]: string | number } = {};

    if (storeManagerId) {
      storeData['storeManagerId'] = storeManagerId;
    }

    if (phoneNumber) {
      storeData['phoneNumber'] = phoneNumber;
    }

    if (address) {
      const addressId = currentStoreInstance.getDataValue('addressId');
      await AddressModel.updateAddress(addressId, address, t);
    }

    await StoreModel.update(
      { ...storeData },
      {
        where: {
          id: storeId,
        },
        fields: Object.keys(storeData),
        transaction: t,
      }
    );
  });

  res.status(204).send();
};

export const createStore = async (req: CustomRequestWithBody<StorePayload>, res: Response) => {
  const { storeManagerId, storeManager, phoneNumber, address } = req.body;
  let newStoreManagerId = storeManagerId;

  if (storeManagerId && storeManager) {
    throw new AppError('Duplicate store manager data in request', 400);
  }

  if (!phoneNumber || !address) {
    throw new AppError('Missing required data', 400);
  }

  if (address && (!address.addressLine || !address.cityName || !address.stateName || !address.country || !address.postalCode)) {
    throw new AppError(ERROR_MESSAGES.INCOMPLETE_ADDRESS, 400);
  }

  if (await StoreModel.isAddressInUse(address)) {
    throw new AppError('The address is in use by other store', 400);
  }

  if (await StaffModel.isAddressInUse(address)) {
    throw new AppError('The address is in use by other staff', 400);
  }

  if (await StoreModel.isPhoneNumberInUse(phoneNumber)) {
    throw new AppError('The phone number is in use by other store', 400);
  }

  if (await StaffModel.isPhoneNumberInUse(phoneNumber)) {
    throw new AppError('The phone number is in use by staff', 400);
  }

  let storeManagerAddress: Address | undefined = undefined;

  if (storeManagerId) {
    const isAssignedToDifferentStore = await StoreModel.isStoreManager(storeManagerId);
    if (isAssignedToDifferentStore) {
      throw new AppError('Store manager is assigned to existing store', 400);
    }
    storeManagerAddress = await StaffModel.getAddress(storeManagerId);
  }

  if (storeManager) {
    storeManagerAddress = storeManager.address;
  }

  if (storeManagerAddress) {
    StoreModel.validateAddressAgainstManagerAddress(address, storeManagerAddress);

    if (await StoreModel.isAddressInUse(storeManagerAddress)) {
      throw new AppError('Store manager address cannot be same as other store', 400);
    }
  }

  const newStoreId = await sequelize.transaction(async (t) => {
    if (storeManager) {
      const {
        address: { id: addressId },
      } = await AddressModel.findOrCreateAddress(storeManager.address, t);
      const newStaffInstance = await StaffModel.create(
        {
          firstName: storeManager.firstName,
          lastName: storeManager.lastName,
          email: storeManager.email,
          addressId,
          active: true,
          phoneNumber: storeManager.phoneNumber,
          avatar: storeManager.avatar,
        },
        {
          fields: ['firstName', 'lastName', 'email', 'addressId', 'active', 'phoneNumber', 'avatar'],
          returning: ['id'],
          transaction: t,
        }
      );
      newStoreManagerId = Number(newStaffInstance.getDataValue('id'));
    }

    const {
      address: { id: addressId },
    } = await AddressModel.findOrCreateAddress(address, t);

    const newStoreData: KeyValuePair = {};
    if (newStoreManagerId) {
      newStoreData.storeManagerId = newStoreManagerId;
    }

    if (phoneNumber) {
      newStoreData.phoneNumber = phoneNumber;
    }

    if (addressId) {
      newStoreData.addressId = addressId;
    }

    const [newStore, isCreated] = await StoreModel.findOrCreate({
      where: {
        addressId,
      },
      defaults: newStoreData,
      fields: Object.keys(newStoreData),
      returning: ['id'],
      transaction: t,
    });

    if (!isCreated) {
      throw new AppError('Store with the given paylaod already exist', 400);
    }

    const newStoreId = newStore.getDataValue('id');

    if (newStoreManagerId) {
      await StaffModel.update(
        {
          storeId: newStoreId,
        },
        {
          where: {
            id: newStoreManagerId,
          },
          transaction: t,
        }
      );
    }

    return newStoreId;
  });

  const storeInstance = await getStoreData(newStoreId);
  if (!storeInstance) {
    throw new AppError(`Failed to get new store data for ${newStoreId}`, 500);
  }

  res.status(201).json(storeInstance);
};

export const deleteStore = async (req: CustomRequest, res: Response) => {
  const { id: idText } = req.params;
  const storeId = Number(idText);

  if (isNaN(storeId)) {
    throw new AppError('Invalid store id', 400);
  }

  const { forceDelete: forceDeleteQueryString } = req.query;
  const forceDelete =
    forceDeleteQueryString?.toString().toLowerCase() === 'true' || forceDeleteQueryString?.toString().toLowerCase() === 'yes';

  const storeData = await StoreModel.findByPk(storeId);

  if (!storeData) {
    throw new AppError('Resource not found', 404);
  }

  if (!forceDelete) {
    const staffCount = await StaffModel.count({
      where: {
        storeId,
      },
    });

    if (staffCount > 0) {
      throw new AppError('There are staff employed at the given store', 400);
    }
  }

  await sequelize.transaction(async (t) => {
    if (forceDelete) {
      await StoreModel.update(
        {
          storeManagerId: null,
        },
        {
          where: {
            id: storeId,
          },
        }
      );

      const staffAddressIdsInstance = await StaffModel.findAll({
        attributes: ['addressId'],
        where: {
          storeId,
        },
        transaction: t,
      });

      const staffAddressIds = staffAddressIdsInstance.map((addrId) => addrId.getDataValue('addressId'));

      await StaffModel.destroy({
        where: {
          storeId,
        },
        transaction: t,
      });

      await AddressModel.destroy({
        where: {
          id: {
            [Op.in]: staffAddressIds,
          },
        },
        transaction: t,
      });
    }

    const storeAddressId = storeData.getDataValue('addressId');

    await StoreModel.destroy({
      where: {
        id: storeId,
      },
      transaction: t,
    });

    await AddressModel.destroy({
      where: {
        id: storeAddressId,
      },
      transaction: t,
    });
  });

  res.status(204).send();
};
