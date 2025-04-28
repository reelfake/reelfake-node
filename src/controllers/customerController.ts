import type { Response } from 'express';
import { literal, fn, Op } from 'sequelize';
import { CustomerModel, StoreModel, AddressModel, StaffModel, CityModel, CountryModel } from '../models';
import { AppError } from '../utils';
import sequelize from '../sequelize.config';
import { ERROR_MESSAGES, ITEMS_PER_PAGE_FOR_PAGINATION } from '../constants';
import { CustomRequest, CustomRequestWithBody, CustomerPayload } from '../types';

export const getCustomers = async (req: CustomRequest, res: Response) => {
  const { user, validateUserRole } = req;
  validateUserRole?.(() => !!((user && user.staffId) || user?.storeManagerId));

  const { pageNumber: pageNumberText = '1' } = req.query;

  const pageNumber = Number(pageNumberText);
  if (isNaN(pageNumber) || pageNumber < 0) {
    throw new AppError('Invalid page number', 400);
  }

  const totalCustomers = await CustomerModel.count();

  const limitPerPage = ITEMS_PER_PAGE_FOR_PAGINATION;
  const idOffset = (pageNumber - 1) * limitPerPage;

  const customers = await CustomerModel.findAll({
    offset: idOffset,
    limit: limitPerPage,
    attributes: { exclude: ['addressId'] },
    include: [
      {
        model: AddressModel,
        as: 'address',
        attributes: [
          'id',
          'addressLine',
          [literal(`"address->city"."city_name"`), 'cityName'],
          [literal(`"address->city"."state_name"`), 'stateName'],
          [literal(`"address->city->country"."country_name"`), 'country'],
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
    order: [['id', 'ASC']],
  });

  if (!customers || customers.length === 0) {
    throw new AppError('Page out of range', 404);
  }

  res.status(200).json({
    items: customers,
    length: customers.length,
    totalPages: Math.ceil(totalCustomers / limitPerPage),
    totalItems: Number(totalCustomers),
  });
};

export const getCustomerById = async (req: CustomRequest, res: Response) => {
  const { user, validateUserRole } = req;
  validateUserRole?.(() => !!((user && user.staffId) || user?.storeManagerId));

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
              literal(`"preferredStore->staff"."avatar"`),
              'address',
              literal(
                `(
                  SELECT json_build_object(
                    'id', a.id,
                    'addressLine', a.address_line,
                    'cityName', c.city_name,
                    'stateName', c.state_name,
                    'country', cy.country_name,
                    'postalCode', a.postal_code
                  )
                  FROM address AS a LEFT JOIN city AS c ON a.city_id = c.id
                  LEFT JOIN country AS cy ON c.country_id = cy.id
                  WHERE a.id = "preferredStore->staff"."address_id"
                )`
              )
            ),
            'storeManager',
          ],
          [
            literal(
              `(
                SELECT json_build_object(
                  'id', a.id,
                  'addressLine', a.address_line,
                  'cityName', c.city_name,
                  'stateName', c.state_name,
                  'country', cy.country_name,
                  'postalCode', a.postal_code
                )
                FROM address AS a LEFT JOIN city AS c ON a.city_id = c.id
                LEFT JOIN country AS cy ON c.country_id = cy.id
                WHERE a.id = "preferredStore"."address_id"
              )`
            ),
            'address',
          ],
        ],
        include: [
          {
            model: StaffModel,
            as: 'staff',
            attributes: [],
            where: {
              id: {
                [Op.eq]: literal(`"preferredStore"."store_manager_id"`),
              },
            },
          },
        ],
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
  });

  if (!customerInstance) {
    throw new AppError(ERROR_MESSAGES.RESOURCES_NOT_FOUND, 404);
  }

  const customerData = customerInstance.toJSON();

  res.status(200).json(customerData);
};

