import ApiKeyModel from './apiKeyModel';
import GenreModel from './genreModel';
import CityModel from './cityModel';
import CountryModel from './countryModel';
import MovieLanguageModel from './movieLanguageModel';
import MovieModel from './movieModel';
import ActorModel from './actorModel';
import MovieActorModel from './movieActor';
import AddressModel from './addressModel';
import StoreModel from './storeModel';
import InventoryModel from './inventoryModel';
import CustomerModel from './customerModel';
import StaffModel from './staffModel';
import UserModel from './userModel';

export {
  ApiKeyModel,
  GenreModel,
  CityModel,
  CountryModel,
  MovieLanguageModel,
  MovieModel,
  ActorModel,
  MovieActorModel,
  AddressModel,
  StoreModel,
  InventoryModel,
  CustomerModel,
  UserModel,
};

MovieModel.belongsToMany(ActorModel, {
  through: MovieActorModel,
  foreignKey: 'movieId',
  as: 'actors',
});
ActorModel.belongsToMany(MovieModel, {
  through: MovieActorModel,
  foreignKey: 'actorId',
  as: 'movies',
});

AddressModel.belongsTo(CityModel, { as: 'city', foreignKey: 'cityId' });

StoreModel.belongsTo(AddressModel, { as: 'address', foreignKey: 'addressId' });

InventoryModel.belongsTo(StoreModel, { as: 'store', foreignKey: 'storeId' });
InventoryModel.belongsTo(MovieModel, { as: 'movie', foreignKey: 'movieId' });

CustomerModel.belongsTo(AddressModel, { as: 'address', foreignKey: 'address_id' });

UserModel.belongsTo(CustomerModel, { as: 'customer', foreignKey: 'customer_id' });
UserModel.belongsTo(StaffModel, { as: 'staff', foreignKey: 'staff_id' });
UserModel.belongsTo(StaffModel, { as: 'storeManager', foreignKey: 'manager_staff_id' });
