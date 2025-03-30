import { DataTypes, CreationOptional } from 'sequelize';
import BaseModel from './baseModel';
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
  declare genreIds: number[];
  declare originCountryIds: number[];
  declare languageId: number;
  declare movieStatus: string;
  declare popularity: number;
  declare budget: bigint;
  declare revenue: bigint;
  declare ratingAverage: number;
  declare ratingCount: number;
  declare posterUrl: string;
  declare rentalRate: number;
  declare rentalDuration: number;
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
    genreIds: {
      type: DataTypes.ARRAY(DataTypes.INTEGER),
      field: 'genre_ids',
    },
    originCountryIds: {
      type: DataTypes.ARRAY(DataTypes.INTEGER),
      field: 'origin_country_ids',
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
    // hooks: {
    //   beforeSave(instance, options) {
    //     console.log('New id', instance.getDataValue('id'));
    //   },
    //   beforeValidate(instance, options) {},
    // },
  }
);

export default Movie;
