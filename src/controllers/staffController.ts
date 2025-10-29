import type { Response } from 'express';
import { col, literal, Op, WhereOptions, Transaction } from 'sequelize';
import { StaffModel, AddressModel, CityModel, CountryModel, StoreModel } from '../models';
import {
  parseStaffPaginationFilters,
  getPaginationOffsetWithFilters,
  getPaginationOffset,
  parseRequestQuery,
  getPaginationMetadata,
  addressUtils,
  AppError,
  updateUserPassword,
} from '../utils';
import sequelize from '../sequelize.config';
import { ERROR_MESSAGES, ITEMS_PER_PAGE_FOR_PAGINATION } from '../constants';
import type { Address, CustomRequest, CustomRequestWithBody, StaffPayload } from '../types';

async function getStaffPaginationOffset(
  pageNumber: number,
  limitPerPage: number,
  filters: {
    staffFilter?: WhereOptions;
    addressFilter?: { whereAddress?: WhereOptions; whereCity?: WhereOptions; whereCountry?: WhereOptions };
  }
) {
  const { addressFilter, staffFilter } = filters;

  if (staffFilter || addressFilter) {
    const staffIdsQueryResult = await StaffModel.findAll({
      attributes: ['id'],
      where: staffFilter,
      include: [addressUtils.includeAddress(addressFilter, true)],
      order: [['id', 'ASC']],
    });
    const staffIds = staffIdsQueryResult.map<number>((id) => id.toJSON().id);
    const idOffset = await getPaginationOffsetWithFilters(pageNumber, limitPerPage, staffIds);
    return { idOffset, totalStaff: staffIds.length };
  }

  const totalStaff = await StaffModel.getRowsCountWhere();
  const idOffset = await getPaginationOffset(pageNumber, limitPerPage);
  return { idOffset, totalStaff };
}

async function getAddressIdForUpdate(staff: StaffModel, newAddress: Address, t: Transaction) {
  // Number(null) is 0 and Number(undefined) is NaN
  // modelInstance.getDataValue returns null if value does not exist
  const staffAddressId = Number(staff.getDataValue('addressId'));

  const existingAddress = await AddressModel.findAddress(newAddress, t);

  const isAddressAlreadyInUse = existingAddress ? existingAddress.inUseBy && existingAddress.id !== staffAddressId : false;

  if (isAddressAlreadyInUse) {
    // The address is either used by staff, store or customer
    throw new AppError('The address is not available for use', 400);
  }

  if (existingAddress && staffAddressId) {
    await AddressModel.unassignAddress(staffAddressId, t);
  }

  if (existingAddress) {
    // The address exist but it is not in use by any user
    await AddressModel.updateAddress(existingAddress.id, { ...existingAddress, inUseBy: 'staff' }, t);
    return existingAddress.id;
  }

  if (staffAddressId) {
    await AddressModel.updateAddress(staffAddressId, { ...newAddress, inUseBy: 'staff' }, t);
    return staffAddressId;
  }

  const newAddressInstance = await AddressModel.create(
    { ...newAddress, inUseBy: 'staff' },
    {
      isNewRecord: true,
      fields: ['addressLine', 'cityName', 'stateName', 'country', 'postalCode', 'inUseBy'],
      transaction: t,
    }
  );
  return Number(newAddressInstance.getDataValue('id'));
}

export const getStaff = async (req: CustomRequest, res: Response) => {
  const { page: pageNumberText = '1' } = req.query;
  const limitPerPage = ITEMS_PER_PAGE_FOR_PAGINATION;
  const pageNumber = Number(pageNumberText);

  const filters = parseStaffPaginationFilters(req);

  const { idOffset, totalStaff } = await getStaffPaginationOffset(pageNumber, limitPerPage, filters);

  if (totalStaff === 0) {
    throw new AppError('No data found with the given query', 404);
  }

  const totalPages = Math.ceil(totalStaff / limitPerPage);

  if (pageNumber > totalPages) {
    throw new AppError('Page out of range', 404);
  }

  const { addressFilter, staffFilter } = filters;

  const staffInstance = await StaffModel.findAll({
    attributes: [
      'id',
      'firstName',
      'lastName',
      'email',
      'active',
      'phoneNumber',
      'avatar',
      'storeId',
      [literal(`"store"."store_manager_id" = "Staff"."id"`), 'isStoreManager'],
    ],
    include: [
      {
        model: StoreModel,
        as: 'store',
        attributes: [],
      },
      addressUtils.includeAddress({
        addressPath: 'address',
        ...addressFilter,
      }),
    ],
    order: [['id', idOffset >= 0 ? 'ASC' : 'DESC']],
    where: {
      id: {
        [idOffset >= 0 ? Op.gte : Op.lte]: idOffset >= 0 ? idOffset : totalStaff,
      },
      ...staffFilter,
    },
    limit: idOffset >= 0 ? limitPerPage : totalStaff % limitPerPage,
  });

  const hasFilters = !!staffFilter || !!addressFilter;

  const queryObject = parseRequestQuery(req, ['page']);
  const pagination = getPaginationMetadata(pageNumber, totalStaff, limitPerPage, totalPages, queryObject, hasFilters);

  res.status(200).json({
    items: pageNumber > 0 ? staffInstance : staffInstance.reverse(),
    length: staffInstance.length,
    pagination,
  });
};

