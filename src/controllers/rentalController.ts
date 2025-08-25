import type { Response } from 'express';
import { Model, Op, literal, fn, WhereOptions, Includeable, col } from 'sequelize';
import { AppError, addressUtils, getPaginationOffset, getPaginationMetadata } from '../utils';
import { CustomerModel, InventoryModel, MovieModel, RentalModel, StaffModel, StoreModel } from '../models';
import { ERROR_MESSAGES, USER_ROLES, ITEMS_PER_PAGE_FOR_PAGINATION } from '../constants';
import { CustomRequest } from '../types';

async function getUserAndStoreIdIfExist(email: string, role: USER_ROLES) {
  let modelInstance: Model | null = null;

  switch (role) {
    case USER_ROLES.CUSTOMER:
      modelInstance = await CustomerModel.findOne({
        attributes: ['id', 'active', [col('preferred_store_id'), 'storeId']],
        where: {
          email,
        },
      });
      break;
    case USER_ROLES.STAFF:
    case USER_ROLES.STORE_MANAGER:
      modelInstance = await StaffModel.findOne({
        attributes: ['id', 'active', [col('store_id'), 'storeId']],
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

  const storeIdData = modelInstance.getDataValue('storeId');

  if (storeIdData === null) {
    throw new AppError(ERROR_MESSAGES.PREF_STORE_NOT_FOUND_FOR_CUSTOMER, 400);
  }

  const userId = Number(modelInstance.getDataValue('id'));
  const storeId = Number(storeIdData);

  return { userId, storeId };
}

export const getRentals = async (req: CustomRequest, res: Response) => {
  const { user } = req;

  if (!user) {
    throw new AppError(ERROR_MESSAGES.INVALID_AUTH_TOKEN, 401);
  }

  const { userId } = await getUserAndStoreIdIfExist(user.email, user.role);
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
          fn('json_build_object', 'id', literal(`"inventory->movie"."id"`), 'title', literal(`"inventory->movie"."title"`)),
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
  const { userId } = await getUserAndStoreIdIfExist(user.email, user.role);
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
      attributes: ['id', 'movieId', [literal(`"inventory"."stock_count"`), 'stock']],
      include: [
        {
          model: StoreModel,
          as: 'store',
          attributes: ['id', 'phoneNumber'],
          include: [
            {
              model: StaffModel,
              as: 'storeManager',
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

  const { storeId } = await getUserAndStoreIdIfExist(email, role);
  if (!storeId) {
    throw new AppError('Store not found for the user', 404);
  }

  const rentals = await RentalModel.findAll({
    attributes: {
      exclude: ['inventoryId', 'customerId', 'staffId'],
      include: [
        'id',
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
        attributes: [],
        as: 'inventory',
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
        where: {
          storeId: {
            [Op.eq]: storeId,
          },
        },
      },
    ],
  });

  // const rentals = await RentalModel.findAll({
  //   attributes: {
  //     exclude: ['inventoryId', 'customerId', 'staffId'],
  //     include: [
  //       'id',
  //       'storeId',
  //       'inventoryId',
  //       [literal(`"inventory->store"."id"`), 'storeId'],
  //       [
  //         fn(
  //           'json_build_object',
  //           'id',
  //           literal(`"inventory->movie"."id"`),
  //           'title',
  //           literal(`"inventory->movie"."title"`),
  //           'stock',
  //           literal(`"inventory"."stock_count"`)
  //         ),
  //         'movie',
  //       ],
  //     ],
  //   },
  //   include: [
  //     {
  //       model: InventoryModel,
  //       as: 'rentalInventory',
  //       attributes: [],
  //       required: true,
  //       include: [
  //         {
  //           model: StoreModel,
  //           as: 'store',
  //           attributes: [],
  //           where: {
  //             id: {
  //               [Op.eq]: storeId,
  //             },
  //           },
  //         },
  //         {
  //           model: MovieModel,
  //           as: 'movie',
  //           attributes: [],
  //         },
  //       ],
  //     },
  //   ],
  //   order: [['id', idOffset >= 0 ? 'ASC' : 'DESC']],
  //   where: {
  //     id: {
  //       [idOffset >= 0 ? Op.gte : Op.lte]: idOffset >= 0 ? idOffset : totalItems,
  //     },
  //   },
  //   limit: ITEMS_PER_PAGE_FOR_PAGINATION,
  // });

  res.status(200).json({ rentals, length: rentals.length });

  // const pagination = getPaginationMetadata(pageNumber, totalItems, ITEMS_PER_PAGE_FOR_PAGINATION, totalPages, {}, false);

  // res.status(200).json({
  //   items: pageNumber > 0 ? rentals : rentals.reverse(),
  //   length: rentals.length,
  //   pagination,
  // });
};
