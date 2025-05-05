import { Router } from 'express';
import { registerUser, login, logout, getUser, updateUser } from '../controllers';
import { routeFnWrapper } from '../utils';
import { validateAuthToken, validateUserIsNormalUser } from '../middlewares';

const router = Router();

router.post('/register', routeFnWrapper(registerUser));

router.post('/login', routeFnWrapper(login));

router.get('/logout', logout);

router.get('/me', validateAuthToken, validateUserIsNormalUser, routeFnWrapper(getUser));

router.patch('/me', validateAuthToken, validateUserIsNormalUser, routeFnWrapper(updateUser));

export default router;
