import type { Response } from 'express';
import { Model, Op, literal, fn, WhereOptions, Includeable } from 'sequelize';
import { AppError, addressUtils } from '../utils';
import { CustomerModel, InventoryModel, MovieModel, RentalModel, StaffModel, StoreModel } from '../models';
import { ERROR_MESSAGES, USER_ROLES, ITEMS_PER_PAGE_FOR_PAGINATION } from '../constants';
import { CustomRequest } from '../types';

function getInventoryStoreAttributes() {
  const expandedStoreData = fn(
    'json_build_object',
    'id',
    literal(`"inventory->store"."id"`),
    'phoneNumber',
    literal(`"inventory->store"."phone_number"`),
    'storeManager',
    fn(
      'json_build_object',
      'id',
      literal(`"inventory->store->staff"."id"`),
      'firstName',
      literal(`"inventory->store->staff"."first_name"`),
      'lastName',
      literal(`"inventory->store->staff"."last_name"`),
      'email',
      literal(`"inventory->store->staff"."email"`),
      'active',
      literal(`"inventory->store->staff"."active"`),
      'phoneNumber',
      literal(`"inventory->store->staff"."phone_number"`),
      'avatar',
      literal(`"inventory->store->staff"."avatar"`)
    ),
    'address',
    fn(
      'json_build_object',
      'id',
      literal(`"inventory->store->address"."id"`),
      'addressLine',
      literal(`"inventory->store->address"."address_line"`),
      'cityName',
      literal(`"inventory->store->address->city"."city_name"`),
      'stateName',
      literal(`"inventory->store->address->city"."state_name"`),
      'country',
      literal(`"inventory->store->address->city->country"."country_name"`),
      'postalCode',
      literal(`"inventory->store->address"."postal_code"`)
    )
  );

  return expandedStoreData;
}

async function getUserAndStoreIdIdIfExist(email: string, role: USER_ROLES) {
  let modelInstance: Model | null = null;

  switch (role) {
    case USER_ROLES.CUSTOMER:
      modelInstance = await CustomerModel.findOne({
        attributes: ['id', 'active', ['preferredStoreId', 'storeId']],
        where: {
          email,
        },
      });
      break;
    case USER_ROLES.STAFF:
    case USER_ROLES.STORE_MANAGER:
      modelInstance = await StaffModel.findOne({
        attributes: ['id', 'active', 'storeId'],
        where: {
          email,
        },
      });
      break;
    default:
      throw new AppError(`Unknown user role ${role}`, 500);
  }

  if (!modelInstance) {
    throw new AppError(ERROR_MESSAGES.USER_NOT_FOUND, 404);
  }

  if (modelInstance && Boolean(modelInstance.getDataValue('active')) === false) {
    throw new AppError(ERROR_MESSAGES.USER_NOT_ACTIVE, 403);
  }

  const userId = Number(modelInstance.getDataValue('id'));
  const storeId = Number(modelInstance.getDataValue('storeId'));

  return { userId, storeId };
}

export const getRentals = async (req: CustomRequest, res: Response) => {
  const { user } = req;

  if (!user) {
    throw new AppError(ERROR_MESSAGES.INVALID_AUTH_TOKEN, 401);
  }

  const { userId } = await getUserAndStoreIdIdIfExist(user.email, user.role);
  const role = user.role;

  const condition: WhereOptions = {};
  switch (role) {
    case USER_ROLES.CUSTOMER:
      condition['customerId'] = {
        [Op.eq]: userId,
      };
      break;
    case USER_ROLES.STAFF:
    case USER_ROLES.STORE_MANAGER:
      condition['staffId'] = {
        [Op.eq]: userId,
      };
      break;
    default:
      throw new AppError(`Unknown role ${role}`, 500);
  }

  const rentals = await RentalModel.findAll({
    attributes: {
      exclude: ['inventoryId', 'customerId', 'staffId'],
      include: [
        [literal(`"inventory->store"."id"`), 'storeId'],
        [
          fn(
            'json_build_object',
            'id',
            literal(`"inventory->movie"."id"`),
            'title',
            literal(`"inventory->movie"."title"`)
          ),
          'movie',
        ],
      ],
    },
    where: condition,
    include: [
      {
        model: InventoryModel,
        as: 'inventory',
        attributes: [],
        include: [
          {
            model: StoreModel,
            as: 'store',
            attributes: [],
          },
          {
            model: MovieModel,
            as: 'movie',
            attributes: [],
          },
        ],
      },
    ],
  });

  if (!rentals) {
    throw new AppError('No rentals found', 404);
  }

  res.status(200).json({
    items: rentals,
    length: rentals.length,
  });
};

