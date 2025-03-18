import GenreModel from './genreModel';
import CityModel from './cityModel';
import CountryModel from './countryModel';
import MovieLanguageModel from './movieLanguageModel';
import MovieModel from './movieModel';
import ActorModel from './actorModel';
import MovieActorModel from './movieActor';

export {
  GenreModel,
  CityModel,
  CountryModel,
  MovieLanguageModel,
  MovieModel,
  ActorModel,
  MovieActorModel,
};

MovieModel.belongsToMany(ActorModel, {
  through: MovieActorModel,
  foreignKey: 'movie_id',
  as: 'actors',
});
ActorModel.belongsToMany(MovieModel, {
  through: MovieActorModel,
  foreignKey: 'actor_id',
  as: 'movies',
});

// MovieActorModel.belongsTo(MovieModel);
// MovieActorModel.belongsTo(ActorModel);
// MovieModel.hasMany(MovieActorModel);
// ActorModel.hasMany(MovieActorModel);
