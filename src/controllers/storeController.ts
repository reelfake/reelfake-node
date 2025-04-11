import type { Request, Response } from 'express';
import { literal, col, fn, where } from 'sequelize';
import { Literal } from 'sequelize/lib/utils';
import { StoreModel, AddressModel, CityModel, CountryModel, InventoryModel, MovieModel, StaffModel } from '../models';
import { ITEMS_PER_PAGE_FOR_PAGINATION } from '../constants';
import { AppError } from '../utils';
import { StorePayload, CustomRequest, CustomRequestWithBody } from '../types';

const movieModelAttributes: (string | [Literal, string])[] = [
  'id',
  'imdbId',
  'title',
  'originalTitle',
  'overview',
  'runtime',
  'releaseDate',
  [literal(`(SELECT ARRAY_AGG(g.genre_name) FROM genre AS g JOIN UNNEST(genre_ids) AS gid ON g.id = gid)`), 'genres'],
  [
    literal(
      `(SELECT ARRAY_AGG(c.iso_country_code) FROM country AS c JOIN UNNEST(origin_country_ids) AS cid ON c.id = cid)`
    ),
    'countriesOfOrigin',
  ],
  [literal(`(SELECT l.iso_language_code FROM movie_language AS l WHERE l.id = language_id)`), 'language'],
  'movieStatus',
  'popularity',
  'budget',
  'revenue',
  'ratingAverage',
  'ratingCount',
  'posterUrl',
  'rentalRate',
  'rentalDuration',
];

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

  const store = await StoreModel.findOne({
    attributes: [
      'id',
      'phoneNumber',
      [fn('COUNT', `"staff"."id"`), 'staffCount'],
      [
        literal(`(
          SELECT jsonb_build_object(
            'firstName', first_name,
            'lastName', last_name,
            'email', email,
            'phoneNumber', phone_number,
            'address', jsonb_build_object(
              'addressLine', address.address_line,
              'cityName', city.city_name,
              'stateName', city.state_name,
              'countryName', country.country_name,
              'postalCode', address.postal_code
            )
          ) FROM staff LEFT JOIN address ON staff.address_id = address.id
            LEFT JOIN city ON address.city_id = city.id
            LEFT JOIN country ON city.country_id = country.id
            WHERE staff.id = "Store"."store_manager_id"
        )`),
        'storeManager',
      ],
    ],
    include: [
      {
        model: StaffModel,
        as: 'staff',
        attributes: [],
      },
      {
        model: AddressModel,
        as: 'storeAddress',
        attributes: [
          'addressLine',
          [literal(`"storeAddress->city"."city_name"`), 'cityName'],
          [literal(`"storeAddress->city"."state_name"`), 'stateName'],
          [literal(`"storeAddress->city->country"."country_name"`), 'countryName'],
          'postalCode',
        ],
        include: [
          {
            model: CityModel,
            as: 'city',
            attributes: [],
            include: [
              {
                model: CountryModel,
                as: 'country',
                attributes: [],
              },
            ],
          },
        ],
      },
    ],
    where: {
      id: storeId,
    },
    group: ['Store.id', 'storeAddress.id', 'storeAddress->city.id', 'storeAddress->city->country.id'],
  });

  res.status(200).json(store);
};

export const getStores = async (req: Request, res: Response) => {
  const stores = await StoreModel.findAll({
    attributes: ['id', 'phoneNumber'],
    include: [
      {
        model: AddressModel,
        as: 'storeAddress',
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
    addressLine: s.getDataValue('storeAddress').addressLine,
    city: s.getDataValue('storeAddress').city.cityName,
    state: s.getDataValue('storeAddress').city.stateName,
    country: s.getDataValue('storeAddress').city.country.countryName,
    postalCode: s.getDataValue('storeAddress').postalCode,
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
        attributes: movieModelAttributes,
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

export const addStore = async (req: CustomRequestWithBody<StorePayload>, res: Response) => {
  const { user } = req;
  if (!user) {
    throw new AppError('Invalid token', 401);
  }

  if (!user.storeManagerId) {
    throw new AppError('Only store managers can create store', 403);
  }

  // const {
  //   storeManagerId,
  //   phoneNumber,
  //   address: { addressLine, city, state, country, postalCode },
  // } = req.body;

  const createdStore = await StoreModel.create(
    {
      ...req.body,
    },
    {
      include: [
        {
          model: AddressModel,
          as: 'storeAddress',
          include: [
            {
              model: CityModel,
              as: 'city',
              include: [
                {
                  model: CountryModel,
                  as: 'country',
                },
              ],
            },
          ],
        },
      ],
    }
  );

  res.status(201).json(createdStore);
};
