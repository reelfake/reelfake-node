import type { Response } from 'express';
import { Op, literal, fn } from 'sequelize';
import { AppError } from '../utils';
import {
  AddressModel,
  CityModel,
  CountryModel,
  CustomerModel,
  InventoryModel,
  RentalModel,
  StoreModel,
} from '../models';
import { ERROR_MESSAGES, USER_ROLES } from '../constants';
import { CustomRequest } from '../types';

export const getRentals = async (req: CustomRequest, res: Response) => {
  const { user } = req;

  if (!user) {
    throw new AppError(ERROR_MESSAGES.INVALID_AUTH_TOKEN, 401);
  }

  if (user.role === USER_ROLES.CUSTOMER) {
    const customerEmail = user.email;
    const customerInstance = await CustomerModel.findOne({
      attributes: ['id', 'active'],
      where: {
        email: customerEmail,
      },
    });

    if (!customerInstance) {
      throw new AppError(ERROR_MESSAGES.USER_NOT_FOUND, 404);
    }

    if (customerInstance && Boolean(customerInstance.getDataValue('active')) === false) {
      throw new AppError(ERROR_MESSAGES.CUSTOMER_USER_NOT_ACTIVE, 403);
    }

    const rentalsByCustomer = await RentalModel.findAll({
      attributes: {
        exclude: ['inventoryId', 'staffId', 'customerId'],
        include: [
          [
            fn(
              'json_build_object',
              'id',
              literal(`"inventory->store"."id"`),
              'phoneNumber',
              literal(`"inventory->store"."phone_number"`),
              'address',
              literal(`
                (
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
                    WHERE a.id = "inventory->store"."address_id"
                )
              `)
            ),
            'store',
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
        customerId: {
          [Op.eq]: Number(customerInstance.getDataValue('id')),
        },
      },
    });

    res.status(200).json(rentalsByCustomer);
    return;
  }

  res.status(200).json({});
};
