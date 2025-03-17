import type { Request, Response } from 'express';
import { Op } from 'sequelize';
import { ActorModel } from '../models';
import { AppError } from '../utils';
import { ERROR_MESSAGES, ITEMS_PER_PAGE_FOR_PAGINATION } from '../constants';

const sendFirstPage = async (req: Request, res: Response) => {
  const { q } = req.query;

  const actors = await ActorModel.findAll({
    where: {
      id: {
        [Op.gt]: 0,
      },
      actorName: {
        [Op.like]: `%${q}%`,
      },
    },
    order: [['id', 'ASC']],
    limit: ITEMS_PER_PAGE_FOR_PAGINATION,
  });

  if (actors.length === 0) {
    throw new AppError(ERROR_MESSAGES.RESOURCES_NOT_FOUND, 404);
  }

  const totalItems = await ActorModel.count({
    where: {
      actorName: {
        [Op.like]: `%${q}%`,
      },
    },
  });

  res
    .status(200)
    .set({
      'rf-page-offset': 1,
      'rf-id-offset': actors[actors.length - 1].getDataValue('id'),
    })
    .json({
      items: actors,
      length: actors.length,
      totalItems: totalItems,
      totalPages: Math.ceil(totalItems / ITEMS_PER_PAGE_FOR_PAGINATION),
    });
};

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

export const sendActorsByName = async (req: Request, res: Response) => {
  const { name: nameQuery } = req.query;
  const name = String(nameQuery);

  const actors = await ActorModel.findAll({
    where: {
      actorName: {
        [Op.eq]: name,
      },
    },
    order: [['id', 'ASC']],
    limit: ITEMS_PER_PAGE_FOR_PAGINATION,
  });

  if (actors.length === 0) {
    throw new AppError(ERROR_MESSAGES.RESOURCES_NOT_FOUND, 404);
  }

  res.status(200).json({
    items: actors,
    length: actors.length,
  });
};

export const searchActor = async (req: Request, res: Response) => {
  if (req.query.name) {
    await sendActorsByName(req, res);
    return;
  }

  const { q, pageNumber: pageNumberText = '1' } = req.query;
  const pageNumber = Number(pageNumberText);
  if (pageNumber === 1) {
    await sendFirstPage(req, res);
    return;
  }

  const idOffset = Number(req.get('rf-id-offset') || '0');
  const lastVisitedPage = Number(req.get('rf-page-offset') || '0');
  const idOperator = pageNumber > lastVisitedPage ? Op.gt : Op.lte;
  const rowsOrderDirection = pageNumber > lastVisitedPage ? 'ASC' : 'DESC';

  // Lets consider ITEMS_PER_PAGE_FOR_PAGINATION = 5 and
  // Page 1 has 1, 2, 3, 4, 5
  // Page 2 has 6, 7, 8, 9, 10
  // Page 3 has 11, 12, 13, 14, 15
  // Page 4 has 16, 17, 18, 19, 20
  // Page 5 has 21, 22, 23, 24, 25
  // User is currently on Page 3 and jumping ahead to Page 5
  // We will get id offset as 15 and page offset as 3
  // maxItemsCount will be 10
  // When jumping forward, this is fine because we will query id > offset (which is 15)
  // and we will get 10 records after 15 which is from 16 to 25
  let maxItemsCount =
    pageNumber > 1
      ? Math.abs(pageNumber - lastVisitedPage) * ITEMS_PER_PAGE_FOR_PAGINATION
      : ITEMS_PER_PAGE_FOR_PAGINATION;
  if (pageNumber > 1 && pageNumber < lastVisitedPage) {
    // Continuing from above comments
    // User is currently on Page 5 and jumping back to Page 3
    // We will get id offset as 25 and page offset as 5
    // When jumping backward, we will query id < offset (which is 25)
    // and we need to go all the way back upto first record of Page 3 which has id 11
    // Because maxItemsCount is 10 which is set above will get us only 10 records back from id 25
    // but we need to go 5 more records back to the top of Page 3
    // Hence adding extra ITEMS_PER_PAGE_FOR_PAGINATION to maxItemsCount
    // And when going back, the query start selecting records from id 25 back upto id 11
    // because maxItemsCount is 15.
    // We are using Op.lte above that is why the selection starts from id 25.
    maxItemsCount += ITEMS_PER_PAGE_FOR_PAGINATION;
  }

  const totalItems = await ActorModel.count({
    where: {
      actorName: {
        [Op.like]: `%${q}%`,
      },
    },
  });

  const results = await ActorModel.findAll({
    where: {
      id: {
        [idOperator]: idOffset,
      },
      actorName: {
        [Op.like]: `%${q}%`,
      },
    },
    order: [['id', rowsOrderDirection]],
    limit: maxItemsCount,
  });

  if (results.length === 0) {
    throw new AppError(ERROR_MESSAGES.RESOURCES_NOT_FOUND, 404);
  }

  let actors = results.slice(results.length - ITEMS_PER_PAGE_FOR_PAGINATION);

  if (actors.length === 0) {
    throw new AppError(ERROR_MESSAGES.RESOURCES_NOT_FOUND, 404);
  }

  actors = actors.sort((a1, a2) => a1.getDataValue('id') - a2.getDataValue('id'));

  const actorsLength = actors.length;

  res
    .status(200)
    .set({
      'rf-page-offset': pageNumber,
      'rf-id-offset': actors[actorsLength - 1].getDataValue('id'),
    })
    .json({
      items: actors,
      length: actors.length,
      totalItems: totalItems,
      totalPages: Math.ceil(totalItems / ITEMS_PER_PAGE_FOR_PAGINATION),
    });
};
