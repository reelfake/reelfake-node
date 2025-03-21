import { Router } from 'express';
import { routeFnWrapper } from '../utils';
import { getStores, getStockCount, getMoviesInStore } from '../controllers';

const router = Router();

router.get('/', routeFnWrapper(getStores));
router.get('/:id/stock', routeFnWrapper(getStockCount));
router.get('/:id/movies', routeFnWrapper(getMoviesInStore));

export default router;
