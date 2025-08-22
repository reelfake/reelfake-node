import { Router } from 'express';
import { getStatistics } from '../controllers';

const router = Router();

router.get('/', getStatistics);

export default router;
