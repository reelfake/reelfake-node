import { Router } from 'express';
import { getCountries } from '../controllers';

const router = Router();

router.get('/', getCountries);

export default router;
