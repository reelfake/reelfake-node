import type { Request } from 'express';
import { Op, WhereOptions } from 'sequelize';
import { parseFilterRangeQuery, parsePaginationFilter } from '../utils';
import { availableGenres, availableCountries, availableMovieLanguages } from '../constants';

function parseFilterForArrayTypeColumn(columnName: string, filterText: string | undefined) {
  let availableItems: { [key: string]: number } = {};

  switch (columnName) {
    case 'genreIds':
      availableItems = { ...availableGenres };
      break;
    case 'originCountryIds':
      availableItems = { ...availableCountries };
      break;
    default:
      return undefined;
  }

  const jsonArr = [];
  let isArray = false;

  if (filterText && filterText.startsWith('[') && filterText.endsWith(']')) {
    jsonArr.push(...JSON.parse(filterText));
    isArray = true;
  } else {
    jsonArr.push(...(filterText ? filterText.split(',') : []));
  }

  const ids = jsonArr.map((item) => availableItems[item.toUpperCase()]);

  if (ids.length === 0) return undefined;

  if (isArray) {
    return {
      [columnName]: {
        [Op.contains]: ids,
      },
    };
  }

  return {
    [columnName]: {
      // array overlapping --> e.g. origin_country_ids && ARRAY[...]
      [Op.overlap]: ids,
    },
  };
}

function parseMovieLanguageFilter(movieLanguages: string | undefined) {
  const languages = movieLanguages ? movieLanguages.split(',') : [];
  const languageIds = languages.map((l) => availableMovieLanguages[l.toUpperCase()]);

  if (languages.length > 0) {
    return {
      languageId: languageIds,
    };
  }

  return undefined;
}

export function parseMoviesPaginationFilters(req: Request) {
  const { title, genres: genresText, release_date: releaseDate, countries, languages: movieLanguages, rating } = req.query;

  const conditions: WhereOptions[] = [];

  const titleFilter = parsePaginationFilter('title', title?.toString());
  if (titleFilter) {
    conditions.push(titleFilter);
  }

  const genresFilter = parseFilterForArrayTypeColumn('genreIds', genresText?.toString());
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

  const cuntriesFilter = parseFilterForArrayTypeColumn('originCountryIds', countries?.toString());
  if (cuntriesFilter) {
    conditions.push(cuntriesFilter);
  }

  const movieLanguageFilter = parseMovieLanguageFilter(movieLanguages?.toString());
  if (movieLanguageFilter) {
    conditions.push(movieLanguageFilter);
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
