import type { Response } from 'express';
import { col, literal, Op, WhereOptions } from 'sequelize';
import { StaffModel, AddressModel, CityModel, CountryModel, StoreModel } from '../models';
import { AppError, capitalize } from '../utils';
import sequelize from '../sequelize.config';
import type { Address, CustomRequest, CustomRequestWithBody, StaffPayload } from '../types';

export const getStaff = async (req: CustomRequest, res: Response) => {
  const { user } = req;

  if (!user) {
    throw new AppError('Invalid token', 401);
  }

  const staffInstance = await StaffModel.findAll({
    attributes: [
      'id',
      'firstName',
      'lastName',
      'email',
      [col(`"active"`), 'isActive'],
      'phoneNumber',
      'avatar',
      [literal(`"store"."store_manager_id" = "Staff"."id"`), 'isStoreManager'],
    ],
    include: [
      {
        model: StoreModel,
        as: 'store',
        attributes: [],
      },
      {
        model: AddressModel,
        as: 'address',
        attributes: [
          'id',
          'addressLine',
          [literal(`"address->city"."city_name"`), 'cityName'],
          [literal(`"address->city"."state_name"`), 'stateName'],
          [literal(`"address->city->country"."country_name"`), 'country'],
          [literal(`"postal_code"`), 'postalCode'],
        ],
        include: [
          {
            model: CityModel,
            as: 'city',
            attributes: [],
            include: [
              {
                model: CountryModel,
                attributes: [],
                as: 'country',
              },
            ],
          },
        ],
      },
    ],
  });

  res.status(200).json({
    items: staffInstance,
    length: staffInstance.length,
  });
};

export const getStoreManagers = async (req: CustomRequest, res: Response) => {
  const { user } = req;

  if (!user) {
    throw new AppError('Invalid token', 401);
  }

  const storeManagers = await StaffModel.findAll({
    attributes: [
      'id',
      'firstName',
      'lastName',
      'email',
      [col(`"active"`), 'isActive'],
      'phoneNumber',
      'avatar',
      [
        literal(
          `(SELECT json_build_object(
              'id', a.id,
              'addressLine', a.address_line,
              'cityName', c.city_name,
              'stateName', c.state_name,
              'country', cy.country_name,
              'postalCode', a.postal_code
            )
            FROM address AS a LEFT JOIN city AS c ON a.city_id = c.id 
            LEFT JOIN country AS cy ON c.country_id = cy.id
            WHERE a.id = "Staff"."address_id")`
        ),
        'address',
      ],
    ],
    include: [
      {
        model: StoreModel,
        as: 'store',
        attributes: ['id', 'phoneNumber'],
        include: [
          {
            model: AddressModel,
            as: 'address',
            attributes: [
              'id',
              'addressLine',
              [literal(`"store->address->city"."city_name"`), 'cityName'],
              [literal(`"store->address->city"."state_name"`), 'stateName'],
              [literal(`"store->address->city->country"."country_name"`), 'country'],
              [literal(`"postal_code"`), 'postalCode'],
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

export const getStaffByState = async (req: CustomRequest, res: Response) => {
  const { user, validateUserRole } = req;
  validateUserRole?.(() => !!(user && (user.staffId || user.storeManagerId)));
  const { state } = req.params;
  const { city } = req.query;

  if (!isNaN(Number(state))) {
    throw new AppError('Unknown state', 400);
  }

  if (city && !isNaN(Number(city))) {
    throw new AppError('Unknown city', 400);
  }

  const conditions = [`city.state_name = '${state}'`];
  if (city) {
    conditions.push(`city.city_name = '${city}'`);
  }

  const where: WhereOptions = {
    stateName: {
      [Op.eq]: capitalize(state),
    },
  };

  if (city) {
    where.cityName = {
      [Op.eq]: capitalize(String(city)),
    };
  }

  const staffInstance = await StaffModel.findAll({
    attributes: [
      'id',
      'firstName',
      'lastName',
      'email',
      [col(`"active"`), 'isActive'],
      'phoneNumber',
      'avatar',
      [literal(`"store"."store_manager_id" = "Staff"."id"`), 'isStoreManager'],
    ],
    include: [
      {
        model: StoreModel,
        as: 'store',
        attributes: [],
      },
      {
        model: AddressModel,
        as: 'address',
        required: true,
        attributes: [
          'id',
          'addressLine',
          [literal(`"address->city"."city_name"`), 'cityName'],
          [literal(`"address->city"."state_name"`), 'stateName'],
          [literal(`"address->city->country"."country_name"`), 'country'],
          [literal(`"postal_code"`), 'postalCode'],
        ],
        include: [
          {
            model: CityModel,
            as: 'city',
            attributes: [],
            where,
            include: [
              {
                model: CountryModel,
                attributes: [],
                as: 'country',
              },
            ],
          },
        ],
      },
    ],
  });

  res.status(200).json({
    items: staffInstance,
    length: staffInstance.length,
  });
};

export const updateStaff = async (req: CustomRequestWithBody<StaffPayload>, res: Response) => {
  const { user, validateUserRole } = req;
  validateUserRole?.(() => !!(user && user.storeManagerId));

  const { id: idText } = req.params;
  const staffId = Number(idText);

  if (isNaN(staffId)) {
    throw new AppError('Invalid staff id', 400);
  }

  const { storeId, email, phoneNumber, address } = req.body;

  if (
    address &&
    (!address.addressLine || !address.cityName || !address.stateName || !address.country || !address.postalCode)
  ) {
    throw new AppError('Incomplete address', 400);
  }

  if (address) {
    if (await StoreModel.isAddressInUse(address)) {
      throw new AppError('The address is in use by a store', 400);
    }

    if (await StaffModel.isAddressInUse(address)) {
      throw new AppError('The address is in use by other staff', 400);
    }
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
    const storeStaffIsEmployedAt = await StaffModel.getStore(staffId);
    if (
      storeStaffIsEmployedAt &&
      (storeStaffIsEmployedAt.address.stateName !== address.stateName ||
        storeStaffIsEmployedAt.address.country !== address.country)
    ) {
      throw new AppError('Cannot assign staff to store outside state', 400);
    }
  }

  await sequelize.transaction(async (t) => {
    const staffData: Omit<StaffPayload & { addressId: number | undefined }, 'address'> = {
      ...req.body,
      addressId: undefined,
    };

    if (address) {
      const addressId = await AddressModel.findOrCreateAddress(address, t);
      staffData['addressId'] = addressId;
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
        returning: ['id'],
        transaction: t,
      }
    );
  });

  res.status(204).send();
};

export const createStaff = async (req: CustomRequestWithBody<StaffPayload>, res: Response) => {
  const { user, validateUserRole } = req;
  validateUserRole?.(() => !!(user && user.storeManagerId));

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
    const addressId = await AddressModel.findOrCreateAddress(address, t);

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
  const { user, validateUserRole } = req;
  validateUserRole?.(() => !!(user && user.storeManagerId));

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
