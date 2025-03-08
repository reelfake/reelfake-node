import { GenreModel } from '../models';
import { CityModel, CountryModel, MovieLanguageModel, MovieModel } from '../models';

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

export async function queryCitiesByCountry(countryCode: string) {
  const cities = await CityModel.findAll({
    where: {},
  });
}

export async function queryMovieLanguages() {
  const movieLanguages = await MovieLanguageModel.findAll();
  return movieLanguages;
}

export async function queryMovies(pageNumber: number, limitPerPage: number) {
  const movies = await MovieModel.findAll({
    limit: limitPerPage,
    offset: limitPerPage * pageNumber,
    order: [['id', 'ASC']],
  });
  return movies;
}
