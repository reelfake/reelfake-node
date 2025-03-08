import { Router } from 'express';
import { getGenres } from '../controllers';
import { routeFnWrapper } from '../utils';

const router = Router();

router.get('/', routeFnWrapper(getGenres));

export default router;
