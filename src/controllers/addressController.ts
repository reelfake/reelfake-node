import type { Request, Response } from 'express';
import { Col } from 'sequelize/lib/utils';
import { col, literal, Op, WhereOptions } from 'sequelize';
import { AddressModel, CityModel, CountryModel } from '../models';
import { ITEMS_PER_PAGE_FOR_PAGINATION } from '../constants';
import { AppError } from '../utils';

const attributes: (string | [Col, string])[] = [
  'id',
  'addressLine',
  [col(`"city"."city_name"`), 'cityName'],
  [col(`"city"."state_name"`), 'stateName'],
  [col(`"city"."country"."country_name"`), 'country'],
  'postalCode',
];

function getAssociations(where: WhereOptions | undefined = undefined) {
  return [
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
      where,
    },
  ];
}

export const getAddresses = async (req: Request, res: Response) => {
  const { pageNumber: pageNumberText = '1' } = req.query;

  const pageNumber = Number(pageNumberText);

  if (isNaN(pageNumber)) {
    throw new AppError('Invalid page number', 400);
  }

  const idOffset = pageNumber * ITEMS_PER_PAGE_FOR_PAGINATION - ITEMS_PER_PAGE_FOR_PAGINATION;

  const totalItems = await AddressModel.getTotalRowsCount();
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE_FOR_PAGINATION);

  const addresses = await AddressModel.findAll({
    attributes,
    include: getAssociations(),
    offset: idOffset,
    limit: ITEMS_PER_PAGE_FOR_PAGINATION,
    order: [['id', 'ASC']],
  });

  res.status(200).json({
    items: addresses,
    length: addresses.length,
    totalItems,
    totalPages,
  });
};

export const getAddressesInCity = async (req: Request, res: Response) => {
  const { city } = req.params;

  const addresses = await AddressModel.findAll({
    attributes,
    include: getAssociations({
      cityName: city,
    }),
    order: [['id', 'ASC']],
  });

  res.status(200).json({
    items: addresses,
    length: addresses.length,
  });
};

export const getAddressesInState = async (req: Request, res: Response) => {
  const { state } = req.params;

  const addresses = await AddressModel.findAll({
    attributes,
    include: getAssociations({
      stateName: state,
    }),
    order: [['id', 'ASC']],
  });

  res.status(200).json({
    items: addresses,
    length: addresses.length,
  });
};
