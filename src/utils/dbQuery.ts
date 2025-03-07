import { GenreModel } from '../models';
import { CityModel, CountryModel, MovieLanguageModel } from '../models';

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

  const cities = await CityModel.findAll();

  return cities;
}

export async function queryMovieLanguages() {
  const movieLanguages = await MovieLanguageModel.findAll();
  return movieLanguages;
}
