import { Router } from 'express';
import { login, logout, getUserProfile } from '../controllers';
import { routeFnWrapper } from '../utils';
import { validateAuthToken } from '../middlewares';

const router = Router();

router.post('/login', routeFnWrapper(login));
router.get('/logout', validateAuthToken, logout);
router.get('/me', validateAuthToken, routeFnWrapper(getUserProfile));

export default router;
