import { Router } from 'express';
import { getGenres } from '../controllers';

const router = Router();

router.get('/', getGenres);

export default router;
