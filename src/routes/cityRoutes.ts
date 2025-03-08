import { Router } from 'express';
import { getCities, getCitiesByCountry } from '../controllers';
import { routeFnWrapper } from '../utils';

const router = Router();

router.get('/', routeFnWrapper(getCities));
router.get('/:country_code', routeFnWrapper(getCitiesByCountry));

export default router;
