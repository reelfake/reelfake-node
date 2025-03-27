import { Router } from 'express';
import { registerUser, login, logout } from '../controllers';
import { routeFnWrapper } from '../utils';

const router = Router();

router.post('/register', routeFnWrapper(registerUser));

router.post('/login', routeFnWrapper(login));

router.get('/logout', logout);

export default router;
