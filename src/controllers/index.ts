// Auth
export { getUserProfile, login, logout } from './authController';
// Stats
export { getStatistics, getMostRentedMovies, getSalesByStore, getSalesByMonth, getSalesByCity } from './statsController';
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
export { uploadMovies, trackUpload, validateUpload, trackUploadValidation } from './movieUploadController';
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
  getStoreManagersSummary,
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
  setPreferredStore,
  getCustomerRentals,
} from './customerController';
// Rental
export { getRentals, getRentalById, getRentalsForStore } from './rentalController';
// Inventory
export { addInventory, updateInventory, deleteInventory } from './inventoryController';
