import { Router } from 'express';
import { validateAuthToken, validateUserRole } from '../middlewares';
import { getRentals, getRentalById, getRentalsForStore } from '../controllers';
import { USER_ROLES } from '../constants';
import { routeFnWrapper } from '../utils';

const router = Router();

router.get(
  '/',
  validateAuthToken,
  validateUserRole(USER_ROLES.STAFF, USER_ROLES.STORE_MANAGER, USER_ROLES.CUSTOMER),
  routeFnWrapper(getRentals)
);
router.get(
  '/my_store',
  validateAuthToken,
  validateUserRole(USER_ROLES.CUSTOMER, USER_ROLES.STAFF, USER_ROLES.STORE_MANAGER),
  routeFnWrapper(getRentalsForStore)
);
router.get(
  '/:id',
  validateAuthToken,
  validateUserRole(USER_ROLES.STAFF, USER_ROLES.STORE_MANAGER, USER_ROLES.CUSTOMER),
  routeFnWrapper(getRentalById)
);

export default router;
