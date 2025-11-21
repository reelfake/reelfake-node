import { Router } from 'express';
import { getStatistics, getMostRentedMovies, getSalesByCity, getSalesByStore, getSalesByMonth } from '../controllers';
import { validateUserRole, validateAuthToken } from '../middlewares';
import { routeFnWrapper } from '../utils';
import { USER_ROLES } from '../constants';

const router = Router();

router.get('/', routeFnWrapper(getStatistics));
router.get(
  '/most_rented_movies',
  validateAuthToken,
  validateUserRole(USER_ROLES.STAFF, USER_ROLES.STORE_MANAGER),
  routeFnWrapper(getMostRentedMovies)
);
router.get(
  '/sales_by_store',
  validateAuthToken,
  validateUserRole(USER_ROLES.STAFF, USER_ROLES.STORE_MANAGER),
  routeFnWrapper(getSalesByStore)
);
router.get(
  '/sales_by_month',
  validateAuthToken,
  validateUserRole(USER_ROLES.STAFF, USER_ROLES.STORE_MANAGER),
  routeFnWrapper(getSalesByMonth)
);
router.get(
  '/sales_by_city',
  validateAuthToken,
  validateUserRole(USER_ROLES.STAFF, USER_ROLES.STORE_MANAGER),
  routeFnWrapper(getSalesByCity)
);

export default router;
