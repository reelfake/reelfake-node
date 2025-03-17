import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { routeFnWrapper, AppError } from '../utils';
import { getActors, searchActor } from '../controllers';
import { ERROR_MESSAGES } from '../constants';

const router = Router();

function validateActorsRouteQuery(req: Request, res: Response, next: NextFunction) {
  const { pageNumber: pageNumberText = '1' } = req.query;

  if (isNaN(Number(pageNumberText)) || Number(pageNumberText) < 1) {
    throw new AppError('Page number should be a valid non-zero positive number', 400);
  }

  next();
}

function validateSearchRouteQuery(req: Request, res: Response, next: NextFunction) {
  const { name, q } = req.query;

  if (!name && !q) {
    throw new AppError('Request is missing the search parameter', 400);
  }

  if (name && q) {
    throw new AppError('Request cannot have search by name and query together', 400);
  }

  next();
}

router.get('/', validateActorsRouteQuery, routeFnWrapper(getActors));
router.get('/search', validateSearchRouteQuery, routeFnWrapper(searchActor));

export default router;
