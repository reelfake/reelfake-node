import type { Request, Response } from 'express';
import { Includeable, Op, Transaction, WhereOptions, col, fn, literal } from 'sequelize';
import sequelize from '../sequelize.config';
import { executeQuery, AppError } from '../utils';
import {
  ActorModel,
  MovieActorModel,
  MovieModel,
  StoreModel,
  InventoryModel,
  AddressModel,
  CityModel,
  CountryModel,
  MovieLanguageModel,
} from '../models';
import { ITEMS_PER_PAGE_FOR_PAGINATION, availableGenres, ERROR_MESSAGES, movieModelAttributes } from '../constants';
import { CustomRequest, CustomRequestWithBody, IncomingMovie, MovieActorPayload } from '../types';

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

async function createActors(t: Transaction, actors: MovieActorPayload[], movieId?: number) {
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
      transaction: t,
    }
  );

  const createdActorIds = createdActors.map((actorItem) => ({
    id: actorItem.getDataValue('id'),
    tmdbId: actorItem.getDataValue('tmdbId'),
  }));

  const newMovieActorRecords: Array<{
    actorId: number;
    characterName: string;
    castOrder: number;
  }> = [];

  for (const idAndTmdbId of createdActorIds) {
    const { id, tmdbId } = idAndTmdbId;
    const movieCredit = actors.find((a) => a.tmdbId === tmdbId);

    if (!movieCredit) {
      throw new AppError(`There was an error adding actor with tmdbId ${tmdbId}`, 500);
    }

    const characterName = movieCredit.characterName;
    const castOrder = movieCredit.castOrder;

    newMovieActorRecords.push({
      actorId: id,
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
        transaction: t,
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

  const associations: Includeable[] = [
    {
      model: MovieLanguageModel,
      as: 'movieLanguage',
      attributes: [],
    },
  ];

  if (includeActors) {
    associations.push({
      model: ActorModel,
      as: 'actors',
      attributes: [
        'id',
        'actorName',
        [literal(`"actors->movieActor"."character_name"`), 'characterName'],
        [literal(`"actors->movieActor"."cast_order"`), 'castOrder'],
        'profilePictureUrl',
      ],
      through: {
        as: 'movieActor',
        attributes: [],
      },
    });
  }

  const movie = await MovieModel.findOne({
    attributes: [...movieModelAttributes, [literal(`"movieLanguage"."iso_language_code"`), 'language']],
    where: {
      id,
    },
    include: associations,
  });

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
    attributes: [...movieModelAttributes, [literal(`"movieLanguage"."iso_language_code"`), 'language']],
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

  const inventory = await InventoryModel.findAll({
    attributes: [['id', 'inventoryId'], 'stock'],
    include: [
      {
        model: StoreModel,
        as: 'store',
        attributes: [
          'id',
          ['store_manager_id', 'managerId'],
          'phoneNumber',
          [literal(`"store->address"."address_line"`), 'addressLine'],
          [literal(`"store->address->city"."city_name"`), 'city'],
          [literal(`"store->address->city"."state_name"`), 'state'],
          [literal(`"store->address->city->country"."country_name"`), 'country'],
          [literal(`"store->address"."postal_code"`), 'postalCode'],
        ],
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
                include: [
                  {
                    model: CountryModel,
                    as: 'country',
                    attributes: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    where: {
      movieId: id,
    },
    order: [
      ['stock', 'DESC'],
      ['inventoryId', 'ASC'],
    ],
  });

  if (inventory.length === 0) {
    throw new AppError('Movie is out of stock', 404);
  }

  res.status(200).json({
    items: inventory,
    length: inventory.length,
  });
};

export const createMovie = async (
  req: CustomRequestWithBody<IncomingMovie & { actors: MovieActorPayload[] }>,
  res: Response
) => {
  const { user, validateUserRole } = req;
  validateUserRole?.(() => !!(user && (user.staffId || user.storeManagerId)));
  const actors = req.body.actors;
  const hasActors = actors && actors.length > 0;

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

    if (!newMovieId) {
      throw new AppError('There was an error adding the movie', 500);
    }

    if (hasActors) {
      await createActors(t, actors, newMovieId);
    }

    return newMovieId;
  });

  const associations: Includeable[] = [
    {
      model: MovieLanguageModel,
      as: 'movieLanguage',
      attributes: [],
    },
  ];

  if (hasActors) {
    associations.push({
      model: ActorModel,
      as: 'actors',
      attributes: [
        'id',
        'actorName',
        [literal(`"actors->movieActor"."character_name"`), 'characterName'],
        [literal(`"actors->movieActor"."cast_order"`), 'castOrder'],
        'profilePictureUrl',
      ],
      through: {
        as: 'movieActor',
        attributes: [],
      },
    });
  }

  const createdMovieDetail = await MovieModel.findOne({
    attributes: [...movieModelAttributes, [literal(`"movieLanguage"."iso_language_code"`), 'language']],
    where: {
      id: movieId,
    },
    include: associations,
  });

  res.status(201).json(createdMovieDetail);
};

export const addActors = async (req: CustomRequestWithBody<MovieActorPayload[]>, res: Response) => {
  const { user, validateUserRole } = req;
  validateUserRole?.(() => !!(user && (user.staffId || user.storeManagerId)));

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

export const updateMovie = async (req: CustomRequestWithBody<Partial<IncomingMovie>>, res: Response) => {
  const { user, validateUserRole } = req;
  validateUserRole?.(() => !!(user && user.storeManagerId));

  const { id: idText } = req.params;

  const id = Number(idText);

  if (isNaN(id)) {
    throw new AppError('Invalid movie id', 400);
  }

  const moviePayload = req.body;

  const instance = await MovieModel.findByPk(id);

  if (!instance) {
    throw new AppError(ERROR_MESSAGES.RESOURCES_NOT_FOUND, 404);
  }

  await instance.update({ ...moviePayload });

  res.status(204).send();
};

export const deleteMovie = async (req: CustomRequest, res: Response) => {
  const { user, validateUserRole } = req;
  validateUserRole?.(() => !!(user && user.storeManagerId));

  const { id: idText } = req.params;

  const id = Number(idText);

  if (isNaN(id)) {
    throw new AppError('Invalid movie id', 400);
  }

  await sequelize.transaction(async (t) => {
    const instance = await MovieModel.findByPk(id, { transaction: t });

    if (!instance) {
      throw new AppError(ERROR_MESSAGES.RESOURCES_NOT_FOUND, 404);
    }

    await instance.destroy({ transaction: t });

    await MovieActorModel.destroy({
      where: {
        movieId: id,
      },
      transaction: t,
    });

    await InventoryModel.destroy({
      where: {
        movieId: id,
      },
      transaction: t,
    });
  });

  res.status(204).send();
};
