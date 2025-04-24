import type { Request, Response } from 'express';
import { Op, literal } from 'sequelize';
import sequelize from '../sequelize.config';
import { ActorModel, MovieActorModel, MovieModel } from '../models';
import { AppError } from '../utils';
import { ERROR_MESSAGES, ITEMS_PER_PAGE_FOR_PAGINATION } from '../constants';
import { CustomRequestWithBody, CustomRequest, MovieActorPayload, ActorPayload } from '../types';

export const getActors = async (req: Request, res: Response) => {
  const { pageNumber: pageNumberText = '1' } = req.query;
  const pageNumber = Number(pageNumberText);

  const idOffset = (pageNumber - 1) * ITEMS_PER_PAGE_FOR_PAGINATION;

  const totalActors = await ActorModel.getTotalRowsCount();

  const actors = await ActorModel.findAll({
    where: {
      id: {
        [Op.gt]: idOffset,
      },
    },
    attributes: { exclude: ['tmdbId'] },
    order: [['id', 'ASC']],
    limit: ITEMS_PER_PAGE_FOR_PAGINATION,
  });

  res
    .status(200)
    .set({
      'rf-page-number': pageNumber,
    })
    .json({
      items: actors,
      length: actors.length,
      totalPages: Math.ceil(totalActors / ITEMS_PER_PAGE_FOR_PAGINATION),
      totalItems: totalActors,
    });
};

