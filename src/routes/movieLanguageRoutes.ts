import { Router } from 'express';
import { getMovieLanguages } from '../controllers';

const router = Router();

router.get('/', getMovieLanguages);

export default router;
