import { Router } from 'express';
import { routeFnWrapper } from '../utils';
import { getMovies } from '../controllers';

const router = Router();

router.get('/', routeFnWrapper(getMovies));

export default router;
