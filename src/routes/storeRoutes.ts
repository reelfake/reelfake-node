import { Router } from 'express';
import { validateAuthToken } from '../middlewares';
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

const router = Router();

router.get('/', routeFnWrapper(getStores));
router.get('/:id', routeFnWrapper(getStoreById));
router.get('/:id/stock', routeFnWrapper(getStockCount));
router.get('/:id/movies', routeFnWrapper(getMoviesInStore));
router.get('/:id/staff', validateAuthToken, routeFnWrapper(getStaffInStore));
router.post('/', validateAuthToken, routeFnWrapper(createStore));
router.put('/:id', validateAuthToken, routeFnWrapper(updateStore));
router.delete('/:id', validateAuthToken, routeFnWrapper(deleteStore));

export default router;
