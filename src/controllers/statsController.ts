import type { Request, Response } from 'express';
import { col, fn, literal } from 'sequelize';
import {
  MovieModel,
  CustomerModel,
  ActorModel,
  StaffModel,
  StoreModel,
  RentalModel,
  InventoryModel,
  AddressModel,
  CityModel,
} from '../models';
import { ERROR_MESSAGES, STATS_LIMIT } from '../constants';
import { CustomRequest } from '../types';
import { AppError } from '../utils';

function getLimitQuery(req: Request) {
  const limit = req.query.limit;

  if (!limit) throw new AppError('Limit is required', 400);

  const limitNum = Number(limit);

  if (isNaN(limitNum)) {
    throw new AppError(`Invalid limit - ${limit}`, 400);
  }

  if (limitNum > 500) {
    throw new AppError(ERROR_MESSAGES.STATS_LIMIT_EXCEEDED.replace('{{STATS_LIMIT}}', STATS_LIMIT.toString()), 400);
  }

  return limitNum;
}

export async function getStatistics(req: Request, res: Response) {
  const totalMovies = await MovieModel.count();
  const totalActors = await ActorModel.count();
  const totalCustomers = await CustomerModel.count();
  const totalStaff = await StaffModel.count();
  const totalStores = await StoreModel.count();

  res.status(200).json({ totalMovies, totalActors, totalCustomers, totalStaff, totalStores });
}

export async function getMostRentedMovies(req: Request, res: Response) {
  const limitNum = getLimitQuery(req);

  const mostRentedMovies = await RentalModel.findAll({
    attributes: [
      [col('"inventory"."movie_id"'), 'movieId'],
      [col('"inventory->movie"."title"'), 'movieTitle'],
      [fn('count', col('"Rental"."id"')), 'totalRentals'],
    ],
    include: [
      {
        model: InventoryModel,
        as: 'inventory',
        attributes: [],
        include: [
          {
            model: MovieModel,
            as: 'movie',
            attributes: [],
          },
        ],
      },
    ],
    group: [col('"inventory"."movie_id"'), col('"inventory->movie"."id"')],
    order: [['totalRentals', 'desc']],
    limit: limitNum,
  });

  res.json({ items: mostRentedMovies, length: mostRentedMovies.length });
}

export async function getSalesByStore(req: Request, res: Response) {
  const limitNum = getLimitQuery(req);

  const salesByStore = await RentalModel.findAll({
    attributes: [
      [col('"inventory"."store_id"'), 'storeId'],
      [col('"inventory->store->storeManager"."first_name"'), 'firstName'],
      [col('"inventory->store->storeManager"."last_name"'), 'lastName'],
      [col('"inventory->store->storeManager"."email"'), 'email'],
      [fn('sum', col('"Rental"."amount_paid"')), 'revenue'],
    ],
    include: [
      {
        model: InventoryModel,
        as: 'inventory',
        attributes: [],
        include: [
          {
            model: StoreModel,
            as: 'store',
            attributes: [],
            include: [
              {
                model: StaffModel,
                as: 'storeManager',
                required: true,
                attributes: [],
              },
            ],
          },
        ],
      },
    ],
    group: [col('"inventory"."store_id"'), col('"inventory->store->storeManager"."id"')],
    order: [['revenue', 'desc']],
    limit: limitNum,
  });

  res.json({ items: salesByStore, length: salesByStore.length });
}

export async function getSalesByMonth(req: Request, res: Response) {
  const salesByMonth = await RentalModel.findAll({
    attributes: [
      [fn('to_char', col('"Rental"."payment_date"'), 'Mon-YYYY'), 'month'],
      [fn('count', col('"Rental"."id"')), 'totalSales'],
      [fn('sum', col('"Rental"."amount_paid"')), 'revenue'],
    ],
    group: 'month',
    order: ['month'],
  });

  res.json({ items: salesByMonth, length: salesByMonth.length });
}

export async function getSalesByCity(req: CustomRequest, res: Response) {
  const limitNum = getLimitQuery(req);

  /*
    select c.id, c.state_name, c.city_name, count(r.id)
    from rental as r left join inventory as i on r.inventory_id = i.id 
    left join store as s on i.store_id = s.id 
    left join address as a on s.address_id = a.id
    left join city as c on a.city_id = c.id 
    group by c.id
  */

  const salesByCity = await RentalModel.findAll({
    attributes: [
      [col('"inventory->store->address->city"."id"'), 'id'],
      [col('"inventory->store->address->city"."city_name"'), 'cityName'],
      [col('"inventory->store->address->city"."state_name"'), 'stateName'],
      [fn('count', col('"Rental"."id"')), 'totalSales'],
    ],
    include: [
      {
        model: InventoryModel,
        as: 'inventory',
        attributes: [],
        include: [
          {
            model: StoreModel,
            as: 'store',
            attributes: [],
            include: [
              {
                model: AddressModel,
                as: 'address',
                attributes: [],
                include: [
                  {
                    model: CityModel,
                    as: 'city',
                    attributes: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    group: [col('"inventory->store->address"."city_id"'), col('"inventory->store->address->city"."id"')],
    order: [['totalSales', 'desc']],
    limit: limitNum,
  });

  res.json({ items: salesByCity, length: salesByCity.length });
}
