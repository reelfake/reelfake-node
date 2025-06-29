import type { Request } from 'express';
import { Op, WhereOptions } from 'sequelize';
import { parseFilterRangeQuery } from '../utils';
import { availableGenres } from '../constants';

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

  const ratingFilter = parseFilterRangeQuery<number>('ratingAverage', rating?.toString());
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
