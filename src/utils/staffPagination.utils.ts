import type { Request } from 'express';
import { WhereOptions } from 'sequelize';
import { parsePaginationFilter, parseAddressFilters } from './pagination.utils';

export function parseStaffPaginationFilters(req: Request) {
  const { first_name: firstName, last_name: lastName, email, phone_number: phoneNumber } = req.query;

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

  const where = conditions.reduce<WhereOptions>((acc, curr) => {
    acc = { ...acc, ...curr };
    return acc;
  }, {});

  const addressConditions = parseAddressFilters(req);

  let staffConditions = undefined;

  if (Object.keys(where).length > 0) {
    staffConditions = where;
  }

  return { staffFilter: staffConditions, addressFilter: addressConditions };
}
