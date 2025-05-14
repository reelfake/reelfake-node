import { Router } from 'express';
import {
  getStaff,
  getStaffById,
  createStaff,
  getStoreManagers,
  updateStaff,
  deleteStaff,
  setStaffPassword,
} from '../controllers';
import { validateAuthToken, validateUserRole } from '../middlewares';
import { routeFnWrapper } from '../utils';
import { USER_ROLES } from '../constants';

const router = Router();

router.get(
  '/',
  validateAuthToken,
  validateUserRole(USER_ROLES.STAFF, USER_ROLES.STORE_MANAGER),
  routeFnWrapper(getStaff)
);
router.post('/', validateAuthToken, validateUserRole(USER_ROLES.STORE_MANAGER), routeFnWrapper(createStaff));
router.get(
  '/:id',
  validateAuthToken,
  validateUserRole(USER_ROLES.STAFF, USER_ROLES.STORE_MANAGER),
  routeFnWrapper(getStaffById)
);
router.put('/:id', validateAuthToken, validateUserRole(USER_ROLES.STORE_MANAGER), routeFnWrapper(updateStaff));
router.put('/:id/set_password', validateAuthToken, validateUserRole(USER_ROLES.USER), routeFnWrapper(setStaffPassword));
router.delete('/:id', validateAuthToken, validateUserRole(USER_ROLES.STORE_MANAGER), routeFnWrapper(deleteStaff));
router.get(
  '/managers',
  validateAuthToken,
  validateUserRole(USER_ROLES.STAFF, USER_ROLES.STORE_MANAGER),
  routeFnWrapper(getStoreManagers)
);

export default router;
