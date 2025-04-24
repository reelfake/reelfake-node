import { DataTypes, Op, CreationOptional, WhereOptions } from 'sequelize';
import BaseModel from './baseModel';
import GenreModel from './genreModel';
import CountryModel from './countryModel';
import MovieLanguageModel from './movieLanguageModel';
import sequelize from '../sequelize.config';
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
    },
    imdbId: {
      type: DataTypes.STRING(60),
      field: 'imdb_id',
    },
    title: {
      type: DataTypes.STRING(255),
      field: 'title',
    },
    originalTitle: {
      type: DataTypes.STRING(255),
      field: 'original_title',
    },
    overview: {
      type: DataTypes.TEXT,
      field: 'overview',
    },
    runtime: {
      type: DataTypes.SMALLINT,
      field: 'runtime',
    },
    releaseDate: {
      type: DataTypes.DATEONLY,
      field: 'release_date',
    },
    genres: {
      type: DataTypes.VIRTUAL,
    },
    genreIds: {
      type: DataTypes.ARRAY(DataTypes.INTEGER),
      field: 'genre_ids',
    },
    countriesOfOrigin: {
      type: DataTypes.VIRTUAL,
    },
    originCountryIds: {
      type: DataTypes.ARRAY(DataTypes.INTEGER),
      field: 'origin_country_ids',
    },
    language: {
      type: DataTypes.VIRTUAL,
    },
    languageId: {
      type: DataTypes.INTEGER,
      field: 'language_id',
    },
    movieStatus: {
      type: DataTypes.STRING(20),
      field: 'movie_status',
    },
    popularity: {
      type: DataTypes.REAL,
      field: 'popularity',
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
    },
    rentalRate: {
      type: DataTypes.DECIMAL({ precision: 4, scale: 2 }),
      field: 'rental_rate',
    },
    rentalDuration: {
      type: DataTypes.SMALLINT,
      field: 'rental_duration',
    },
  },
  {
    sequelize,
    modelName: 'Movie',
    tableName: 'movie',
    timestamps: false,
  }
);

Movie.addHook('beforeSave', async (instance, options) => {
  const genres = instance.getDataValue('genres');
  const countries = instance.getDataValue('countriesOfOrigin');
  const language = instance.getDataValue('language');

  if (genres && genres.length > 0) {
    const capitalizedGenres = genres.map((g: string) => `${capitalize(g)}`);
    let genreIds = await GenreModel.findAll({
      where: {
        genreName: {
          [Op.in]: capitalizedGenres,
        },
      },
      attributes: ['id'],
    });
    genreIds = genreIds.map((g) => g.getDataValue('id'));
    instance.setDataValue('genreIds', genreIds);
  }

  if (countries && countries.length > 0) {
    let countryIds = await CountryModel.findAll({
      where: {
        countryCode: {
          [Op.in]: countries.map((countryCode: string) => countryCode.toUpperCase()),
        },
      },
      attributes: ['id'],
    });

    countryIds = countryIds.map((c) => c.getDataValue('id'));
    instance.setDataValue('originCountryIds', countryIds);
  }

  if (language) {
    let languageId = await MovieLanguageModel.findOne({
      where: {
        languageCode: language.toLowerCase(),
      },
      attributes: ['id'],
    });

    languageId = languageId?.getDataValue('id');
    instance.setDataValue('languageId', languageId);
  }
});

export default Movie;
