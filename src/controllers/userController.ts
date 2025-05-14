import { literal, Op, Includeable, col, fn } from 'sequelize';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { AddressModel, CityModel, CountryModel, CustomerModel, StaffModel, StoreModel, UserModel } from '../models';
import { AppError, generateAuthToken } from '../utils';
import { ERROR_MESSAGES, USER_ROLES } from '../constants';
import { CustomRequest } from '../types';

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
      attributes: ['id', 'email', 'customerId', 'staffId', 'storeManagerId'],
    });

    if (!userInstance) {
      throw new AppError(ERROR_MESSAGES.USER_NOT_FOUND, 404);
    }

    const userData = userInstance.toJSON();

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
                // 'address',
                // fn(
                //   'json_build_object',
                //   'id',
                //   literal(`"preferredStore->staff->address"."id"`),
                //   'addressLine',
                //   literal(`"preferredStore->staff->address"."address_line"`),
                //   'cityName',
                //   literal(`"preferredStore->staff->address->city"."city_name"`),
                //   'stateName',
                //   literal(`"preferredStore->staff->address->city"."state_name"`),
                //   'country',
                //   literal(`"preferredStore->staff->address->city->country"."country_name"`),
                //   'postalCode',
                //   literal(`"preferredStore->staff->address"."postal_code"`)
                // )
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

  if (!customerId && !staffId && !storeManagerId) {
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

  const conditions = [];
  const changes: { customerId?: number; staffId?: number; storeManagerId?: number } = {};

  if (customerId) {
    conditions.push({ customerId });
    changes.customerId = customerId;
  }

  if (staffId) {
    conditions.push({ staffId });
    changes.staffId = staffId;
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
    changes.storeManagerId = storeManagerId;
  }

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

  userToUpdate.set({ ...changes });
  await userToUpdate.save();

  const updatedUser = await findUser(email);

  if (!updatedUser) {
    throw new AppError('Error updating the user details', 500);
  }

  const newAuthToken = generateAuthToken(currentUser.email, currentUser.role);

  res.status(204).cookie('auth_token', newAuthToken, { httpOnly: true, secure: true, sameSite: 'strict' }).send();
};

export const registerUser = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await UserModel.findOne({
    where: {
      email,
    },
  });

  if (user) {
    throw new AppError('User already exist', 400);
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  await UserModel.create({ email, userPassword: hashedPassword }, { fields: ['email', 'userPassword'] });
  res.status(201).json({ message: 'User is registered successfully' });
};
