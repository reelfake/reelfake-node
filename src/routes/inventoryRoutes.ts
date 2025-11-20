import { Request, Response, Router, NextFunction } from 'express';
import { validateAuthToken, validateUserRole } from '../middlewares';
import { routeFnWrapper } from '../utils';
import { addInventory, updateInventory, deleteInventory } from '../controllers';
import { USER_ROLES } from '../constants';

const router = Router();

router.post('/', validateAuthToken, validateUserRole(USER_ROLES.STAFF, USER_ROLES.STORE_MANAGER), routeFnWrapper(addInventory));
router.put(
  '/:id',
  validateAuthToken,
  validateUserRole(USER_ROLES.STAFF, USER_ROLES.STORE_MANAGER),
  routeFnWrapper(updateInventory)
);
router.delete(
  '/:id',
  validateAuthToken,
  validateUserRole(USER_ROLES.STAFF, USER_ROLES.STORE_MANAGER),
  routeFnWrapper(deleteInventory)
);

export default router;
