import type { Response } from 'express';
import { WhereOptions, Op, Transaction, fn, literal } from 'sequelize';
import bcrypt from 'bcryptjs';
import {
  CustomerModel,
  StoreModel,
  AddressModel,
  CityModel,
  CountryModel,
  RentalModel,
  InventoryModel,
  MovieModel,
} from '../models';
import {
  AppError,
  addressUtils,
  parseCustomersPaginationFilters,
  getPaginationOffset,
  getPaginationOffsetWithFilters,
  parseRequestQuery,
  getPaginationMetadata,
  generateAuthToken,
  updateUserPassword,
} from '../utils';
import sequelize from '../sequelize.config';
import { ERROR_MESSAGES, ITEMS_PER_PAGE_FOR_PAGINATION, USER_ROLES, TOKEN_EXPIRING_IN_MS } from '../constants';
import { CustomRequest, CustomRequestWithBody, CustomerPayload, Address as AddressType } from '../types';

async function getCustomersPaginationOffset(
  pageNumber: number,
  limitPerPage: number,
  filters: {
    customersFilter?: WhereOptions;
    addressFilter?: { whereAddress?: WhereOptions; whereCity?: WhereOptions; whereCountry?: WhereOptions };
  }
) {
  const { addressFilter, customersFilter } = filters;

  if (customersFilter || addressFilter) {
    const customerIdsQueryResult = await CustomerModel.findAll({
      attributes: ['id'],
      where: customersFilter,
      include: addressFilter ? [addressUtils.includeAddress(addressFilter, true)] : undefined,
      order: [['id', 'ASC']],
    });
    const customerIds = customerIdsQueryResult.map<number>((id) => id.toJSON().id);
    const idOffset = await getPaginationOffsetWithFilters(pageNumber, limitPerPage, customerIds);
    return { idOffset, totalCustomers: customerIds.length };
  }

  const totalCustomers = await CustomerModel.getRowsCountWhere();
  const idOffset = await getPaginationOffset(pageNumber, limitPerPage);
  return { idOffset, totalCustomers };
}

const toggleCustomerStatus = async (id: number, isActive: boolean) => {
  await sequelize.transaction(async (t) => {
    const existingCustInstance = await CustomerModel.findByPk(id, { transaction: t });

    if (!existingCustInstance) {
      throw new AppError(ERROR_MESSAGES.RESOURCES_NOT_FOUND, 404);
    }

    const isExistingCustActive = existingCustInstance.getDataValue('active');

    if (isActive && Boolean(isExistingCustActive)) {
      throw new AppError('Cannot activate already active customer', 400);
    }

    if (!isActive && Boolean(isExistingCustActive) === false) {
      throw new AppError('Cannot deactivate already inactive customer', 400);
    }

    await existingCustInstance.update({ active: !isActive });
    await existingCustInstance.save({ transaction: t });
  });
};

async function getAddressIdForUpdate(customer: CustomerModel, newAddress: AddressType, t: Transaction) {
  // Number(null) is 0 and Number(undefined) is NaN
  const customerAddressId = Number(customer.getDataValue('addressId'));

  const existingAddress = await AddressModel.findAddress(newAddress, t);

  const isAddressAlreadyInUse = existingAddress ? existingAddress.inUseBy && existingAddress.id !== customerAddressId : false;

  if (isAddressAlreadyInUse) {
    // The address is either used by staff, store or customer
    throw new AppError('The address is not available for use', 400);
  }

  if (existingAddress && customerAddressId) {
    await AddressModel.unassignAddress(customerAddressId, t);
  }

  if (existingAddress) {
    // The address exist but it is not in use by any user
    await AddressModel.updateAddress(existingAddress.id, { ...existingAddress, inUseBy: 'customer' }, t);
    return existingAddress.id;
  }

  if (customerAddressId) {
    await AddressModel.updateAddress(customerAddressId, { ...newAddress, inUseBy: 'customer' }, t);
    return customerAddressId;
  }

  const { address } = await AddressModel.findOrCreateAddress({ ...newAddress, inUseBy: 'customer' }, t);
  return Number(address.id);
}

