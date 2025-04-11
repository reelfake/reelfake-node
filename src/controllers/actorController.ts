import type { Request, Response } from 'express';
import { Op, literal } from 'sequelize';
import { ActorModel, MovieActorModel, MovieModel } from '../models';
import { AppError } from '../utils';
import { ITEMS_PER_PAGE_FOR_PAGINATION } from '../constants';
import { CustomRequestWithBody, CustomRequest } from '../types';

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
  req: CustomRequestWithBody<{ movieId: number; characterName: string; castOrder: number }>,
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
    throw new AppError(`Actor not found with id ${actorId}`, 404);
  }

  const movie = await MovieModel.findByPk(movieId);

  if (movie === null) {
    throw new AppError(`Movie not found with id ${movieId}`, 404);
  }

  const [result, isCreated] = await MovieActorModel.findOrCreate({
    defaults: {
      actorId,
      movieId,
      characterName,
      castOrder,
    },
    where: {
      actorId,
      movieId,
    },
  });

  if (!isCreated) {
    throw new AppError('Actor already exists for the given movie', 400);
  }

  if (!result) {
    throw new AppError('Failed to add actor to movie', 500);
  }

  res.status(201).json(result);
};