export const getStaffById = async (req: CustomRequest, res: Response) => {
  const { id: idText } = req.params;
  const staffId = Number(idText);

  if (isNaN(staffId)) {
    throw new AppError('Invalid staff id', 400);
  }

  const staffInstance = await StaffModel.findByPk(staffId, {
    attributes: [
      'id',
      'firstName',
      'lastName',
      'email',
      [literal(`"store"."store_manager_id" = "Staff"."id"`), 'isStoreManager'],
      'active',
      'phoneNumber',
      'avatar',
    ],
    include: [
      addressUtils.includeAddress({ addressPath: 'address' }),
      {
        model: StoreModel,
        as: 'store',
        attributes: ['id', 'phoneNumber'],
        include: [addressUtils.includeAddress({ addressPath: 'address' })],
      },
    ],
  });

  if (!staffInstance) {
    throw new AppError(ERROR_MESSAGES.RESOURCES_NOT_FOUND, 404);
  }

  res.status(200).json(staffInstance);
};

export const getStoreManagers = async (req: CustomRequest, res: Response) => {
  const { user } = req;

  if (!user) {
    throw new AppError('Invalid token', 401);
  }

  const storeManagers = await StaffModel.findAll({
    attributes: {
      exclude: ['addressId', 'storeId'],
    },
    include: [
      addressUtils.includeAddress({ addressPath: 'address' }),
      {
        model: StoreModel,
        as: 'store',
        attributes: ['id', 'phoneNumber'],
        include: [addressUtils.includeAddress({ addressPath: 'store->address' })],
        order: [['id', 'ASC']],
      },
    ],
    where: {
      id: {
        [Op.eq]: col(`"store"."store_manager_id`),
      },
    },
  });

  res.status(200).json({
    items: storeManagers,
    lenggth: storeManagers.length,
  });
};

export const updateStaff = async (req: CustomRequestWithBody<StaffPayload>, res: Response) => {
  const { id: idText } = req.params;
  const staffId = Number(idText);

  if (isNaN(staffId)) {
    throw new AppError('Invalid staff id', 400);
  }

  const { storeId, email, phoneNumber, address } = req.body;

  if (address && (!address.addressLine || !address.cityName || !address.stateName || !address.country || !address.postalCode)) {
    throw new AppError('Incomplete address', 400);
  }

  const currentStaffInstance = await StaffModel.findByPk(staffId);
  if (!currentStaffInstance) {
    throw new AppError(ERROR_MESSAGES.RESOURCES_NOT_FOUND, 404);
  }

  if (phoneNumber) {
    if (await StoreModel.isPhoneNumberInUse(phoneNumber)) {
      throw new AppError('The phone number is in use by a store', 400);
    }

    if (await StaffModel.isPhoneNumberInUse(phoneNumber)) {
      throw new AppError('The phone number is in use by other staff', 400);
    }
  }

  if (email) {
    if (await StaffModel.isEmailInUse(email)) {
      throw new AppError('The email address is in use by other staff', 400);
    }
  }

  let staffAddress: Address;
  if (address) {
    staffAddress = address;
  } else {
    const actualStaffAddress = await StaffModel.getAddress(staffId);
    staffAddress = actualStaffAddress;
  }

  if (storeId) {
    const storeAddress = await StoreModel.getAddress(storeId);
    if (storeAddress.stateName !== staffAddress.stateName || storeAddress.country !== staffAddress.country) {
      throw new AppError('Cannot assign staff to store outside state', 400);
    }
  }

  if (address) {
    const staffStore = await StaffModel.getStore(staffId);
    if (staffStore && (staffStore.address.stateName !== address.stateName || staffStore.address.country !== address.country)) {
      throw new AppError('Cannot assign staff to store outside state', 400);
    }
  }

  await sequelize.transaction(async (t) => {
    const staffData: Omit<StaffPayload & { addressId: number | undefined }, 'address'> = {
      ...req.body,
      addressId: undefined,
    };

    if (address) {
      const addressId = await getAddressIdForUpdate(currentStaffInstance, address, t);
      staffData.addressId = addressId;
    }

    await StaffModel.update(
      {
        ...staffData,
      },
      {
        fields: Object.keys(staffData),
        where: {
          id: staffId,
        },
        transaction: t,
      }
    );
  });

  res.status(204).send();
};