export const getRentalById = async (req: CustomRequest, res: Response) => {
  const { user } = req;

  if (!user) {
    throw new AppError(ERROR_MESSAGES.INVALID_AUTH_TOKEN, 401);
  }

  const { id: idText } = req.params;

  const id = Number(idText);
  if (isNaN(id)) {
    throw new AppError('Invalid id', 400);
  }

  const role = user.role;
  const { userId } = await getUserAndStoreIdIdIfExist(user.email, user.role);
  const modelBasicAttributes = ['id', 'firstName', 'lastName', 'email', 'phoneNumber', 'avatar'];

  const includes: Includeable[] = [
    {
      model: StaffModel,
      as: 'processedBy',
      attributes: [...modelBasicAttributes],
      include:
        role === USER_ROLES.STAFF || role === USER_ROLES.STORE_MANAGER
          ? [addressUtils.includeAddress({ addressPath: 'customer->address' })]
          : [],
    },
    {
      model: InventoryModel,
      as: 'inventory',
      attributes: [],
      include: [
        {
          model: StoreModel,
          as: 'store',
          attributes: [],
          include: [
            {
              model: StaffModel,
              as: 'staff',
              attributes: [],
              where: {
                id: {
                  [Op.eq]: literal(`"inventory->store"."store_manager_id"`),
                },
              },
            },
            addressUtils.includeAddress({ addressPath: 'inventory->store->address' }),
          ],
        },
      ],
    },
  ];

  if (role === USER_ROLES.STAFF || role === USER_ROLES.STORE_MANAGER) {
    includes.push({
      model: CustomerModel,
      as: 'customer',
      attributes: [...modelBasicAttributes, 'active', 'preferredStoreId', 'registeredOn'],
      include: [addressUtils.includeAddress({ addressPath: 'customer->address' })],
    });
  }

  const rentalInstance = await RentalModel.findByPk(id, {
    attributes: {
      include: [[getInventoryStoreAttributes(), 'store']],
    },
    include: includes,
  });

  if (!rentalInstance) {
    throw new AppError('No rentals found', 404);
  }

  if (role === USER_ROLES.CUSTOMER && Number(rentalInstance.getDataValue('customerId')) !== userId) {
    throw new AppError(ERROR_MESSAGES.FORBIDDEN_RESOURCE_ACCESS, 403);
  }

  if (role === USER_ROLES.STAFF && Number(rentalInstance.getDataValue('staffId')) !== userId) {
    throw new AppError(ERROR_MESSAGES.FORBIDDEN_RESOURCE_ACCESS, 403);
  }

  if (role === USER_ROLES.STORE_MANAGER) {
    const inventoryId = Number(rentalInstance.getDataValue('inventoryId'));

    const inventoryCount = await InventoryModel.count({
      include: [
        {
          model: StoreModel,
          as: 'store',
          include: [
            {
              model: StaffModel,
              as: 'staff',
              attributes: [],
              where: {
                id: {
                  [Op.eq]: userId,
                },
              },
            },
          ],
        },
      ],
      where: {
        id: {
          [Op.eq]: inventoryId,
        },
      },
    });

    if (inventoryCount === 0) {
      throw new AppError(ERROR_MESSAGES.RESOURCES_NOT_FOUND, 404);
    }
  }

  res.status(200).json(rentalInstance);
};

export const getRentalsForStore = async (req: CustomRequest, res: Response) => {
  const { user } = req;

  if (!user) {
    throw new AppError(ERROR_MESSAGES.INVALID_AUTH_TOKEN, 401);
  }

  const { email, role } = user;

  const { pageNumber: pageNumberText = '1' } = req.query;
  const pageNumber = Number(pageNumberText);
  if (!pageNumber || pageNumber < 1) {
    throw new AppError('Invalid page number', 400);
  }

  const { storeId } = await getUserAndStoreIdIdIfExist(email, role);
  if (!storeId) {
    throw new AppError('Store not found for the user', 404);
  }

  const limitPerPage = ITEMS_PER_PAGE_FOR_PAGINATION;
  const pageOffset = (pageNumber - 1) * limitPerPage;

  const totalRentals = await RentalModel.count({
    include: [
      {
        model: InventoryModel,
        as: 'inventory',
        attributes: [],
        include: [
          {
            model: StoreModel,
            as: 'store',
            attributes: [],
            where: {
              id: {
                [Op.eq]: storeId,
              },
            },
          },
        ],
      },
    ],
  });

  const rentals = await RentalModel.findAll({
    attributes: {
      exclude: ['inventoryId', 'customerId', 'staffId'],
      include: [
        [literal(`"inventory->store"."id"`), 'storeId'],
        [
          fn(
            'json_build_object',
            'id',
            literal(`"inventory->movie"."id"`),
            'title',
            literal(`"inventory->movie"."title"`),
            'stock',
            literal(`"inventory"."stock_count"`)
          ),
          'movie',
        ],
      ],
    },
    include: [
      {
        model: InventoryModel,
        as: 'inventory',
        attributes: [],
        include: [
          {
            model: StoreModel,
            as: 'store',
            attributes: [],
            where: {
              id: {
                [Op.eq]: storeId,
              },
            },
          },
          {
            model: MovieModel,
            as: 'movie',
            attributes: [],
          },
        ],
      },
    ],
    limit: limitPerPage,
    offset: pageOffset,
  });

  res
    .status(200)
    .set({
      'rf-page-number': pageNumber,
    })
    .json({
      items: rentals,
      length: rentals.length,
      totalPages: Math.ceil(totalRentals / limitPerPage),
      totalItems: Number(totalRentals),
    });
};