export const searchActor = async (req: Request, res: Response) => {
  const operator = req.query.name ? Op.eq : Op.like;
  const searchText = req.query.name ?? `%${req.query.q}%`;

  const { q, pageNumber: pageNumberText = '1' } = req.query;
  const pageNumber = Number(pageNumberText);

  const totalRows = await ActorModel.count({
    where: {
      actorName: {
        [operator]: searchText,
      },
    },
  });

  const result = await ActorModel.findAll({
    attributes: { exclude: ['tmdbId'] },
    where: {
      actorName: {
        [operator]: searchText,
      },
    },
    limit: ITEMS_PER_PAGE_FOR_PAGINATION,
    offset: (pageNumber - 1) * ITEMS_PER_PAGE_FOR_PAGINATION,
    order: [['actorName', 'ASC']],
  });

  if (result.length === 0) {
    throw new AppError('Resources not found', 404);
  }

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

export const getActorById = async (req: Request, res: Response) => {
  const { id: idText } = req.params;
  const { includeMovies: includeMoviesText } = req.query;

  const includeMovies = includeMoviesText === 'true';

  const id = Number(idText);

  if (isNaN(id) || id <= 0) {
    throw new AppError('Invalid actor id', 400);
  }

  const actor = await ActorModel.findOne({
    where: {
      id,
    },
    attributes: { exclude: ['tmdbId'] },
    include: includeMovies
      ? [
          {
            model: MovieModel,
            as: 'movies',
            through: { as: 'credit', attributes: ['characterName', 'castOrder'] },
            attributes: [
              'id',
              'title',
              'releaseDate',
              [
                literal(`(SELECT ARRAY_AGG(g.genre_name) FROM genre AS g JOIN UNNEST(genre_ids) AS gid ON g.id = gid)`),
                'genres',
              ],
              'runtime',
              'ratingAverage',
              'ratingCount',
              'posterUrl',
            ],
          },
        ]
      : undefined,
  });

  if (actor === undefined) {
    throw new AppError(`Actor not found with id ${id}`, 404);
  }

  res.status(200).json(actor);
};

export const addToMovie = async (
  req: CustomRequestWithBody<MovieActorPayload & { movieId: number }>,
  res: Response
) => {
  const { user } = req;
  if (!user) {
    throw new AppError('Invalid token', 401);
  }

  if (!user.staffId && !user.storeManagerId) {
    throw new AppError('Unauthorized access', 403);
  }

  const { id: idText } = req.params;
  const actorId = Number(idText);

  if (!isNaN(actorId) && actorId <= 0) {
    throw new AppError('Invalid actor id', 400);
  }

  const { movieId, characterName, castOrder } = req.body;

  if (!movieId || !characterName || !castOrder) {
    throw new AppError('Missing required fields', 400);
  }

  const actor = await ActorModel.findByPk(actorId);

  if (actor === null) {
    throw new AppError(ERROR_MESSAGES.RESOURCES_NOT_FOUND, 404);
  }

  const movie = await MovieModel.findByPk(movieId);

  if (movie === null) {
    throw new AppError('Movie not found', 404);
  }

  const result = await sequelize.transaction(async (t) => {
    const [result, isCreated] = await MovieActorModel.findOrCreate({
      defaults: {
        actorId,
        movieId,
        characterName,
        castOrder,
      },
      fields: ['actorId', 'movieId', 'characterName', 'castOrder'],
      where: {
        actorId,
        movieId,
      },
      transaction: t,
    });

    if (!isCreated) {
      throw new AppError('Actor already exists for the given movie', 400);
    }

    if (!result) {
      throw new AppError('Failed to add actor to movie', 500);
    }

    return result;
  });

  res.status(201).json(result);
};

export const addActor = async (req: CustomRequestWithBody<ActorPayload>, res: Response) => {
  const { user, validateUserRole } = req;
  validateUserRole?.(() => !!(user && (user.staffId || user.storeManagerId)));

  const similarActorCount = await ActorModel.count({
    where: {
      actorName: req.body.actorName,
    },
  });

  if (similarActorCount > 0) {
    throw new AppError(`Actor with name ${req.body.actorName} already exist`, 400);
  }

  const newActorInstance = await sequelize.transaction(async (t) => {
    const newActorInstance = await ActorModel.create(
      { ...req.body },
      {
        fields: [
          'tmdbId',
          'imdbId',
          'actorName',
          'biography',
          'birthday',
          'deathday',
          'placeOfBirth',
          'popularity',
          'profilePictureUrl',
        ],
        transaction: t,
      }
    );

    if (!newActorInstance) {
      throw new AppError('Failed to add new actor', 500);
    }

    return newActorInstance;
  });

  const id = newActorInstance.getDataValue('id');
  const actorInstance = await ActorModel.findByPk(id, {
    attributes: [
      'id',
      'imdbId',
      'actorName',
      'biography',
      'birthday',
      'deathday',
      'placeOfBirth',
      'popularity',
      'profilePictureUrl',
    ],
  });

  if (!actorInstance) {
    throw new AppError('Failed to add new actor', 500);
  }

  const newActor = actorInstance.toJSON();

  res.status(201).json(newActor);
};

export const updateActor = async (req: CustomRequestWithBody<ActorPayload>, res: Response) => {
  const { user } = req;
  if (!user) {
    throw new AppError('Invalid token', 401);
  }

  if (!user.storeManagerId) {
    throw new AppError('Unauthorized access', 403);
  }

  const { id: idText } = req.params;

  const id = Number(idText);

  if (isNaN(id)) {
    throw new AppError('Invalid actor id', 400);
  }

  const instance = await ActorModel.findByPk(id);

  if (!instance) {
    throw new AppError(ERROR_MESSAGES.RESOURCES_NOT_FOUND, 404);
  }

  await instance.update({ ...req.body });

  res.status(204).send();
};

export const deleteActor = async (req: CustomRequest, res: Response) => {
  const { user } = req;
  if (!user) {
    throw new AppError('Invalid token', 401);
  }

  if (!user.storeManagerId) {
    throw new AppError('Unauthorized access', 403);
  }

  const { id: idText } = req.params;

  const id = Number(idText);

  if (isNaN(id)) {
    throw new AppError('Invalid actor id', 400);
  }

  await sequelize.transaction(async (t) => {
    const instance = await ActorModel.findByPk(id, { transaction: t });

    if (!instance) {
      throw new AppError(ERROR_MESSAGES.RESOURCES_NOT_FOUND, 404);
    }

    await instance.destroy({ transaction: t });

    await MovieActorModel.destroy({
      where: {
        actorId: id,
      },
      transaction: t,
    });
  });

  res.status(204).send();
};
