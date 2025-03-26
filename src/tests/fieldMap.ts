type ModelForTest =
  | 'movie'
  | 'genre'
  | 'city'
  | 'country'
  | 'movieLanguage'
  | 'actor'
  | 'address'
  | 'store'
  | 'inventory'
  | 'user';

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
  actor: {
    id: 'id',
    tmdb_id: 'tmdbId',
    imdb_id: 'imdbId',
    actor_name: 'actorName',
    biography: 'biography',
    birthday: 'birthday',
    deathday: 'deathday',
    place_of_birth: 'placeOfBirth',
    popularity: 'popularity',
    profile_picture_url: 'profilePictureUrl',
  },
  address: {
    id: 'id',
    addressLine: 'address_line',
    cityId: 'city_id',
    postalCode: 'postal_code',
  },
  store: {
    id: 'id',
    managerStaffId: 'manager_staff_id',
    addressId: 'address_id',
    phoneNumber: 'phone_number',
  },
  inventory: {
    id: 'id',
    movieId: 'movie_id',
    storeId: 'store_id',
    stockCount: 'stock_count',
  },
  user: {
    id: 'id',
    customerId: 'customer_id',
    staffId: 'staff_id',
    managerStaffId: 'manager_staff_id',
    userUUID: 'user_uuid',
    userEmail: 'user_email',
    userPassword: 'user_password',
  },
};
