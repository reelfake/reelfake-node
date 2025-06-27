import type { Request } from 'express';
import { Op, WhereOptions } from 'sequelize';
import { parseFilterRangeQuery } from './pagination.utils';

function parseActorNameFilter(actorName: string | undefined) {
  if (!actorName) return undefined;

  return {
    actorName: {
      [Op.iLike]: actorName,
    },
  };
}

function parsePlaceOfBirthFilter(placeOfBirth: string | undefined) {
  if (!placeOfBirth) return undefined;

  return {
    placeOfBirth: {
      [Op.iLike]: placeOfBirth,
    },
  };
}

export function parseActorsPaginationFilters(req: Request) {
  const { name: actorName, birthday, deathday, place_of_birth: placeOfBirth, popularity } = req.query;

  const conditions: WhereOptions[] = [];

  const actorNameFilter = parseActorNameFilter(actorName?.toString());
  if (actorNameFilter) {
    conditions.push(actorNameFilter);
  }

  const birthdayFilter = parseFilterRangeQuery<string>('birthday', birthday?.toString());
  if (birthdayFilter) {
    conditions.push(birthdayFilter);
  }
  const deathdayFilter = parseFilterRangeQuery<string>('deathday', deathday?.toString());
  if (deathdayFilter) {
    conditions.push(deathdayFilter);
  }

  const placeOfBirthFilter = parsePlaceOfBirthFilter(placeOfBirth?.toString());
  if (placeOfBirthFilter) {
    conditions.push(placeOfBirthFilter);
  }

  const popularityFilter = parseFilterRangeQuery<number>('popularity', popularity?.toString());
  if (popularityFilter) {
    conditions.push(popularityFilter);
  }

  const where = conditions.reduce<WhereOptions>((acc, curr) => {
    acc = { ...acc, ...curr };
    return acc;
  }, {});

  if (Object.keys(where).length === 0) {
    return undefined;
  }

  return where;
}
