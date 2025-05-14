import { Router } from 'express';
import { validateAuthToken, validateUserRole } from '../middlewares';
import { getRentals } from '../controllers';
import { USER_ROLES } from '../constants';
import { routeFnWrapper } from '../utils';

const router = Router();

router.get(
  '/',
  validateAuthToken,
  validateUserRole(USER_ROLES.STAFF, USER_ROLES.STORE_MANAGER, USER_ROLES.CUSTOMER),
  routeFnWrapper(getRentals)
);

export default router;
