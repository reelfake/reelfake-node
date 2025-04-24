import { col, literal } from 'sequelize';
import { Literal } from 'sequelize/lib/utils';

export const movieModelAttributes: (string | [Literal, string])[] = [
  'id',
  'imdbId',
  'title',
  'originalTitle',
  'overview',
  'runtime',
  'releaseDate',
  [
    literal(`(SELECT JSON_AGG(g.genre_name) FROM genre AS g INNER JOIN UNNEST(genre_ids) AS g_ids ON g.id = g_ids)`),
    'genres',
  ],
  [
    literal(
      `(SELECT ARRAY_AGG(c.iso_country_code) FROM country AS c INNER JOIN UNNEST(origin_country_ids) AS c_ids ON c.id = c_ids)`
    ),
    'countriesOfOrigin',
  ],
  [literal(`"movieLanguage"."iso_language_code"`), 'language'],
  'movieStatus',
  'popularity',
  'budget',
  'revenue',
  'ratingAverage',
  'ratingCount',
  'posterUrl',
  'rentalRate',
  'rentalDuration',
];
