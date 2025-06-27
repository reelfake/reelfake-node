export { getGenres } from './genreController';
export { getCities } from './cityController';
export { getCountries } from './countryController';
export { getMovieLanguages } from './movieLanguageController';
export {
  getMovies,
  getMovieById,
  searchMovies,
  findInStores,
  createMovie,
  addActors,
  updateMovie,
  deleteMovie,
} from './movieController';
export { getActors, getActorById, updateActor, deleteActor, addActor, addToMovie } from './actorController';
export {
  getStores,
  getStockCount,
  getMoviesInStore,
  getStaffInStore,
  getStoreById,
  createStore,
  updateStore,
  deleteStore,
} from './storeController';
export { login, logout } from './authController';
export { registerUser, getUser, updateUser } from './userController';
export {
  getStaff,
  getStaffById,
  getStoreManagers,
  updateStaff,
  createStaff,
  deleteStaff,
  setStaffPassword,
} from './staffController';
export { getAddresses, getAddressesInCity, getAddressesInState } from './addressController';
export {
  getCustomers,
  getCustomerById,
  createCustomer,
  deleteCustomer,
  updateCustomer,
  setCustomerPassword,
} from './customerController';
export { getRentals, getRentalById, getRentalsForStore } from './rentalController';
