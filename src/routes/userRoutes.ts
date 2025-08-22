import { Router } from 'express';
import { registerUser, getUser, updateUser, changePassword } from '../controllers';
import { routeFnWrapper } from '../utils';
import { validateAuthToken, validateUserRole } from '../middlewares';
import { USER_ROLES } from '../constants';

const router = Router();

router.post('/register', routeFnWrapper(registerUser));
router.get('/me', validateAuthToken, routeFnWrapper(getUser));
router.patch('/me', validateAuthToken, validateUserRole(USER_ROLES.USER), routeFnWrapper(updateUser));
router.patch('/me/change-password', validateAuthToken, validateUserRole(USER_ROLES.USER), routeFnWrapper(changePassword));

export default router;
