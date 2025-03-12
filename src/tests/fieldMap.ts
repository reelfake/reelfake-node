type ModelForTest = 'movie' | 'genre' | 'city' | 'country' | 'movieLanguage';

export const FIELD_MAP: Record<ModelForTest, Record<string, string>> = {
  movie: {
    id: 'id',
    tmdb_id: 'tmdbId',
    imdb_id: 'imdbId',
    title: 'title',
    original_title: 'originalTitle',
    overview: 'overview',
    runtime: 'runtime',
    release_date: 'releaseDate',
    genres: 'genres',
    country: 'country',
    movie_language: 'language',
    movie_status: 'movieStatus',
    popularity: 'popularity',
    budget: 'budget',
    revenue: 'revenue',
    rating_average: 'ratingAverage',
    rating_count: 'ratingCount',
    poster_url: 'posterUrl',
    rental_rate: 'rentalRate',
    rental_duration: 'rentalDuration',
  },
  genre: {
    id: 'id',
    genre_name: 'genreName',
  },
  city: {
    id: 'id',
    city_name: 'cityName',
    state_name: 'stateName',
    country_id: 'countryId',
  },
  country: {
    id: 'id',
    country_name: 'countryName',
    iso_country_code: 'countryCode',
  },
  movieLanguage: {
    id: 'id',
    language_name: 'languageName',
    iso_language_code: 'languageCode',
  },
};
