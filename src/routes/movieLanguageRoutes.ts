import { Router } from 'express';
import { getMovieLanguages } from '../controllers';
import { routeFnWrapper } from '../utils';

const router = Router();

router.get('/', routeFnWrapper(getMovieLanguages));

export default router;