export const getCustomers = async (req: CustomRequest, res: Response) => {
  const { user } = req;
  const { page: pageNumberText = '1' } = req.query;

  const limitPerPage = ITEMS_PER_PAGE_FOR_PAGINATION;
  const pageNumber = Number(pageNumberText);

  const filters = parseCustomersPaginationFilters(req);

  const { idOffset, totalCustomers } = await getCustomersPaginationOffset(pageNumber, limitPerPage, filters);

  if (totalCustomers === 0) {
    throw new AppError(ERROR_MESSAGES.NO_DATA_FOUND_WITH_QUERY, 404);
  }

  const totalPages = Math.ceil(totalCustomers / limitPerPage);

  if (pageNumber > totalPages) {
    throw new AppError('Page out of range', 404);
  }

  const attributes = ['id', 'firstName', 'lastName', 'email', 'active'];
  if (user) {
    attributes.push('phoneNumber', 'preferredStoreId', 'avatar', 'registeredOn');
  }

  const { addressFilter, customersFilter } = filters;
  const include = [
    addressUtils.includeAddress({
      addressPath: 'address',
      ...addressFilter,
    }),
  ];

  const customers = await CustomerModel.findAll({
    attributes,
    ...(user && { include }),
    order: [['id', idOffset >= 0 ? 'ASC' : 'DESC']],
    where: {
      id: {
        [idOffset >= 0 ? Op.gte : Op.lte]: idOffset >= 0 ? idOffset : totalCustomers,
      },
      ...customersFilter,
    },
    limit: idOffset >= 0 ? limitPerPage : totalCustomers % limitPerPage,
  });

  const hasFilters = !!customersFilter || !!addressFilter;

  const queryObject = parseRequestQuery(req, ['page']);
  const pagination = getPaginationMetadata(pageNumber, totalCustomers, limitPerPage, totalPages, queryObject, hasFilters);

  res.status(200).json({
    items: pageNumber > 0 ? customers : customers.reverse(),
    length: customers.length,
    pagination,
  });
};

export const getCustomerById = async (req: CustomRequest, res: Response) => {
  const { id: idText } = req.params;
  const { user } = req;

  const id = Number(idText);
  if (isNaN(id) || id <= 0) {
    throw new AppError('Invalid id', 400);
  }

  if (user?.role === USER_ROLES.CUSTOMER && user?.id !== id) {
    throw new AppError(ERROR_MESSAGES.FORBIDDEN, 403);
  }

  const customerData = await CustomerModel.getCustomerDetail(id);

  res.status(200).json(customerData);
};

export const registerCustomer = async (req: CustomRequest, res: Response) => {
  const { firstName, lastName, email, password } = req.body;

  if (!firstName || !lastName || !email || !password) {
    throw new AppError('Missing required data', 400);
  }

  // if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
  if (!email.includes('@')) {
    throw new AppError('Please provide a valid email', 400);
  }

  if (String(password).length < 8) {
    throw new AppError('Password must be at least 8 characters long', 400);
  }

  const existingCustWithSameEmail = await CustomerModel.count({
    where: {
      email,
    },
  });

  if (existingCustWithSameEmail > 0) {
    throw new AppError(ERROR_MESSAGES.CUSTOMER_EXIST_WITH_EMAIL, 400);
  }

  try {
    const { newCustomer, authToken } = await sequelize.transaction(async (t) => {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const newCustomer = await CustomerModel.create(
        { firstName, lastName, email, userPassword: hashedPassword, registeredOn: new Date().toISOString().split('T')[0] },
        { returning: ['id'], fields: ['firstName', 'lastName', 'email', 'userPassword', 'registeredOn'], transaction: t }
      );

      const authToken = generateAuthToken(Number(newCustomer.getDataValue('id')), email, USER_ROLES.CUSTOMER);

      return { newCustomer, authToken };
    });

    res
      .status(201)
      .cookie('auth_token', authToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: TOKEN_EXPIRING_IN_MS,
      })
      .json({ id: newCustomer.getDataValue('id') });
  } catch {
    res.status(500).json({ message: 'Error registering customer' });
  }
};

