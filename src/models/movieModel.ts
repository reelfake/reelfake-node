import { DataTypes } from 'sequelize';
import BaseModel from './baseModel';
import sequelize from '../sequelize.config';

class Movie extends BaseModel {}

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
      type: DataTypes.ARRAY(DataTypes.STRING(25)),
      field: 'genres',
    },
    country: {
      type: DataTypes.ARRAY(DataTypes.STRING(60)),
      field: 'country',
    },
    language: {
      type: DataTypes.STRING(60),
      field: 'movie_language',
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
      type: DataTypes.DECIMAL(4, 2),
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
    tableName: 'v_movie',
    timestamps: false,
  }
);

export default Movie;
