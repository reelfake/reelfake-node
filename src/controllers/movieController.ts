import type { Request, Response } from 'express';
import { Includeable, Op, Transaction, WhereOptions, col, literal } from 'sequelize';
import sequelize from '../sequelize.config';
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
import {
  AppError,
  parseMoviesPaginationFilters,
  parseRequestQuery,
  getPaginationOffset,
  getPaginationOffsetWithFilters,
  getPaginationMetadata,
} from '../utils';
import { ITEMS_PER_PAGE_FOR_PAGINATION, ERROR_MESSAGES, movieModelAttributes } from '../constants';
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

async function getMoviesPaginationOffset(pageNumber: number, limitPerPage: number, filters?: WhereOptions) {
  if (filters) {
    const movieIds = await MovieModel.getRecordIds(filters);
    const idOffset = await getPaginationOffsetWithFilters(pageNumber, limitPerPage, movieIds);
    return { idOffset, totalMovies: movieIds.length };
  }

  const totalMovies = await MovieModel.getRowsCountWhere();
  const idOffset = await getPaginationOffset(pageNumber, limitPerPage);
  return { idOffset, totalMovies };
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
  const { page: pageNumberText = '1' } = req.query;

  const limitPerPage = ITEMS_PER_PAGE_FOR_PAGINATION;
  const pageNumber = Number(pageNumberText);

  const filters = parseMoviesPaginationFilters(req);
  const { idOffset, totalMovies } = await getMoviesPaginationOffset(pageNumber, limitPerPage, filters);

  const totalPages = Math.ceil(totalMovies / limitPerPage);
  if (pageNumber > totalPages) {
    throw new AppError('Page out of range', 404);
  }

  const movies = await MovieModel.findAll({
    attributes: [
      'id',
      'title',
      'runtime',
      'releaseDate',
      [
        literal(`
          (SELECT ARRAY_AGG(g.genre_name) FROM unnest("Movie".genre_ids) AS g_ids LEFT OUTER JOIN genre AS g ON g.id = g_ids)
        `),
        'genres',
      ],
      [
        literal(`
          (SELECT ARRAY_AGG(c.iso_country_code) FROM unnest("Movie".origin_country_ids) as c_ids LEFT OUTER JOIN country AS c ON c.id = c_ids)
        `),
        'countriesOfOrigin',
      ],
      [col(`"movieLanguage"."iso_language_code"`), 'language'],
      'popularity',
      'ratingAverage',
      'ratingCount',
      'posterUrl',
      'rentalRate',
    ],
    include: [
      {
        model: MovieLanguageModel,
        as: 'movieLanguage',
        attributes: [],
      },
    ],
    order: [['id', idOffset >= 0 ? 'ASC' : 'DESC']],
    where: {
      id: {
        [idOffset >= 0 ? Op.gte : Op.lte]: idOffset >= 0 ? idOffset : totalMovies,
      },
      ...filters,
    },
    limit: idOffset >= 0 ? limitPerPage : totalMovies % limitPerPage,
  });

  const queryObject = parseRequestQuery(req, ['page']);
  const pagination = getPaginationMetadata(pageNumber, totalMovies, limitPerPage, totalPages, queryObject, filters);

  res.status(200).json({
    items: pageNumber > 0 ? movies : movies.reverse(),
    length: movies.length,
    pagination,
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

export const createMovie = async (req: CustomRequestWithBody<IncomingMovie & { actors: MovieActorPayload[] }>, res: Response) => {
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