export const updateCustomer = async (req: CustomRequestWithBody<Partial<CustomerPayload>>, res: Response) => {
  const { user } = req;

  if (!user) {
    throw new AppError(ERROR_MESSAGES.INVALID_AUTH_TOKEN, 401);
  }

  const { firstName, lastName, address, avatar, phoneNumber, preferredStoreId } = req.body;

  const { id: idText } = req.params;
  const id = Number(idText);
  if (isNaN(id) || id <= 0) {
    throw new AppError('Invalid customer id', 400);
  }

  if (address && (!address.addressLine || !address.cityName || !address.stateName || !address.country || !address.postalCode)) {
    throw new AppError(ERROR_MESSAGES.INCOMPLETE_ADDRESS, 400);
  }

  const existingCustInstance = await CustomerModel.findByPk(id, {
    attributes: ['id', 'email', 'addressId'],
  });

  if (!existingCustInstance) {
    throw new AppError(ERROR_MESSAGES.RESOURCES_NOT_FOUND, 404);
  }

  if (user.role === USER_ROLES.CUSTOMER && existingCustInstance.getDataValue('email') !== user.email) {
    throw new AppError(ERROR_MESSAGES.FORBIDDEN, 403);
  }

  if (preferredStoreId) {
    const existingStore = await StoreModel.findByPk(preferredStoreId);

    if (existingStore === undefined) {
      throw new AppError('Preferred store not found', 404);
    }
  }

  if (phoneNumber) {
    const existingCustomerWithSamePhoneNumber = await CustomerModel.count({
      where: {
        id: {
          [Op.ne]: id,
        },
        phoneNumber,
      },
    });

    if (existingCustomerWithSamePhoneNumber > 0) {
      throw new AppError('Customer with the same phone number already exist', 400);
    }
  }

  await sequelize.transaction(async (t) => {
    const newCustomerData: { [key: string]: string | boolean | number } = {};

    if (address) {
      const addressId = await getAddressIdForUpdate(existingCustInstance, address, t);
      newCustomerData['addressId'] = addressId;
    }

    if (firstName) {
      newCustomerData['firstName'] = firstName;
    }
    if (lastName) {
      newCustomerData['lastName'] = lastName;
    }
    if (phoneNumber) {
      newCustomerData['phoneNumber'] = phoneNumber;
    }
    if (preferredStoreId) {
      newCustomerData['preferredStoreId'] = preferredStoreId;
    }
    if (avatar) {
      newCustomerData['avatar'] = avatar;
    }

    await existingCustInstance.update({ ...newCustomerData }, { transaction: t });
    await existingCustInstance.save({ transaction: t });
  });

  res.status(204).send();
};

export const changeCustomerPassword = async (req: CustomRequestWithBody<{ newPassword: string }>, res: Response) => {
  const { id: idText } = req.params;
  const { newPassword } = req.body;

  const id = Number(idText);
  if (isNaN(id) || id <= 0) {
    throw new AppError('Invalid resource id', 400);
  }

  const email = await updateUserPassword<CustomerModel>(CustomerModel, id, newPassword);

  res.status(200).send({ id, email });
};

export const forgotCustomerPassword = async (
  req: CustomRequestWithBody<{ newPassword: string; confirmedNewPassword: string }>,
  res: Response
) => {
  const { id: idText } = req.params;

  const id = Number(idText);
  if (isNaN(id) || id <= 0) {
    throw new AppError('Invalid customer id', 400);
  }

  const { newPassword } = req.body;
  const email = await updateUserPassword(CustomerModel, id, newPassword);

  res.status(200).send({ id, email });
};

export const deactivateCustomer = async (req: CustomRequest, res: Response) => {
  const { id: idText } = req.params;

  const id = Number(idText);
  if (isNaN(id) || id <= 0) {
    throw new AppError('Invalid customer id', 400);
  }

  await toggleCustomerStatus(id, false);

  res.status(204).send();
};

export const activateCustomer = async (req: CustomRequest, res: Response) => {
  const { id: idText } = req.params;

  const id = Number(idText);
  if (isNaN(id) || id <= 0) {
    throw new AppError('Invalid customer id', 400);
  }

  await toggleCustomerStatus(id, true);

  res.status(204).send();
};

