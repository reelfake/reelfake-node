import { DataTypes, Op, CreationOptional, WhereOptions } from 'sequelize';
import BaseModel from './baseModel';
import GenreModel from './genreModel';
import CountryModel from './countryModel';
import ActorModel from './actorModel';
import MovieLanguageModel from './movieLanguageModel';
import sequelize from '../sequelize.config';

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
  declare rentalDuration: number;

  public static async getRowsCountWhere(conditions: WhereOptions[]) {
    const where = conditions.reduce<WhereOptions>((acc, curr) => {
      acc = { ...acc, ...curr };
      return acc;
    }, {});

    const countOfRows = await Movie.count({
      where: conditions.length > 0 ? where : undefined,
    });
    return countOfRows;
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
      unique: true,
      validate: {
        isNumeric: { msg: 'Tmdb id must be a number' },
        notNull: { msg: 'Tmdb id cannot be empty or null' },
      },
    },
    imdbId: {
      type: DataTypes.STRING(60),
      field: 'imdb_id',
      allowNull: true,
      unique: true,
    },
    title: {
      type: DataTypes.STRING(255),
      field: 'title',
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Title cannot be empty or null' },
        notNull: { msg: 'Title cannot be empty or null' },
      },
    },
    originalTitle: {
      type: DataTypes.STRING(255),
      field: 'original_title',
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Original title cannot be empty or null' },

        notNull: { msg: 'Original title cannot be empty or null' },
      },
    },
    overview: {
      type: DataTypes.TEXT,
      field: 'overview',
    },
    runtime: {
      type: DataTypes.SMALLINT,
      field: 'runtime',
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Runtime cannot be empty or null' },
        notNull: { msg: 'Runtime cannot be empty or null' },
        isNumeric: { msg: 'Runtime must be a number' },
      },
    },
    releaseDate: {
      type: DataTypes.DATEONLY,
      field: 'release_date',
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Release date cannot be empty or null' },
        notNull: { msg: 'Release date cannot be empty or null' },
        isDate: { msg: 'Release date must be a date in format MM-DD-YYYY', args: true },
      },
    },
    genres: {
      type: DataTypes.VIRTUAL,
    },
    genreIds: {
      type: DataTypes.ARRAY(DataTypes.INTEGER),
      field: 'genre_ids',
      validate: {
        isArray: true,
      },
    },
    countriesOfOrigin: {
      type: DataTypes.VIRTUAL,
    },
    originCountryIds: {
      type: DataTypes.ARRAY(DataTypes.INTEGER),
      field: 'origin_country_ids',
      validate: {
        isArray: true,
      },
    },
    language: {
      type: DataTypes.VIRTUAL,
    },
    languageId: {
      type: DataTypes.INTEGER,
      field: 'language_id',
      validate: {
        isNumeric: true,
      },
    },
    movieStatus: {
      type: DataTypes.STRING(20),
      field: 'movie_status',
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Movie status cannot be empty or null' },
        notNull: { msg: 'Movie status cannot be empty or null' },
      },
    },
    popularity: {
      type: DataTypes.REAL,
      field: 'popularity',
      validate: {
        isFloat: { msg: 'Popularity must be a floating type number' },
      },
    },
    budget: {
      type: DataTypes.BIGINT,
      field: 'budget',
    },
    revenue: {
      type: DataTypes.BIGINT,
      field: 'revenue',
    },
    ratingAverage: {
      type: DataTypes.REAL,
      field: 'rating_average',
    },
    ratingCount: {
      type: DataTypes.INTEGER,
      field: 'rating_count',
    },
    posterUrl: {
      type: DataTypes.STRING(90),
      field: 'poster_url',
      validate: {
        isUrl: { msg: 'Poster url must be a valid url' },
      },
    },
    rentalRate: {
      type: DataTypes.DECIMAL({ precision: 4, scale: 2 }),
      field: 'rental_rate',
      validate: {
        isFloat: { msg: 'Rental rate must be a floating type numer' },
      },
    },
    rentalDuration: {
      type: DataTypes.SMALLINT,
      field: 'rental_duration',
      validate: {
        isNumeric: { msg: 'Rental duration must be a valid number' },
      },
    },
  },
  {
    sequelize,
    modelName: 'Movie',
    tableName: 'movie',
    timestamps: false,
    hooks: {
      async beforeSave(instance) {
        let genreIds = await GenreModel.findAll({
          where: {
            genreName: {
              [Op.in]: instance.getDataValue('genres'),
            },
          },
          attributes: ['id'],
        });

        genreIds = genreIds.map((g) => g.getDataValue('id'));

        let countryIds = await CountryModel.findAll({
          where: {
            countryCode: {
              [Op.in]: instance
                .getDataValue('countriesOfOrigin')
                .map((countryCode: string) => countryCode.toUpperCase()),
            },
          },
          attributes: ['id'],
        });

        countryIds = countryIds.map((c) => c.getDataValue('id'));

        let languageId = await MovieLanguageModel.findOne({
          where: {
            languageCode: instance.getDataValue('language'),
          },
          attributes: ['id'],
        });

        languageId = languageId?.getDataValue('id');

        instance.setDataValue('genreIds', genreIds);
        instance.setDataValue('originCountryIds', countryIds);
        instance.setDataValue('languageId', languageId);
      },
    },
  }
);

export default Movie;
