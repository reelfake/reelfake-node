import type { Request, Response } from 'express';
import { Op, Transaction, WhereOptions, col, fn, literal } from 'sequelize';
import { Literal } from 'sequelize/lib/utils';
import { executeQuery, AppError } from '../utils';
import { ActorModel, MovieActorModel, MovieModel } from '../models';
import { ITEMS_PER_PAGE_FOR_PAGINATION, availableGenres } from '../constants';
import { CustomRequestWithBody, IncomingMovie, NewMovieActorPayload } from '../types';
import sequelize from '../sequelize.config';

const movieModelAttributes: (string | [Literal, string])[] = [
  'id',
  'imdbId',
  'title',
  'originalTitle',
  'overview',
  'runtime',
  'releaseDate',
  [literal(`(SELECT ARRAY_AGG(g.genre_name) FROM genre AS g JOIN UNNEST(genre_ids) AS gid ON g.id = gid)`), 'genres'],
  [
    literal(
      `(SELECT ARRAY_AGG(c.iso_country_code) FROM country AS c JOIN UNNEST(origin_country_ids) AS cid ON c.id = cid)`
    ),
    'countriesOfOrigin',
  ],
  [literal(`(SELECT l.iso_language_code FROM movie_language AS l WHERE l.id = language_id)`), 'language'],
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

const newMovieFields = [
  'tmdbId',
  'imdbId',
  'title',
  'originalTitle',
  'overview',
  'runtime',
  'releaseDate',
  'genreIds',
  'originCountryIds',
  'languageId',
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

const newActorFields = [
  'tmdbId',
  'imdbId',
  'actorName',
  'biography',
  'birthday',
  'deathday',
  'placeOfBirth',
  'popularity',
  'profilePictureUrl',
];

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

async function getMoviesUsingQuery(pageNumber: number, genresIds: number[], orderBy: string, filter: string = '') {
  if (!MovieModel.sequelize) {
    throw new AppError('Server encoutered unhandled exception', 500);
  }

  const startingRowNumber = pageNumber * ITEMS_PER_PAGE_FOR_PAGINATION - ITEMS_PER_PAGE_FOR_PAGINATION;

  const filters: string[] = [];
  if (genresIds.length > 0) {
    const genresQuery = `m.genre_ids @> '{${genresIds.map((gId) => `${gId}`).join(',')}}'`;
    filters.push(genresQuery);
  }
  if (filter) {
    filters.push(`${filter}`);
  }

  let filterText = filters.length > 1 ? filters.join(' AND ').trim() : filters[0];
  const whereClause = filterText ? `HAVING ${filterText}` : '';
  const orderByFields = orderBy
    .split(',')
    .map((field) => `m.${field.trim()}`)
    .join(',');

  const queryText = `
    WITH exppanded_movies AS (
      SELECT ROW_NUMBER() OVER (ORDER BY ${orderByFields} ASC) AS "rowNumber", m.id, 
      m.title, m.overview, m.runtime, m.release_date AS "releaseDate", ARRAY_AGG(distinct g.genre_name) AS genres,
      ARRAY_AGG(distinct c.iso_country_code) AS "countriesOfOrigin", ml.iso_language_code as language,
      m.popularity, m.rating_average AS "ratingAverage", m.rating_count AS "ratingCount", m.poster_url AS "posterUrl",
      m.rental_rate AS "rentalRate", m.rental_duration AS "rentalDuration"
      FROM movie AS m LEFT JOIN country AS c ON c.id = ANY(m.origin_country_ids)
      LEFT JOIN genre AS g ON g.id = ANY(m.genre_ids)
      LEFT JOIN movie_language ml ON m.language_id = ml.id
      GROUP BY m.id, ml.iso_language_code ${whereClause}
      ORDER BY ${orderByFields}
    )
    SELECT id, title, overview, runtime, "releaseDate", genres, "countriesOfOrigin", language,
    popularity, "ratingAverage", "ratingCount", "posterUrl", "rentalRate", "rentalDuration" 
    FROM exppanded_movies WHERE "rowNumber" > ${startingRowNumber} LIMIT ${ITEMS_PER_PAGE_FOR_PAGINATION}
  `;

  const movies = await executeQuery(MovieModel.sequelize, queryText);
  return movies;
}

async function createActors(transaction: Transaction, actors: NewMovieActorPayload[], movieId?: number) {
  const createdActors = await ActorModel.bulkCreate(
    actors.map((actor) => ({
      tmdbId: actor.tmdbId,
      imdbId: actor.imdbId,
      actorName: actor.actorName,
      biography: actor.biography,
      birthday: actor.birthday,
      deathday: actor.deathday,
      placeOfBirth: actor.placeOfBirth,
      popularity: actor.popularity,
      profilePictureUrl: actor.profilePictureUrl,
    })),
    {
      fields: newActorFields,
      ignoreDuplicates: true,
      transaction: transaction,
    }
  );

  const newActorIdsAndTmdbIds = await ActorModel.findAll({
    attributes: ['id', 'tmdbId'],
    where: {
      tmdbId: {
        [Op.in]: createdActors.map((actor) => actor.getDataValue('tmdbId')),
      },
    },
    transaction: transaction,
  });

  const newMovieActorRecords: Array<{
    actorId: number;
    characterName: string;
    castOrder: number;
  }> = [];

  for (const idAndTmdbId of newActorIdsAndTmdbIds) {
    const actorId = idAndTmdbId.getDataValue('id');
    const tmdbId = idAndTmdbId.getDataValue('tmdbId');
    const newMovieActorData = actors.find((a) => a.tmdbId === tmdbId);

    if (!newMovieActorData) {
      throw new AppError(`There was an error adding actor with tmdbId ${tmdbId}`, 500);
    }

    const characterName = newMovieActorData.characterName;
    const castOrder = newMovieActorData.castOrder;

    newMovieActorRecords.push({
      actorId,
      characterName,
      castOrder,
    });
  }

  if (movieId) {
    await MovieActorModel.bulkCreate(
      newMovieActorRecords.map((movieActor) => ({
        movieId: movieId,
        actorId: movieActor.actorId,
        characterName: movieActor.characterName,
        castOrder: movieActor.castOrder,
      })),
      {
        fields: ['movieId', 'actorId', 'characterName', 'castOrder'],
        ignoreDuplicates: false,
        transaction: transaction,
      }
    );
  }
}

export const getMovies = async (req: Request, res: Response) => {
  if (!MovieModel.sequelize) {
    throw new AppError('Server encoutered unhandled exception', 500);
  }

  const { pageNumber: pageNumberText, genres: genresText } = req.query;
  const pageNumber = pageNumberText ? Number(pageNumberText) : 1;

  const genres = genresText ? genresText.toString().split(',') : [];
  const limitPerPage = ITEMS_PER_PAGE_FOR_PAGINATION;

  const genreIds = Object.entries(availableGenres)
    .filter(([key, value]) => genres.includes(value))
    .map(([key]) => Number(key));

  const conditions: WhereOptions[] = [];

  if (genres.length > 0) {
    conditions.push({
      genreIds: {
        [Op.contains]: genreIds,
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
    genreIds,
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
  const { id: idText } = req.params;
  const { includeActors: includeActorsText } = req.query;

  const id = Number(idText);
  const includeActors = includeActorsText === 'true';

  const movie = await MovieModel.findOne({
    where: {
      id,
    },
    attributes: includeActors
      ? [...movieModelAttributes, [fn('public.get_actors', id), 'actors']]
      : [...movieModelAttributes],
  });

  // The below one also works but it gives unnecessary nested role object inside every actors.
  // const movie = await MovieModel.findOne({
  //   where: {
  //     id,
  //   },
  //   attributes: {
  //     exclude: ['tmdbId'],
  //   },
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

  const result = await MovieModel.findAll({
    attributes: movieModelAttributes,
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
      LEFT OUTER JOIN movie AS m ON i.movie_id = m.id LEFT OUTER JOIN address AS a ON s.address_id = a.id
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

export const addMovie = async (req: CustomRequestWithBody<IncomingMovie>, res: Response) => {
  const { user } = req;
  if (!user) {
    throw new AppError('Invalid token', 401);
  }

  if (!user.staffId && !user.storeManagerId) {
    throw new AppError('Unauthorized access', 403);
  }

  const actors = req.body.actors;
  const hasActors = actors && actors.length > 0;

  try {
    const movieId = await sequelize.transaction(async (t) => {
      const movieInstance = MovieModel.build({ ...req.body });
      const newMovie = await movieInstance.save({
        fields: newMovieFields,
        transaction: t,
      });

      newMovie.setDataValue('genreIds', undefined);
      newMovie.setDataValue('originCountryIds', undefined);
      newMovie.setDataValue('languageId', undefined);
      newMovie.setDataValue('rentalRate', Number(newMovie.getDataValue('rentalRate')));

      const newMovieId = newMovie.getDataValue('id');
      if (hasActors) {
        await createActors(t, actors, newMovieId);
      }

      const createdMovieId = newMovieId;

      if (!createdMovieId) {
        throw new AppError('There was an error adding the movie', 500);
      }

      return createdMovieId;
    });

    const createdMovieDetail = await MovieModel.findOne({
      where: {
        id: movieId,
      },
      attributes: hasActors
        ? [
            ...movieModelAttributes,
            [
              literal(`(SELECT ARRAY_AGG(g.genre_name) FROM genre AS g JOIN UNNEST(genre_ids) AS gid ON g.id = gid)`),
              'genres',
            ],
            [
              literal(
                `(SELECT ARRAY_AGG(c.iso_country_code) FROM country AS c JOIN UNNEST(origin_country_ids) AS cid ON c.id = cid)`
              ),
              'countriesOfOrigin',
            ],
            [literal(`(SELECT l.iso_language_code FROM movie_language AS l WHERE l.id = language_id)`), 'language'],
            [sequelize.fn('public.get_actors', movieId), 'actors'],
          ]
        : movieModelAttributes,
    });

    res.status(201).json(createdMovieDetail);
  } catch (err: unknown) {
    throw new AppError((err as Error).message, 500);
  }
};

export const addActors = async (req: CustomRequestWithBody<NewMovieActorPayload[]>, res: Response) => {
  const { user } = req;
  if (!user) {
    throw new AppError('Invalid token', 401);
  }

  if (!user.staffId && !user.storeManagerId) {
    throw new AppError('Unauthorized access', 403);
  }

  const { id: idText } = req.params;
  const movieId = Number(idText);

  if (isNaN(movieId)) {
    throw new AppError('Invalid movie id', 400);
  }

  const actors = req.body;

  try {
    await sequelize.transaction(async (t) => {
      await createActors(t, actors);
    });

    const actorTmdbIds = actors.map((actor) => actor.tmdbId);
    const createdActors = await MovieActorModel.findAll({
      attributes: [
        [col(`"actors"."id"`), 'id'],
        [col(`"actors"."imdb_id"`), 'imdbId'],
        [col(`"actors"."actor_name"`), 'actorName'],
        [col(`"actors"."biography"`), 'biography'],
        [col(`"actors"."birthday"`), 'birthday'],
        [col(`"actors"."deathday"`), 'deathday'],
        [col(`"actors"."place_of_birth"`), 'placeOfBirth'],
        [col(`"actors"."popularity"`), 'popularity'],
        [col(`"actors"."profile_picture_url"`), 'profilePictureUrl'],
        'characterName',
        'castOrder',
      ],
      include: [
        {
          model: ActorModel,
          as: 'actors',
          attributes: [],
          where: {
            tmdbId: {
              [Op.in]: actorTmdbIds,
            },
          },
        },
      ],
    });
    res.status(200).json(createdActors);
  } catch (err: unknown) {
    throw new AppError((err as Error).message, 500);
  }
};
