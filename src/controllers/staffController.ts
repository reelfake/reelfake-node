import type { Request, Response } from 'express';
import { col, literal, fn, Op } from 'sequelize';
import { StaffModel, AddressModel, CityModel, CountryModel, StoreModel } from '../models';
import { AppError } from '../utils';
import sequelize from '../sequelize.config';
import { ITEMS_PER_PAGE_FOR_PAGINATION } from '../constants';
import type { CustomRequest } from '../types';

export const getStaff = async (req: CustomRequest, res: Response) => {
  const { user } = req;

  if (!user) {
    throw new AppError('Invalid token', 401);
  }

  const updatedStaff = await StaffModel.findAll({
    attributes: {
      exclude: ['addressId', 'storeId'],
    },
    include: [
      {
        model: AddressModel,
        as: 'address',
        attributes: [
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
    items: updatedStaff,
    length: updatedStaff.length,
  });
};

export const getStoreManagers = async (req: CustomRequest, res: Response) => {
  const { user } = req;

  if (!user) {
    throw new AppError('Invalid token', 401);
  }

  const storeManagers = await StaffModel.findAll({
    attributes: { exclude: ['addressId', 'storeId'] },
    include: [
      {
        model: StoreModel,
        as: 'store',
        attributes: [
          'phoneNumber',
          [literal(`"store->address"."address_line"`), 'addressLine'],
          [literal(`"store->address->city"."city_name"`), 'cityName'],
          [literal(`"store->address->city"."state_name"`), 'stateName'],
          [literal(`"store->address->city->country"."country_name"`), 'country'],
          [literal(`"store->address"."postal_code"`), 'postalCode'],
        ],
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
  const { user } = req;
  const { state } = req.params;
  const { city } = req.query;

  if (!user) {
    throw new AppError('Invalid token', 401);
  }

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

  const queryText = `
        SELECT staff.id AS "id", staff.first_name AS "firstName", staff.last_name as "lastName",
        json_build_object(
            'id', address.id,
            'addressLine', address.address_line,
            'cityName', city.city_name,
            'stateName', city.state_name,
            'countryName', country.country_name,
            'postalCode', address.postal_code
        ) AS "address",
        (SELECT json_build_object(
            'id', s.id,
            'phoneNumber', s.phone_number,
            'address', json_build_object(
                'id', a.id,
                'addressLine', a.address_line,
                'cityName', city.city_name,
                'stateName', city.state_name,
                'countryName', country.country_name,
                'postalCode', address.postal_code
            )
        ) FROM store AS "s" LEFT JOIN address AS "a" ON s.address_id = a.id WHERE s.id = staff.store_id) AS "store"
        FROM staff LEFT JOIN address ON staff.address_id = address.id
        LEFT JOIN city ON address.city_id = city.id
        LEFT JOIN country ON city.country_id = country.id WHERE ${conditions.join(' AND ')} ORDER BY staff.id ASC;
    `;

  const [queryResult] = await sequelize.query(queryText);

  res.status(200).json({
    items: queryResult,
    length: queryResult.length,
  });
};
