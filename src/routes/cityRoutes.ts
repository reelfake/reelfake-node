import { Router } from 'express';
import { getCities, getCitiesByCountry } from '../controllers';

const router = Router();

router.get('/', getCities);
router.get('/:country_code', getCitiesByCountry);

export default router;
