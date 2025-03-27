import type { Request, Response } from 'express';
import { Op, WhereOptions } from 'sequelize';
import { Fn } from 'sequelize/lib/utils';
import { executeQuery, AppError } from '../utils';
import { MovieModel } from '../models';
import { ITEMS_PER_PAGE_FOR_PAGINATION } from '../constants';
import sequelize from '../sequelize.config';

function getReleaseDatesRangeFromQuery(req: Request) {
  const { releaseYear: releaseYearText, releaseFrom, releaseTo } = req.query;
  const releaseYear = Number(releaseYearText);

  if (!isNaN(releaseYear)) {
    return [`${releaseYear}-01-01`, `${releaseYear}-12-31`];
  }

  if (releaseFrom && releaseTo) {
    return [releaseFrom, releaseTo];
  }

  return [];
}

const getMoviesUsingQuery = async (
  pageNumber: number,
  genres: string[],
  orderBy: string,
  filter: string = ''
) => {
  if (!MovieModel.sequelize) {
    throw new AppError('Server encoutered unhandled exception', 500);
  }

  const startingRowNumber =
    pageNumber * ITEMS_PER_PAGE_FOR_PAGINATION - ITEMS_PER_PAGE_FOR_PAGINATION;

  const filters: string[] = [];
  if (genres.length > 0) {
    const genresQuery = `genres @> '{${genres.map((g) => `"${g}"`).join(',')}}'`;
    filters.push(genresQuery);
  }
  if (filter) {
    filters.push(`${filter}`);
  }

  let filterText = filters.length > 1 ? filters.join(' AND ').trim() : filters[0];
  const whereClause = filterText ? `WHERE ${filterText}` : '';

  const queryText = `
    WITH movies_with_row_number AS (
      SELECT ROW_NUMBER() OVER (ORDER BY ${orderBy} ASC) AS "rowNumber", *
      FROM v_movie ${whereClause}
    )
    SELECT id, title, overview, runtime, 
    release_date AS "releaseDate", genres, country, movie_language AS "language", 
    popularity, rating_average AS "ratingAverage", rating_count AS "ratingCount", 
    poster_url AS "posterUrl", rental_rate AS "rentalRate", rental_duration AS "rentalDuration" 
    from movies_with_row_number WHERE "rowNumber" > ${startingRowNumber} LIMIT ${ITEMS_PER_PAGE_FOR_PAGINATION}
  `;

  const movies = await executeQuery(MovieModel.sequelize, queryText);

  return movies;
};

export const getMovies = async (req: Request, res: Response) => {
  if (!MovieModel.sequelize) {
    throw new AppError('Server encoutered unhandled exception', 500);
  }

  const { pageNumber: pageNumberText, genres: genresText } = req.query;
  const pageNumber = pageNumberText ? Number(pageNumberText) : 1;

  const genres = genresText ? genresText.toString().split(',') : [];
  const limitPerPage = ITEMS_PER_PAGE_FOR_PAGINATION;

  const conditions: WhereOptions[] = [];

  if (genres.length > 0) {
    conditions.push({
      genres: {
        [Op.contains]: genres,
      },
    });
  }

  const [startDate, endDate] = getReleaseDatesRangeFromQuery(req);

  const queryHasReleaseDates = startDate && endDate;

  if (queryHasReleaseDates) {
    conditions.push({
      releaseDate: {
        [Op.between]: [startDate, endDate],
      },
    });
  }

  const totalMovies = await MovieModel.getRowsCountWhere(conditions);

  const movies = await getMoviesUsingQuery(
    pageNumber,
    genres,
    queryHasReleaseDates ? 'release_date, id' : 'id',
    queryHasReleaseDates ? `release_date BETWEEN '${startDate}' AND '${endDate}'` : ''
  );
  const moviesCount = movies.length;

  if (moviesCount === 0) {
    throw new AppError('Page out of range', 404);
  }

  res
    .status(200)
    .set({
      'rf-page-number': pageNumber,
    })
    .json({
      items: movies,
      length: moviesCount,
      totalPages: Math.ceil(totalMovies / limitPerPage),
      totalItems: Number(totalMovies),
    });
};

export const getMovieById = async (req: Request, res: Response) => {
  const { movieId: idText } = req.params;
  const { includeActors: includeActorsText } = req.query;

  const id = Number(idText);
  const includeActors = includeActorsText === 'true';

  const attributes: (string | [Fn, string])[] = [
    'id',
    'imdbId',
    'title',
    'originalTitle',
    'overview',
    'runtime',
    'releaseDate',
    'genres',
    'country',
    'language',
    'movieStatus',
    'popularity',
    'budget',
    'revenue',
    'ratingAverage',
    'ratingCount',
    'posterUrl',
    'rentalRate',
    'rentalDuration',
  ];

  if (includeActors) {
    attributes.push([sequelize.fn('public.get_actors', id), 'actors']);
  }

  const movie = await MovieModel.findOne({
    where: {
      id,
    },
    attributes,
  });

  // The below one also works but it gives unnecessary nested role object inside every actors.
  // const movie = await MovieModel.findOne({
  //   where: {
  //     id,
  //   },
  //   attributes: { exclude: ['tmdbId'] },
  //   include: includeActors
  //     ? [
  //         {
  //           model: ActorModel,
  //           as: 'actors',
  //           attributes: {
  //             exclude: ['tmdbId', 'biography', 'birthday', 'deathday', 'placeOfBirth'],
  //           },
  //           through: {
  //             as: 'role',
  //             attributes: ['characterName', 'castOrder'],
  //           },
  //         },
  //       ]
  //     : undefined,
  // });

  if (!movie) {
    throw new AppError(`Movie with id ${id} does not exist`, 404);
  }

  res.status(200).json(movie);
};

