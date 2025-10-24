// Stats
export { getStatistics } from './statsController';
// Genres
export { getGenres } from './genreController';
// City
export { getCities } from './cityController';
// Country
export { getCountries } from './countryController';
// Movie language
export { getMovieLanguages } from './movieLanguageController';
// Movie
export { getMovies, getMovieById, findInStores, createMovie, addActors, updateMovie, deleteMovie } from './movieController';
// Movie actor
export { uploadMovies, trackUpload, validateUpload } from './movieUploadController';
// Actor
export { getActors, getActorById, updateActor, deleteActor, addActor, addToMovie } from './actorController';
// Store
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
// Auth
export { login, logout } from './authController';
// Staff
export {
  getStaff,
  getStaffById,
  getStoreManagers,
  updateStaff,
  createStaff,
  deleteStaff,
  changeStaffPassword,
  forgotStaffPassword,
} from './staffController';
// Address
export { getAddresses, getAddressesInCity, getAddressesInState } from './addressController';
// Customer
export {
  getCustomers,
  getCustomerById,
  deleteCustomer,
  updateCustomer,
  registerCustomer,
  deactivateCustomer,
  activateCustomer,
  changeCustomerPassword,
  forgotCustomerPassword,
} from './customerController';
// Rental
export { getRentals, getRentalById, getRentalsForStore } from './rentalController';
