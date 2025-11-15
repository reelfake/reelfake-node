import { DataTypes, Op, CreationOptional, WhereOptions } from 'sequelize';
import sequelize from '../sequelize.config';
import BaseModel from './baseModel';
import { availableCountries, availableGenres, availableMovieLanguages } from '../constants';
import { capitalize } from '../utils';

class Movie extends BaseModel {
  declare id: CreationOptional<number>;
  declare tmdbId: number;
  declare imdbId: string;
  declare title: string;
  declare originalTitle: string;
  declare overview: string;
  declare runtime: number;
  declare releaseDate: Date;
  declare genres: string[];
  declare countriesOfOrigin: string[];
  declare language: string;
  declare movieStatus: string;
  declare popularity: number;
  declare budget: bigint;
  declare revenue: bigint;
  declare ratingAverage: number;
  declare ratingCount: number;
  declare posterUrl: string;
  declare rentalRate: number;

  public static async getRowsCountWhere(conditions?: WhereOptions) {
    const countOfRows = await Movie.count({
      where: conditions,
    });
    return countOfRows;
  }

  public static async getRecordIds(conditions?: WhereOptions) {
    const results = await Movie.findAll({
      attributes: ['id'],
      where: conditions,
      order: [['id', 'ASC']],
    });
    const ids = results.map<number>((res) => res.toJSON().id);
    return ids;
  }
}

Movie.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      field: 'id',
    },
    tmdbId: {
      type: DataTypes.INTEGER,
      field: 'tmdb_id',
      allowNull: false,
      validate: {
        isNumeric: { msg: 'The tmdb_id is not a number' },
        notNull: true,
      },
    },
    imdbId: {
      type: DataTypes.STRING(60),
      field: 'imdb_id',
      validate: {
        len: [0, 60],
      },
    },
    title: {
      type: DataTypes.STRING(255),
      field: 'title',
      allowNull: false,
      validate: {
        notNull: true,
        notEmpty: true,
      },
    },
    originalTitle: {
      type: DataTypes.STRING(255),
      field: 'original_title',
      allowNull: false,
      validate: {
        notNull: true,
        notEmpty: true,
      },
    },
    overview: {
      type: DataTypes.TEXT,
      field: 'overview',
    },
    runtime: {
      type: DataTypes.SMALLINT,
      field: 'runtime',
      validate: {
        isNumberOrNull(value: string) {
          if (value && !isNaN(Number(value))) {
            return Number(value);
          }

          if (value && isNaN(Number(value))) {
            throw 'The runtime is not a number';
          }

          return 0;
        },
      },
    },
    releaseDate: {
      type: DataTypes.DATEONLY,
      field: 'release_date',
      allowNull: false,
      validate: {
        notNull: true,
        isDate: true,
      },
    },
    genres: {
      type: DataTypes.VIRTUAL,
    },
    genreIds: {
      type: DataTypes.ARRAY(DataTypes.INTEGER),
      field: 'genre_ids',
      allowNull: false,
      validate: {
        notNull: true,
        isValidGenres(genres: number[]) {
          const validGenres = Object.values(availableGenres);
          const invalidGenres = genres.filter((g) => !validGenres.includes(g));

          if (invalidGenres.length > 0) {
            throw 'The given genres are invalid';
          }

          return genres;
        },
      },
    },
    countriesOfOrigin: {
      type: DataTypes.VIRTUAL,
    },
    originCountryIds: {
      type: DataTypes.ARRAY(DataTypes.INTEGER),
      field: 'origin_country_ids',
      allowNull: false,
      validate: {
        notNull: true,
        isValidCountries(countries: number[]) {
          const validCountries = Object.values(availableCountries);
          const invalidCountries = countries.filter((c) => !validCountries.includes(c));

          if (invalidCountries.length > 0) {
            throw 'The given countries are invalid';
          }

          return countries;
        },
      },
    },
    language: {
      type: DataTypes.VIRTUAL,
    },
    languageId: {
      type: DataTypes.INTEGER,
      field: 'language_id',
      allowNull: false,
      validate: {
        notNull: true,
        isIn: [Object.values(availableMovieLanguages)],
      },
    },
    movieStatus: {
      type: DataTypes.STRING(20),
      field: 'movie_status',
      allowNull: false,
      validate: {
        notNull: true,
      },
    },
    popularity: {
      type: DataTypes.REAL,
      field: 'popularity',
      allowNull: false,
      validate: {
        notNull: true,
      },
    },
    budget: {
      type: DataTypes.BIGINT,
      field: 'budget',
      allowNull: false,
      validate: {
        isNumeric: true,
        notNull: true,
      },
    },
    revenue: {
      type: DataTypes.BIGINT,
      field: 'revenue',
      allowNull: false,
      validate: {
        isNumeric: true,
        notNull: true,
      },
    },
    ratingAverage: {
      type: DataTypes.REAL,
      field: 'rating_average',
      allowNull: false,
      validate: {
        notNull: true,
        max: 10.0,
      },
    },
    ratingCount: {
      type: DataTypes.INTEGER,
      field: 'rating_count',
      allowNull: false,
      validate: {
        isNumeric: true,
        notNull: true,
      },
    },
    posterUrl: {
      type: DataTypes.STRING(90),
      field: 'poster_url',
      allowNull: true,
      validate: {
        isUrlOrEmpty(value: string) {
          if (value === null || value.trim() === '') {
            return;
          }

          if (!require('validator').isURL(value)) {
            throw new Error('URL must be a valid URL or empty.');
          }
        },
      },
    },
    rentalRate: {
      type: DataTypes.DECIMAL({ precision: 4, scale: 2 }),
      field: 'rental_rate',
    },
  },
  {
    sequelize,
    modelName: 'Movie',
    tableName: 'movie',
    timestamps: false,
  }
);

export default Movie;
