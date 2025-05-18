import { WhereOptions, literal } from 'sequelize';
import { CityModel, CountryModel, AddressModel } from '../models';

export function getAddressAssociations(
  whereAddress: WhereOptions | undefined = undefined,
  whereCity: WhereOptions | undefined = undefined,
  whereCountry: WhereOptions | undefined = undefined
) {
  const associations = {
    model: AddressModel,
    as: 'address',
    attributes: [],
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
