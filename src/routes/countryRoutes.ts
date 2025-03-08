import { Router } from 'express';
import { getCountries } from '../controllers';
import { routeFnWrapper } from '../utils';

const router = Router();

router.get('/', routeFnWrapper(getCountries));

export default router;
