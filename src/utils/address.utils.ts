import { WhereOptions, literal, Includeable } from 'sequelize';
import { CityModel, CountryModel, AddressModel } from '../models';

export function includeAddress(
  {
    whereAddress,
    whereCity,
    whereCountry,
    addressPath,
  }: {
    whereAddress?: WhereOptions;
    whereCity?: WhereOptions;
    whereCountry?: WhereOptions;
    addressPath?: string;
  } = { addressPath: undefined, whereAddress: undefined, whereCity: undefined, whereCountry: undefined }
) {
  const associations: Includeable = {
    model: AddressModel,
    as: 'address',
    attributes: addressPath
      ? [
          'id',
          'addressLine',
          [literal(`"${addressPath}->city"."city_name"`), 'cityName'],
          [literal(`"${addressPath}->city"."state_name"`), 'stateName'],
          [literal(`"${addressPath}->city->country"."country_name"`), 'country'],
          'postalCode',
        ]
      : [],
    where: whereAddress,
    include: [
      {
        model: CityModel,
        as: 'city',
        attributes: [],
        where: whereCity,
        include: [
          {
            model: CountryModel,
            as: 'country',
            attributes: [],
            where: whereCountry,
          },
        ],
      },
    ],
  };

  return associations;
}