export const deleteCustomer = async (req: CustomRequest, res: Response) => {
  const { user } = req;

  if (!user) {
    throw new AppError(ERROR_MESSAGES.INVALID_AUTH_TOKEN, 401);
  }

  const { id: idText } = req.params;

  const id = Number(idText);
  if (isNaN(id) || id <= 0) {
    throw new AppError('Invalid customer id', 400);
  }

  const existingCusInstance = await CustomerModel.findByPk(id, {
    attributes: ['id', 'addressId'],
  });

  if (!existingCusInstance) {
    throw new AppError(ERROR_MESSAGES.RESOURCES_NOT_FOUND, 404);
  }

  await sequelize.transaction(async (t) => {
    const custAddressId = existingCusInstance.getDataValue('addressId');
    // If customer address id is null, findByPk will return null
    const custAddressInstance = await AddressModel.findByPk(custAddressId, { transaction: t });
    if (custAddressInstance) {
      await custAddressInstance.update({ ...custAddressInstance, inUseBy: null });
      await custAddressInstance.save({ transaction: t });
    }

    await existingCusInstance.destroy({ transaction: t });
  });

  res.status(204).send();
};

export const setPreferredStore = async (req: CustomRequest, res: Response) => {
  const { user } = req;

  if (!user) {
    throw new AppError(ERROR_MESSAGES.INVALID_AUTH_TOKEN, 401);
  }

  const { id: idText, store_id: storeIdText } = req.params;

  const id = Number(idText);
  if (isNaN(id) || id <= 0) {
    throw new AppError('Invalid customer id', 400);
  }

  const storeId = Number(storeIdText);
  if (isNaN(storeId) || storeId <= 0) {
    throw new AppError('Invalid store id', 400);
  }

  const existingCustInstance = await CustomerModel.findByPk(id, {
    attributes: ['id', 'preferredStoreId'],
  });

  if (!existingCustInstance) {
    throw new AppError(ERROR_MESSAGES.RESOURCES_NOT_FOUND, 404);
  }

  const storeInstance = await StoreModel.findByPk(storeId);
  if (!storeInstance) {
    throw new AppError(ERROR_MESSAGES.RESOURCES_NOT_FOUND, 404);
  }

  await existingCustInstance.update({ preferredStoreId: storeId });
  await existingCustInstance.save();

  res.status(204).send();
};

export const getCustomerRentals = async (req: CustomRequest, res: Response) => {
  const { user } = req;

  if (!user) {
    throw new AppError(ERROR_MESSAGES.INVALID_AUTH_TOKEN, 401);
  }

  const customerId = user.id;

  const customerInstance = await CustomerModel.findByPk(customerId);
  if (!customerInstance) {
    throw new AppError(ERROR_MESSAGES.USER_NOT_FOUND, 404);
  }

  const rentals = await RentalModel.findAll({
    attributes: [
      'id',
      'rentalStartDate',
      'rentalEndDate',
      'returnDate',
      'rentalDuration',
      'delayedByDays',
      'amountPaid',
      'discountAmount',
      'paymentDate',
      'rentalType',
      [
        fn(
          'json_build_object',
          'id',
          literal(`"inventory->movie"."id"`),
          'title',
          literal(`"inventory->movie"."title"`),
          'imdbId',
          literal(`"inventory->movie"."imdb_id"`),
          'posterUrl',
          literal(`"inventory->movie"."poster_url"`),
          'ratingAverage',
          literal(`"inventory->movie"."rating_average"`),
          'ratingCount',
          literal(`"inventory->movie"."rating_count"`)
        ),
        'movie',
      ],
      [
        fn(
          'json_build_object',
          'id',
          literal(`"inventory->store"."id"`),
          'phoneNumber',
          literal(`"inventory->store"."phone_number"`),
          'storeManagerId',
          literal(`"inventory->store"."store_manager_id"`),
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
        ),
        'store',
      ],
    ],
    include: [
      {
        model: InventoryModel,
        as: 'inventory',
        attributes: [],
        include: [
          {
            model: MovieModel,
            as: 'movie',
            attributes: [],
          },
          {
            model: StoreModel,
            as: 'store',
            include: [
              {
                model: AddressModel,
                as: 'address',
                attributes: [],
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
          },
        ],
      },
    ],
    where: {
      customerId,
    },
  });

  res.json({ items: rentals, length: rentals.length });
};
