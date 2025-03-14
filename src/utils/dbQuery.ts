import type { Sequelize } from 'sequelize';
import { GenreModel, CityModel, CountryModel, MovieLanguageModel } from '../models';

export async function executeQuery(sequelize: Sequelize, query: string) {
  const queryResult = await sequelize.query(query);
  const [results, metadata] = queryResult;
  return results;
}

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
