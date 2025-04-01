import { Router } from 'express';
import { registerUser, login, logout, getUser, updateUser } from '../controllers';
import { routeFnWrapper } from '../utils';
import { validateAuthToken } from '../middlewares';

const router = Router();

router.post('/register', routeFnWrapper(registerUser));

router.post('/login', routeFnWrapper(login));

router.get('/logout', logout);

router.get('/me', validateAuthToken, routeFnWrapper(getUser));

router.patch('/me', validateAuthToken, routeFnWrapper(updateUser));

export default router;
