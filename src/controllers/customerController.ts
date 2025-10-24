import type { Response } from 'express';
import { WhereOptions, Op } from 'sequelize';
import bcrypt from 'bcryptjs';
import { CustomerModel, StoreModel, AddressModel, StaffModel } from '../models';
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
import { CustomRequest, CustomRequestWithBody, CustomerPayload } from '../types';

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
      include: [addressUtils.includeAddress(addressFilter, true)],
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

export const getCustomers = async (req: CustomRequest, res: Response) => {
  const { page: pageNumberText = '1' } = req.query;

  const limitPerPage = ITEMS_PER_PAGE_FOR_PAGINATION;
  const pageNumber = Number(pageNumberText);

  const filters = parseCustomersPaginationFilters(req);

  const { idOffset, totalCustomers } = await getCustomersPaginationOffset(pageNumber, limitPerPage, filters);

  if (totalCustomers === 0) {
    throw new AppError('No data found with the given query', 404);
  }

  const totalPages = Math.ceil(totalCustomers / limitPerPage);

  if (pageNumber > totalPages) {
    throw new AppError('Page out of range', 404);
  }

  const { addressFilter, customersFilter } = filters;
  const customers = await CustomerModel.findAll({
    attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber', 'preferredStoreId', 'active', 'avatar', 'registeredOn'],
    include: [
      addressUtils.includeAddress({
        addressPath: 'address',
        ...addressFilter,
      }),
    ],
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

  const id = Number(idText);
  if (isNaN(id) || id <= 0) {
    throw new AppError('Invalid id', 400);
  }

  const customerInstance = await CustomerModel.findByPk(id, {
    attributes: { exclude: ['addressId', 'preferredStoreId'] },
    include: [
      {
        model: StoreModel,
        as: 'preferredStore',
        attributes: ['id', 'phoneNumber'],
        include: [
          {
            model: StaffModel,
            as: 'storeManager',
            attributes: ['id', 'firstName', 'lastName', 'email', 'active', 'phoneNumber', 'avatar'],
            include: [addressUtils.includeAddress({ addressPath: 'preferredStore->storeManager->address' })],
          },
          addressUtils.includeAddress({ addressPath: 'preferredStore->address' }),
        ],
      },
      addressUtils.includeAddress({ addressPath: 'address' }),
    ],
  });

  if (!customerInstance) {
    throw new AppError(ERROR_MESSAGES.RESOURCES_NOT_FOUND, 404);
  }

  const customerData = customerInstance.toJSON();

  res.status(200).json(customerData);
};

export const registerCustomer = async (req: CustomRequest, res: Response) => {
  const { firstName, lastName, email, password } = req.body;

  if (!firstName || !lastName || !email || !password) {
    throw new AppError('Missing required data', 400);
  }

  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
    throw new AppError('Please provide a valid email', 400);
  }

  if (String(password).length < 8) {
    throw new AppError('Password must be at least 8 characters long', 400);
  }

  try {
    const authToken = await sequelize.transaction(async (t) => {
      const existingCustomer = await CustomerModel.findOne({
        where: {
          email,
        },
        transaction: t,
      });

      if (existingCustomer) {
        throw new AppError('Customer with the given email already exist', 400);
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      await CustomerModel.create(
        { firstName, lastName, email, userPassword: hashedPassword, registeredOn: new Date().toISOString().split('T')[0] },
        { fields: ['firstName', 'lastName', 'email', 'userPassword', 'registeredOn'], transaction: t }
      );

      const authToken = generateAuthToken(email, USER_ROLES.CUSTOMER);

      return authToken;
    });

    res
      .status(201)
      .cookie('auth_token', authToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: TOKEN_EXPIRING_IN_MS,
      })
      .json({ message: 'Registration successful' });
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
    throw new AppError('Incomplete address', 400);
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
    if (address) {
      const custAddressId = existingCustInstance.getDataValue('addressId');

      const isDuplicateAddress = await AddressModel.isAddressExist(address, t, custAddressId);
      if (isDuplicateAddress) {
        throw new AppError('Customer with the same address already exist', 400);
      }

      await AddressModel.updateAddress(custAddressId, address);
    }

    const newCustomerData: { [key: string]: string | boolean | number } = {};
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

    await existingCustInstance.update({ ...newCustomerData });
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

  await updateUserPassword<CustomerModel>(CustomerModel, id, newPassword);

  res.status(204).send();
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
  await updateUserPassword(CustomerModel, id, newPassword);

  res.status(204).send();
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

  if (user.role === USER_ROLES.CUSTOMER && existingCusInstance.getDataValue('email') !== user.email) {
    throw new AppError(ERROR_MESSAGES.FORBIDDEN, 403);
  }

  await sequelize.transaction(async (t) => {
    const custAddressId = existingCusInstance.getDataValue('addressId');

    const custAddressInstance = await AddressModel.findByPk(custAddressId, { transaction: t });

    if (!custAddressInstance) {
      throw new AppError('Address for the customer not found', 404);
    }

    await existingCusInstance.destroy({ transaction: t });
    await custAddressInstance?.destroy({ transaction: t });
  });

  res.status(204).send();
};
