import type { Request, Response } from 'express';
import { Op } from 'sequelize';
import { ActorModel } from '../models';
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