export const createCustomer = async (req: CustomRequestWithBody<CustomerPayload>, res: Response) => {
  const { user, validateUserRole } = req;
  validateUserRole?.(() => !!(user && user.storeManagerId));

  const { firstName, lastName, email, address, avatar, phoneNumber, preferredStoreId } = req.body;

  if (!firstName || !lastName || !email || !address || !phoneNumber) {
    throw new AppError('Missing required data', 400);
  }

  const { addressLine, cityName, stateName, country, postalCode } = address;
  if (!addressLine || !cityName || !stateName || !country || !postalCode) {
    throw new AppError('Incomplete address', 400);
  }

  if (preferredStoreId && isNaN(Number(preferredStoreId))) {
    throw new AppError('Invalid preferred store id', 400);
  }

  if (preferredStoreId) {
    const preferredStoreInstance = await StoreModel.count({
      where: {
        id: preferredStoreId,
      },
    });

    if (preferredStoreInstance === 0) {
      throw new AppError('The preferred store is not found', 404);
    }
  }

  const existingCustomerWithSameEmail = await CustomerModel.count({
    where: {
      email,
    },
  });

  if (existingCustomerWithSameEmail > 0) {
    throw new AppError('Customer with the same email already exist', 400);
  }

  const existingCustomerWithSamePhoneNumber = await CustomerModel.count({
    where: {
      phoneNumber,
    },
  });

  if (existingCustomerWithSamePhoneNumber > 0) {
    throw new AppError('Customer with the same phone number already exist', 400);
  }

  const newCustomer = await sequelize.transaction(async (t) => {
    const { addressId, isNew } = await AddressModel.findOrCreateAddress(
      {
        addressLine,
        cityName,
        stateName,
        country,
        postalCode,
      },
      t
    );

    if (!isNew) {
      throw new AppError('Customer with the same address already exist', 400);
    }

    const customerPayload: { [key: string]: string | number | boolean } = {
      firstName,
      lastName,
      email,
      phoneNumber,
      addressId,
      active: true,
      registeredOn: new Date().toISOString().split('T')[0],
    };

    if (preferredStoreId) {
      customerPayload['preferredStoreId'] = preferredStoreId;
    }

    if (avatar) {
      customerPayload['avatar'] = avatar;
    }

    const newCustomerInstance = await CustomerModel.create(
      {
        ...customerPayload,
      },
      {
        fields: Object.keys(customerPayload),
        isNewRecord: true,
        transaction: t,
      }
    );

    const newCustomerId = newCustomerInstance.getDataValue('id');

    const fetchedNewCustomer = await CustomerModel.findByPk(newCustomerId, {
      attributes: { exclude: ['addressId'] },
      include: [
        {
          model: AddressModel,
          as: 'address',
          attributes: [
            'id',
            'addressLine',
            [literal(`"address->city"."city_name"`), 'cityName'],
            [literal(`"address->city"."state_name"`), 'stateName'],
            [literal(`"address->city->country"."country_name"`), 'country'],
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
      transaction: t,
    });

    if (!fetchedNewCustomer) {
      throw new AppError('Error creating customer', 500);
    }

    return fetchedNewCustomer.toJSON();
  });

  res.status(201).json(newCustomer);
};

export const updateCustomer = async (req: CustomRequestWithBody<Partial<CustomerPayload>>, res: Response) => {
  const { user, validateUserRole } = req;
  validateUserRole?.(() => !!(user && user.storeManagerId));

  const { firstName, lastName, email, active, address, avatar, phoneNumber, preferredStoreId } = req.body;

  const { id: idText } = req.params;
  const id = Number(idText);
  if (isNaN(id) || id <= 0) {
    throw new AppError('Invalid customer id', 400);
  }

  if (
    address &&
    (!address.addressLine || !address.cityName || !address.stateName || !address.country || !address.postalCode)
  ) {
    throw new AppError('Incomplete address', 400);
  }

  if (preferredStoreId) {
    const newPreferredStoreExist = await StoreModel.count({
      where: {
        id: preferredStoreId,
      },
    });

    if (newPreferredStoreExist === 0) {
      throw new AppError('Preferred store not found', 404);
    }
  }

  if (email) {
    const existingCustomerWithSameEmail = await CustomerModel.count({
      where: {
        email,
      },
    });

    if (existingCustomerWithSameEmail > 0) {
      throw new AppError('Customer with the same email already exist', 400);
    }
  }

  if (phoneNumber) {
    const existingCustomerWithSamePhoneNumber = await CustomerModel.count({
      where: {
        phoneNumber,
      },
    });

    if (existingCustomerWithSamePhoneNumber > 0) {
      throw new AppError('Customer with the same phone number already exist', 400);
    }
  }

  await sequelize.transaction(async (t) => {
    const existingCustInstance = await CustomerModel.findByPk(id, {
      attributes: ['id', 'addressId'],
      transaction: t,
    });

    if (!existingCustInstance) {
      throw new AppError(ERROR_MESSAGES.RESOURCES_NOT_FOUND, 404);
    }

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
    if (email) {
      newCustomerData['email'] = email;
    }
    if (phoneNumber) {
      newCustomerData['phoneNumber'] = phoneNumber;
    }
    if (active) {
      newCustomerData['active'] = active;
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

export const deleteCustomer = async (req: CustomRequest, res: Response) => {
  const { user, validateUserRole } = req;
  validateUserRole?.(() => !!(user && user.storeManagerId));

  const { id: idText } = req.params;

  const id = Number(idText);
  if (isNaN(id) || id <= 0) {
    throw new AppError('Invalid customer id', 400);
  }

  await sequelize.transaction(async (t) => {
    const existingCustomerInstance = await CustomerModel.findByPk(id, {
      attributes: ['id', 'addressId'],
      transaction: t,
    });

    if (!existingCustomerInstance) {
      throw new AppError(ERROR_MESSAGES.RESOURCES_NOT_FOUND, 404);
    }

    const custAddressId = existingCustomerInstance.getDataValue('addressId');

    const custAddressInstance = await AddressModel.findByPk(custAddressId);

    if (!custAddressInstance) {
      throw new AppError('Address for the customer not found', 404);
    }

    await existingCustomerInstance.destroy({ transaction: t });
    await custAddressInstance?.destroy({ transaction: t });
  });

  res.status(204).send();
};
