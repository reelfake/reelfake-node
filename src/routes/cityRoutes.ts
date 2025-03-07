import { Router } from 'express';
import { getCities } from '../controllers';

const router = Router();

router.get('/', getCities);

export default router;
