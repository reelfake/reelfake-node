import type { Request, Response } from 'express';
import {
  StoreModel,
  AddressModel,
  CityModel,
  CountryModel,
  InventoryModel,
  MovieModel,
} from '../models';
import { ITEMS_PER_PAGE_FOR_PAGINATION } from '../constants';
import { AppError } from '../utils';

export const getStores = async (req: Request, res: Response) => {
  const stores = await StoreModel.findAll({
    attributes: ['id', 'phoneNumber'],
    include: [
      {
        model: AddressModel,
        as: 'address',
        attributes: ['addressLine', 'postalCode'],
        include: [
          {
            model: CityModel,
            as: 'city',
            attributes: ['cityName', 'stateName'],
            include: [
              {
                model: CountryModel,
                as: 'country',
                attributes: ['countryName'],
              },
            ],
          },
        ],
      },
    ],
  });

  const flattened = stores.map((s) => ({
    id: s.getDataValue('id'),
    addressLine: s.getDataValue('address').addressLine,
    city: s.getDataValue('address').city.cityName,
    state: s.getDataValue('address').city.stateName,
    country: s.getDataValue('address').city.country.countryName,
    postalCode: s.getDataValue('address').postalCode,
    phoneNumber: s.getDataValue('phoneNumber'),
  }));

  res.status(200).json({
    items: flattened,
    length: flattened.length,
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
  const { pageNumber: pageNumberText = '1' } = req.query;
  const { id: idText } = req.params;

  const pageNumber = Number(pageNumberText);

  if (isNaN(pageNumber)) {
    throw new AppError('Invalid page number', 400);
  }

  const storeId = Number(idText);

  if (isNaN(storeId)) {
    throw new AppError('Invalid store id', 400);
  }

  const totalRows = await InventoryModel.count({
    where: {
      storeId,
    },
    include: [
      {
        model: MovieModel,
        as: 'movie',
      },
    ],
  });

  const pageResult = await InventoryModel.findAll({
    where: {
      storeId,
    },
    attributes: { exclude: ['movieId', 'storeId'] },
    include: [
      {
        model: MovieModel,
        as: 'movie',
        attributes: { exclude: ['tmdbId'] },
      },
    ],
    order: [['stock', 'DESC']],
    limit: ITEMS_PER_PAGE_FOR_PAGINATION,
    offset: (pageNumber - 1) * ITEMS_PER_PAGE_FOR_PAGINATION,
  });

  if (pageResult.length === 0) {
    throw new AppError(`No movies found in store ${storeId}`, 404);
  }

  const moviesStock = pageResult.map((res) => ({
    ...res.getDataValue('movie').dataValues,
    stock: res.getDataValue('stock'),
  }));

  res
    .status(200)
    .set('rf-page-number', String(pageNumber))
    .json({
      items: moviesStock,
      length: moviesStock.length,
      totalItems: totalRows,
      totalPages: Math.ceil(totalRows / ITEMS_PER_PAGE_FOR_PAGINATION),
    });
};
