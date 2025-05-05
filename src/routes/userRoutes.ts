import { Router } from 'express';
import { registerUser, login, logout, getUser, updateUser } from '../controllers';
import { routeFnWrapper } from '../utils';
import { validateAuthToken, validateUserRole } from '../middlewares';
import { USER_ROLES } from '../constants';

const router = Router();

router.post('/register', routeFnWrapper(registerUser));
router.post('/login', routeFnWrapper(login));
router.get('/logout', logout);
router.get('/me', validateAuthToken, validateUserRole(USER_ROLES.USER), routeFnWrapper(getUser));
router.patch('/me', validateAuthToken, validateUserRole(USER_ROLES.USER), routeFnWrapper(updateUser));

export default router;
