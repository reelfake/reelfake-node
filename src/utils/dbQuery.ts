import { QueryTypes, Sequelize, Op } from 'sequelize';
import { GenreModel, CityModel, CountryModel, MovieLanguageModel, MovieModel } from '../models';

export async function queryGenres() {
  const genres = await GenreModel.findAll();
  return genres;
}

export async function queryCountries() {
  const countries = await CountryModel.findAll();
  return countries;
}

export async function queryCities(includeCountry: boolean = false) {
  if (includeCountry) {
    const citiesWithCountry = await CityModel.findAll({
      include: [
        {
          model: CountryModel,
          attributes: ['id', 'countryName', 'countryCode'],
          as: 'country',
        },
      ],
      attributes: ['id', 'cityName', 'stateName'],
    });
    return citiesWithCountry;
  }

  const cities = await CityModel.findAll({
    attributes: ['id', 'cityName', 'stateName', 'countryId'],
  });

  return cities;
}

export async function queryMovieLanguages() {
  const movieLanguages = await MovieLanguageModel.findAll();
  return movieLanguages;
}

export async function queryMovies(limitPerPage: number) {
  const movies = await MovieModel.findAll({
    limit: limitPerPage,
    order: [['id', 'ASC']],
  });
  return movies;
}

export async function queryMoviesPage(
  pageNumber: number,
  limitPerPage: number,
  lastSeenPageNumber: number,
  lastSeenId: number
) {
  if (pageNumber === 1) {
    return await queryMovies(limitPerPage);
  }

  const startingId = lastSeenId + (pageNumber - lastSeenPageNumber - 1) * limitPerPage;

  const movies = await MovieModel.findAll({
    limit: limitPerPage,
    where: {
      id: {
        [Op.gt]: startingId,
      },
    },
    order: [['id', 'ASC']],
  });
  return movies;
}
