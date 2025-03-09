import { Router } from 'express';
import { getCities } from '../controllers';
import { routeFnWrapper } from '../utils';

const router = Router();

router.get('/', routeFnWrapper(getCities));

export default router;
