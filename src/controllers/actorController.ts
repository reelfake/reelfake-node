import type { Request, Response } from 'express';
import { Op } from 'sequelize';
import { ActorModel, MovieViewModel } from '../models';
import { AppError } from '../utils';
import { ITEMS_PER_PAGE_FOR_PAGINATION } from '../constants';

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
            model: MovieViewModel,
            as: 'movies',
            through: { attributes: [] },
            attributes: ['id', 'title', 'releaseDate', 'genres', 'ratingAverage', 'ratingCount'],
          },
        ]
      : undefined,
  });

  if (actor === undefined) {
    throw new AppError(`Actor not found with id ${id}`, 404);
  }

  res.status(200).json(actor);
};
