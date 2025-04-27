import GenreModel from './genreModel';
import CityModel from './cityModel';
import CountryModel from './countryModel';
import MovieLanguageModel from './movieLanguageModel';
import MovieModel from './movieModel';
import ActorModel from './actorModel';
import MovieActorModel from './movieActorModel';
import AddressModel from './addressModel';
import StoreModel from './storeModel';
import InventoryModel from './inventoryModel';
import CustomerModel from './customerModel';
import StaffModel from './staffModel';
import UserModel from './userModel';

export {
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
  StaffModel,
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

MovieModel.belongsTo(MovieLanguageModel, {
  as: 'movieLanguage',
  foreignKey: 'languageId',
});

AddressModel.belongsTo(CityModel, { as: 'city', foreignKey: 'cityId' });

StoreModel.belongsTo(AddressModel, { as: 'address', foreignKey: 'addressId' });

InventoryModel.belongsTo(StoreModel, { as: 'store', foreignKey: 'storeId' });
InventoryModel.belongsTo(MovieModel, { as: 'movie', foreignKey: 'movieId' });

CustomerModel.belongsTo(StoreModel, { as: 'preferredStore', foreignKey: 'preferredStoreId' });
CustomerModel.belongsTo(AddressModel, { as: 'address', foreignKey: 'addressId' });

StaffModel.belongsTo(AddressModel, { as: 'address', foreignKey: 'addressId' });
StaffModel.belongsTo(StoreModel, { as: 'store', foreignKey: 'storeId' });
StoreModel.hasMany(StaffModel, { as: 'staff', foreignKey: 'storeId' });

UserModel.belongsTo(CustomerModel, { as: 'customer', foreignKey: 'customerId' });
UserModel.belongsTo(StaffModel, { as: 'staff', foreignKey: 'staffId' });
UserModel.belongsTo(StaffModel, { as: 'storeManager', foreignKey: 'storeManagerId' });
