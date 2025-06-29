import type { Request } from 'express';
import { Op, WhereOptions } from 'sequelize';
import { parseFilterRangeQuery, parsePaginationFilter } from './pagination.utils';

export function parseAddressFilters(req: Request) {
  const { address_line: addressLine, city, state, country, postal_code: postalCode } = req.query;

  const conditions: { whereAddress?: WhereOptions; whereCity?: WhereOptions; whereCountry?: WhereOptions } = {};

  if (addressLine) {
    conditions['whereAddress'] = {
      addressLine: {
        [Op.iLike]: addressLine,
      },
    };
  }

  if (postalCode) {
    conditions['whereAddress'] = {
      ...conditions['whereAddress'],

      postalCode: {
        [Op.iLike]: postalCode,
      },
    };
  }

  if (city) {
    conditions['whereCity'] = {
      cityName: {
        [Op.iLike]: city,
      },
    };
  }

  if (state) {
    conditions['whereCity'] = {
      ...conditions['whereCity'],
      stateName: {
        [Op.iLike]: state,
      },
    };
  }

  if (country) {
    conditions['whereCountry'] = {
      countryName: {
        [Op.iLike]: country,
      },
    };
  }

  if (Object.keys(conditions).length === 0) {
    return undefined;
  }

  return conditions;
}

export function parseCustomersPaginationFilters(req: Request) {
  const { first_name: firstName, last_name: lastName, email, phone_number: phoneNumber, registered_on: registeredOn } = req.query;

  const conditions: WhereOptions[] = [];

  const firstNameFilter = parsePaginationFilter<string>('firstName', firstName?.toString());
  if (firstNameFilter) {
    conditions.push(firstNameFilter);
  }

  const lastNameFilter = parsePaginationFilter<string>('lastName', lastName?.toString());
  if (lastNameFilter) {
    conditions.push(lastNameFilter);
  }

  const emailFilter = parsePaginationFilter<string>('email', email?.toString());
  if (emailFilter) {
    conditions.push(emailFilter);
  }

  const phoneNumberFilter = parsePaginationFilter<string>('phoneNumber', phoneNumber?.toString());
  if (phoneNumberFilter) {
    conditions.push(phoneNumberFilter);
  }

  const registeredOnFilter = parseFilterRangeQuery<string>('registeredOn', registeredOn?.toString());
  if (registeredOnFilter) {
    conditions.push(registeredOnFilter);
  }

  const where = conditions.reduce<WhereOptions>((acc, curr) => {
    acc = { ...acc, ...curr };
    return acc;
  }, {});

  const addressConditions = parseAddressFilters(req);

  let customersConditions = undefined;

  if (Object.keys(where).length > 0) {
    customersConditions = where;
  }

  return { customersFilter: customersConditions, addressFilter: addressConditions };
}
