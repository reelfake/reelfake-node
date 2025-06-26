import type { Request } from 'express';
import { Op, WhereOptions } from 'sequelize';
import { availableGenres } from '../constants';
import { MovieModel } from '../models';

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

function parseReleaseDateQuery(releaseDateQuery: string | undefined) {
  const releaseDateRange = releaseDateQuery?.toString().split(',');
  if (releaseDateRange && releaseDateRange.length === 1) {
    return {
      releaseDate: {
        [Op.eq]: releaseDateRange[0],
      },
    };
  }

  if (releaseDateRange && releaseDateRange.length === 2) {
    const [minReleaseDate, maxReleaseDate] = releaseDateRange;

    if (minReleaseDate && !maxReleaseDate) {
      return {
        releaseDate: {
          [Op.gte]: minReleaseDate,
        },
      };
    }

    if (!minReleaseDate && maxReleaseDate) {
      return {
        releaseDate: {
          [Op.lte]: maxReleaseDate,
        },
      };
    }

    return {
      releaseDate: {
        [Op.between]: releaseDateRange,
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

export function parseMovieFilters(req: Request) {
  const { genres: genresText, release_date: releaseDate, rating } = req.query;

  const conditions: WhereOptions[] = [];

  const genresFilter = parseGenresFilter(genresText?.toString());
  if (genresFilter) {
    conditions.push(genresFilter);
  }

  const releaseDateFilter = parseReleaseDateQuery(releaseDate?.toString());
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

export async function getOffsetData(pageNumber: number, limit: number, filters?: WhereOptions) {
  if (filters) {
    const movieIds = await MovieModel.getRecordIds(filters);
    let idOffset = Number(movieIds.at(0));

    const isLastPage = pageNumber === -1 || pageNumber === movieIds.length / limit;

    if (isLastPage) {
      idOffset = Number(movieIds.at(-limit));
    }

    if (pageNumber > 1) {
      idOffset = Number(movieIds.at(pageNumber * limit - limit));
    }

    return { idOffset: idOffset, totalMovies: movieIds.length };
  }

  const idOffset = pageNumber > 0 ? pageNumber * limit - limit + 1 : pageNumber;
  const totalMovies = await MovieModel.getRowsCountWhere();

  return { idOffset, totalMovies };
}
