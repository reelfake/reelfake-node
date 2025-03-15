import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { routeFnWrapper, AppError } from '../utils';
import { getActors } from '../controllers';

const router = Router();

function validateActorsRouteQuery(req: Request, res: Response, next: NextFunction) {
  const { pageNumber: pageNumberText = '1' } = req.query;

  if (isNaN(Number(pageNumberText)) || Number(pageNumberText) < 1) {
    throw new AppError('Page number should be a valid non-zero positive number', 400);
  }

  next();
}

router.get('/', validateActorsRouteQuery, routeFnWrapper(getActors));

export default router;
