import type { Request } from 'express';
import { Op, WhereOptions } from 'sequelize';
import { MovieModel } from '../models';
import { parseFilterRangeQuery } from '../utils';
import { availableGenres } from '../constants';

function parseRatingQuery(ratingQuery: string | undefined) {
  const ratingRange = ratingQuery?.toString().split(',');

  if (ratingRange && ratingRange.length === 1) {
    return {
      ratingAverage: {
        [Op.eq]: Number(ratingRange[0]),
      },
    };
  }

  if (ratingRange && ratingRange.length === 2) {
    const [min = '0', max = '10'] = ratingRange;
    return {
      ratingAverage: {
        [Op.between]: [Number(min), Number(max)],
      },
    };
  }

  return undefined;
}

function parseGenresFilter(genresQuery: string | undefined) {
  const genres = genresQuery ? genresQuery.toString().split(',') : [];

  const genreIds = Object.entries(availableGenres)
    .filter(([key, value]) => genres.includes(value))
    .map(([key]) => Number(key));

  if (genres.length > 0) {
    return {
      genreIds: {
        [Op.contains]: genreIds,
      },
    };
  }

  return undefined;
}

export function parseMoviesPaginationFilters(req: Request) {
  const { genres: genresText, release_date: releaseDate, rating } = req.query;

  const conditions: WhereOptions[] = [];

  const genresFilter = parseGenresFilter(genresText?.toString());
  if (genresFilter) {
    conditions.push(genresFilter);
  }

  const releaseDateFilter = parseFilterRangeQuery<string>('releaseDate', releaseDate?.toString());
  if (releaseDateFilter) {
    conditions.push(releaseDateFilter);
  }

  const ratingFilter = parseRatingQuery(rating?.toString());
  if (ratingFilter) {
    conditions.push(ratingFilter);
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
