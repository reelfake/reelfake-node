import { Response, NextFunction } from 'express';
import { Router } from 'express';
import { getAddresses, getAddressesInCity, getAddressesInState } from '../controllers';
import { ERROR_MESSAGES } from '../constants';
import { routeFnWrapper, AppError } from '../utils';
import { CustomRequest } from '../types';

const router = Router();

function validateAddressesRouteQuery(req: CustomRequest, res: Response, next: NextFunction) {
  const { page: pageNumberText = '1' } = req.query;

  if (pageNumberText !== 'first' && pageNumberText !== 'last' && (isNaN(Number(pageNumberText)) || Number(pageNumberText) < 1)) {
    // Validate page query
    return next(new AppError(ERROR_MESSAGES.INVALID_PAGE_NUMBER, 400));
  }

  if (pageNumberText === 'first') {
    req.query.page = '1';
  }

  if (pageNumberText === 'last') {
    req.query.page = '-1';
  }

  next();
}

router.get('/', validateAddressesRouteQuery, routeFnWrapper(getAddresses));
router.get('/city/:city', routeFnWrapper(getAddressesInCity));
router.get('/state/:state', routeFnWrapper(getAddressesInState));

export default router;
