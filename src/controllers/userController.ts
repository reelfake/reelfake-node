import { literal, Op, Includeable, col, fn } from 'sequelize';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { AddressModel, CityModel, CountryModel, CustomerModel, RentalModel, StaffModel, StoreModel, UserModel } from '../models';
import { AppError } from '../utils';
import { ERROR_MESSAGES, USER_ROLES } from '../constants';
import { CustomRequest } from '../types';
import sequelize from '../sequelize.config';

const getAddressAssociation = (): Includeable => {
  return {
    model: AddressModel,
    as: 'address',
    attributes: [
      'id',
      'addressLine',
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
  };
};

async function findUser(email: string) {
  const user = await UserModel.findOne({
    where: {
      email,
    },
  });

  return user;
}

export const getUser = async (req: CustomRequest, res: Response) => {
  const { user } = req;

  if (!user) {
    throw new AppError(ERROR_MESSAGES.INVALID_AUTH_TOKEN, 401);
  }

  const { email, role } = user;

  if (role === USER_ROLES.USER) {
    const userInstance = await UserModel.findOne({
      where: {
        email,
      },
      attributes: ['id', 'firstName', 'lastName', 'email', 'customerId', 'staffId', 'storeManagerId'],
    });

    if (!userInstance) {
      throw new AppError(ERROR_MESSAGES.USER_NOT_FOUND, 404);
    }

    const customerId: number | null = userInstance.getDataValue('customerId');
    const staffId: number | null = userInstance.getDataValue('staffId');
    const storeManagerId: number | null = userInstance.getDataValue('storeManagerId');

    let rentalsCountForCustomer: number | null = null;
    let rentalsCountProcessedByStaff: number | null = null;
    let rentalsCountProcessedByStoreManager: number | null = null;
    let staffCountUnderStoreManager: number | null = null;

    if (customerId) {
      rentalsCountForCustomer = await RentalModel.getRentalsCountForCustomer(customerId);
    }

    if (staffId) {
      rentalsCountProcessedByStaff = await RentalModel.getRentalsCountProcessedByStaff(staffId);
    }

    if (storeManagerId) {
      rentalsCountProcessedByStoreManager = await RentalModel.getRentalsCountProcessedByStaff(storeManagerId);

      const staffCountQueryResult = await StaffModel.findAll({
        attributes: [[fn('COUNT', col('Staff.id')), 'totalStaff']],
        group: ['"Staff"."store_id"', '"store"."store_manager_id"'],
        include: [
          {
            model: StoreModel,
            as: 'store',
            attributes: [],
            where: {
              storeManagerId,
            },
          },
        ],
        where: {
          id: {
            [Op.ne]: storeManagerId,
          },
        },
      });

      const staffCount = staffCountQueryResult.at(0);

      if (staffCount) {
        staffCountUnderStoreManager = Number(staffCount.getDataValue('totalStaff'));
      }
    }

    const userJson = userInstance.toJSON();
    const userData = {
      id: userJson.id,
      firstName: userJson.firstName,
      lastName: userJson.lastName,
      email: userJson.email,
      customer: customerId
        ? {
            id: customerId,
            totalRentals: rentalsCountForCustomer,
          }
        : null,
      staff: staffId
        ? {
            id: staffId,
            totalProcessedRentals: rentalsCountProcessedByStaff,
          }
        : null,
      storeManager: storeManagerId
        ? {
            id: storeManagerId,
            totalProcessedRentals: rentalsCountProcessedByStoreManager,
            totalStaff: staffCountUnderStoreManager,
          }
        : null,
    };

    res.status(200).json(userData);
    return;
  }

  if (role === USER_ROLES.CUSTOMER) {
    const customerInstance = await CustomerModel.findOne({
      attributes: ['id', 'firstName', 'lastName', 'email', 'active', 'phoneNumber', 'avatar', 'registeredOn'],
      subQuery: false,
      include: [
        getAddressAssociation(),
        {
          model: StoreModel,
          as: 'preferredStore',
          attributes: [
            'id',
            'phoneNumber',
            [
              fn(
                'json_build_object',
                'id',
                literal(`"preferredStore->staff"."id"`),
                'firstName',
                literal(`"preferredStore->staff"."first_name"`),
                'lastName',
                literal(`"preferredStore->staff"."last_name"`),
                'email',
                literal(`"preferredStore->staff"."email"`),
                'active',
                literal(`"preferredStore->staff"."active"`),
                'phoneNumber',
                literal(`"preferredStore->staff"."phone_number"`),
                'avatar',
                literal(`"preferredStore->staff"."avatar"`)
              ),
              'storeManager',
            ],
          ],
          subQuery: false,
          required: true,
          include: [
            getAddressAssociation(),
            {
              model: StaffModel,
              as: 'staff',
              attributes: [],
              include: [getAddressAssociation()],
              where: {
                id: {
                  [Op.eq]: literal(`"preferredStore"."store_manager_id"`),
                },
              },
            },
          ],
        },
      ],
      where: {
        email,
      },
    });

    if (!customerInstance) {
      throw new AppError(ERROR_MESSAGES.USER_NOT_FOUND, 404);
    }

    const custData = customerInstance.toJSON();

    res.status(200).json(custData);
    return;
  }

  const staffInstance = await StaffModel.findOne({
    where: {
      email,
    },
    attributes: ['id', 'firstName', 'lastName', 'email', 'active', 'phoneNumber', 'avatar'],
    include: [
      getAddressAssociation(),
      {
        model: StoreModel,
        as: 'store',
        include: [getAddressAssociation()],
      },
    ],
  });

  if (!staffInstance) {
    throw new AppError(ERROR_MESSAGES.USER_NOT_FOUND, 404);
  }

  const staffData = staffInstance.toJSON();

  res.status(200).json(staffData);
};

export const updateUser = async (req: CustomRequest, res: Response) => {
  const currentUser = req.user;
  const { customerId, staffId, storeManagerId } = req.body as {
    customerId?: number;
    staffId?: number;
    storeManagerId?: number;
  };

  const hasCustomerId = Object.hasOwn(req.body, 'customerId');
  const hasStaffId = Object.hasOwn(req.body, 'staffId');
  const hasStoreManagerId = Object.hasOwn(req.body, 'storeManagerId');

  if (!hasCustomerId && !hasStaffId && !hasStoreManagerId) {
    throw new AppError('Either of customer, staff or manager staff id is required', 400);
  }

  if (!currentUser) {
    throw new AppError('Invalid token', 401);
  }

  const { email } = currentUser;
  const userToUpdate = await findUser(email);

  if (!userToUpdate) {
    throw new AppError('Error finding user with the given user remail', 500);
  }

  const changes: { customerId?: number; staffId?: number; storeManagerId?: number } = {};

  if (hasCustomerId) {
    changes.customerId = customerId;
  }

  if (hasStaffId) {
    changes.staffId = staffId;
  }

  if (hasStoreManagerId) {
    changes.storeManagerId = storeManagerId;
  }

  // If the request has either of customer id, staff id or store manager id
  // verify it is not used by other users
  const conditions = [];

  if (customerId) {
    conditions.push({ customerId });
  }

  if (staffId) {
    conditions.push({ staffId });
  }

  if (storeManagerId) {
    // Verify the store manager being assigned to user is actually a store manager
    const storeInstance = await StoreModel.findOne({
      where: {
        storeManagerId,
      },
    });

    if (!storeInstance) {
      throw new AppError(ERROR_MESSAGES.STAFF_NOT_STORE_MANAGER, 400);
    }

    conditions.push({ storeManagerId });
  }

  if (customerId || staffId || storeManagerId) {
    const usersWithDuplicateSetup = await UserModel.count({
      where: {
        [Op.and]: {
          [Op.or]: conditions,
          [Op.not]: {
            email: currentUser.email,
          },
        },
      },
    });

    if (usersWithDuplicateSetup > 0) {
      throw new AppError(`Another user with the same config already exist`, 400);
    }
  }

  userToUpdate.set({ ...changes });
  await userToUpdate.save();

  const updatedUser = await findUser(email);

  if (!updatedUser) {
    throw new AppError('Error updating the user details', 500);
  }

  res.status(204).send();
};

export const registerUser = async (req: Request, res: Response) => {
  const { firstName, lastName, email, password } = req.body;

  const user = await UserModel.findOne({
    where: {
      email,
    },
  });

  if (user) {
    throw new AppError('User with the given email already exist', 400);
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  await UserModel.create(
    { firstName, lastName, email, userPassword: hashedPassword },
    { fields: ['firstName', 'lastName', 'email', 'userPassword'] }
  );
  res.status(201).json({ message: 'User is registered successfully' });
};

export const changePassword = async (req: Request, res: Response) => {
  const { id, email, password, confirmedPassword } = req.body;

  if (password !== confirmedPassword) {
    throw new AppError('Password is not same as confirmed password', 400);
  }

  const userInstance = await UserModel.findByPk(id, { attributes: ['id', 'email'] });

  await sequelize.transaction(async (t) => {
    if (!userInstance || userInstance.getDataValue('email') !== email) {
      throw new AppError('User not found', 404);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const hashedConfirmedPassword = await bcrypt.hash(confirmedPassword, salt);

    if (hashedPassword !== hashedConfirmedPassword) {
      throw new AppError('Password is not same as confirmed password', 400);
    }

    await userInstance.update({ userPassword: hashedPassword });
    await userInstance.save({ transaction: t, fields: ['userPassword'] });
  });

  res.status(204).send();
};