export const createStaff = async (req: CustomRequestWithBody<StaffPayload>, res: Response) => {
  const { address, firstName, lastName, email, phoneNumber, avatar, storeId } = req.body;

  if (await StoreModel.isAddressInUse(address)) {
    throw new AppError('The address is in use by a store', 400);
  }

  if (await StoreModel.isPhoneNumberInUse(phoneNumber)) {
    throw new AppError('The phone number is in use by a store', 400);
  }

  if (await StaffModel.isAddressInUse(address)) {
    throw new AppError('The address is in use by other staff', 400);
  }

  if (await StaffModel.isPhoneNumberInUse(phoneNumber)) {
    throw new AppError('The phone number is in use by other staff', 400);
  }

  const newStaffId = await sequelize.transaction(async (t) => {
    const {
      address: { id: addressId },
    } = await AddressModel.findOrCreateAddress(address, t);

    const staffInstance = await StaffModel.create(
      {
        firstName: firstName,
        lastName: lastName,
        email: email,
        addressId,
        active: true,
        phoneNumber: phoneNumber,
        avatar: avatar,
        storeId,
      },
      {
        fields: ['firstName', 'lastName', 'email', 'addressId', 'active', 'phoneNumber', 'avatar', 'storeId'],
        returning: ['id'],
        transaction: t,
      }
    );

    return Number(staffInstance.getDataValue('id'));
  });

  const newStaffDetail = await StaffModel.findOne({
    attributes: ['id', 'firstName', 'lastName', 'email', 'storeId', 'active', 'phoneNumber', 'avatar'],
    include: [
      {
        model: AddressModel,
        as: 'address',
        attributes: [
          [literal(`"address"."id"`), 'id'],
          [literal(`"address"."address_line"`), 'addressLine'],
          [literal(`"address->city"."city_name"`), 'cityName'],
          [literal(`"address->city"."state_name"`), 'stateName'],
          [literal(`"address->city->country"."country_name"`), 'country'],
          [literal(`"address"."postal_code"`), 'postalCode'],
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
      id: newStaffId,
    },
  });

  res.status(201).json(newStaffDetail);
};

export const deleteStaff = async (req: CustomRequest, res: Response) => {
  const { id: idText } = req.params;
  const staffId = Number(idText);

  if (isNaN(staffId)) {
    throw new AppError('Invalid staff id', 400);
  }

  const staffData = await StaffModel.findByPk(staffId);
  if (!staffData) {
    throw new AppError('Resource not found', 404);
  }

  const isStoreManager = await StoreModel.isStoreManager(staffId);
  if (isStoreManager) {
    throw new AppError('Staff is a manager of existing store', 400);
  }

  await sequelize.transaction(async (t) => {
    await StaffModel.destroy({
      where: {
        id: staffId,
      },
      transaction: t,
    });

    const addressId = staffData.getDataValue('addressId');
    await AddressModel.destroy({
      where: {
        id: addressId,
      },
      transaction: t,
    });
  });

  res.status(204).send();
};

export const changeStaffPassword = async (req: CustomRequestWithBody<{ newPassword: string }>, res: Response) => {
  const { id: idText } = req.params;
  const { newPassword } = req.body;

  const id = Number(idText);
  if (isNaN(id) || id <= 0) {
    throw new AppError('Invalid resource id', 400);
  }

  await updateUserPassword<StaffModel>(StaffModel, id, newPassword);

  res.status(204).send();
};

export const forgotStaffPassword = async (
  req: CustomRequestWithBody<{ newPassword: string; confirmedNewPassword: string }>,
  res: Response
) => {
  const { id: idText } = req.params;

  const id = Number(idText);
  if (isNaN(id) || id <= 0) {
    throw new AppError('Invalid customer id', 400);
  }

  const { newPassword } = req.body;
  await updateUserPassword(StaffModel, id, newPassword);

  res.status(204).send();
};
