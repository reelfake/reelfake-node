import { Router } from 'express';
import { validateAuthToken } from '../middlewares';
import { routeFnWrapper } from '../utils';
import { getStores, getStockCount, getMoviesInStore, getStaffInStore, getStoreById, addStore } from '../controllers';

const router = Router();

router.get('/', routeFnWrapper(getStores));
router.post('/', validateAuthToken, addStore);
router.get('/:id', routeFnWrapper(getStoreById));
router.get('/:id/stock', routeFnWrapper(getStockCount));
router.get('/:id/movies', routeFnWrapper(getMoviesInStore));
router.get('/:id/staff', validateAuthToken, routeFnWrapper(getStaffInStore));

export default router;