export const searchMovies = async (req: Request, res: Response) => {
  const { q, pageNumber: pageNumberText = '1' } = req.query;
  if (!q) {
    throw new AppError('Query text is missing', 400);
  }

  const pageNumber = Number(pageNumberText);

  const totalRows = await MovieModel.getRowsCountWhere([
    {
      title: {
        [Op.like]: `%${q}%`,
      },
    },
  ]);

  const attributesToInclude = [
    'id',
    'title',
    'runtime',
    'releaseDate',
    'genres',
    'country',
    'language',
    'popularity',
    'ratingAverage',
    'ratingCount',
    'posterUrl',
    'rentalRate',
    'rentalDuration',
  ];

  const result = await MovieModel.findAll({
    attributes: attributesToInclude,
    where: {
      title: {
        [Op.like]: `%${q}%`,
      },
    },
    limit: ITEMS_PER_PAGE_FOR_PAGINATION,
    offset: (pageNumber - 1) * ITEMS_PER_PAGE_FOR_PAGINATION,
    order: [['title', 'ASC']],
  });

  res
    .status(200)
    .set('rf-page-number', String(pageNumber))
    .json({
      items: result,
      length: result.length,
      totalItems: totalRows,
      totalPages: Math.ceil(totalRows / ITEMS_PER_PAGE_FOR_PAGINATION),
    });
};

export const findInStores = async (req: Request, res: Response) => {
  const { id: idText } = req.params;

  const id = Number(idText);

  if (isNaN(id)) {
    throw new AppError('Invalid movie id', 400);
  }

  // Solution 1
  const result = await sequelize.query(`
      SELECT s.id, i.id AS "inventoryId", m.id AS "movieId", a.address_line AS "addressLine", c.city_name AS "city",
      c.state_name AS "state", a.postal_code AS "postalCode", cy.country_name AS "country", s.phone_number AS "phoneNumber",
      i.stock_count AS "stock" FROM inventory AS i LEFT OUTER JOIN store AS s ON i.store_id = s.id
      LEFT OUTER JOIN v_movie AS m ON i.movie_id = m.id LEFT OUTER JOIN address AS a ON s.address_id = a.id
      LEFT OUTER JOIN city AS c on a.city_id = c.id LEFT OUTER JOIN country AS cy ON c.country_id = cy.id
      WHERE m.id = ${id} ORDER BY i.stock_count DESC, i.id ASC;
    `);

  const [inventory] = result;

  // Solution 2 (takes around same time as Solution 1)
  // const result = await InventoryModel.findAll({
  //   attributes: ['id', 'stockCount'],
  //   include: [
  //     {
  //       model: StoreModel,
  //       as: 'store',
  //       attributes: ['phoneNumber'],
  //       include: [
  //         {
  //           model: AddressModel,
  //           as: 'address',
  //           attributes: ['addressLine', 'postalCode'],
  //           include: [
  //             {
  //               model: CityModel,
  //               as: 'city',
  //               attributes: ['cityName', 'stateName'],
  //               include: [
  //                 {
  //                   model: CountryModel,
  //                   as: 'country',
  //                   attributes: ['countryName'],
  //                 },
  //               ],
  //             },
  //           ],
  //         },
  //       ],
  //     },
  //   ],
  //   where: {
  //     movieId: id,
  //   },
  //   order: [
  //     ['stockCount', 'DESC'],
  //     ['id', 'ASC'],
  //   ],
  // });

  // const inventory = result.map((inv) => {
  //   const storeObject = inv.getDataValue('store');
  //   const storeData = {
  //     addressLine: storeObject.address.addressLine,
  //     city: storeObject.address.city.cityName,
  //     state: storeObject.address.city.stateName,
  //     country: storeObject.address.city.country.countryName,
  //     postalCode: storeObject.address.postalCode,
  //     phoneNumber: storeObject.phoneNumber,
  //   };

  //   return {
  //     id: inv.getDataValue('id'),
  //     ...storeData,
  //     stockCount: inv.getDataValue('stockCount'),
  //   };
  // });

  if (inventory.length === 0) {
    throw new AppError('Movie is out of stock', 404);
  }

  res.status(200).json({
    items: inventory,
    length: inventory.length,
  });
};
