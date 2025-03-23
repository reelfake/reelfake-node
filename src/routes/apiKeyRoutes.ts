import { type Request, type Response, type NextFunction, Router } from 'express';
import { generateApiKey } from '../controllers';
import { routeFnWrapper } from '../utils';

const router = Router();

router.post('/', routeFnWrapper(generateApiKey));

export default router;
