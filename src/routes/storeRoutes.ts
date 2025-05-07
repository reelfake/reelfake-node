import { Router } from 'express';
import { validateAuthToken, validateUserRole } from '../middlewares';
import { routeFnWrapper } from '../utils';
import {
  getStores,
  getStockCount,
  getMoviesInStore,
  getStaffInStore,
  getStoreById,
  createStore,
  updateStore,
  deleteStore,
} from '../controllers';
import { USER_ROLES } from '../constants';

const router = Router();

router.get('/', routeFnWrapper(getStores));
router.get('/:id', routeFnWrapper(getStoreById));
router.get('/:id/stock', routeFnWrapper(getStockCount));
router.get('/:id/movies', routeFnWrapper(getMoviesInStore));
router.get(
  '/:id/staff',
  validateAuthToken,
  validateUserRole(USER_ROLES.STAFF, USER_ROLES.STORE_MANAGER),
  routeFnWrapper(getStaffInStore)
);
router.post('/', validateAuthToken, validateUserRole(USER_ROLES.STORE_MANAGER), routeFnWrapper(createStore));
router.put('/:id', validateAuthToken, validateUserRole(USER_ROLES.STORE_MANAGER), routeFnWrapper(updateStore));
router.delete('/:id', validateAuthToken, validateUserRole(USER_ROLES.STORE_MANAGER), routeFnWrapper(deleteStore));

export default router;
