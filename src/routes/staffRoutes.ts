import { Router } from 'express';
import { getStaff, getStaffByState } from '../controllers';
import { validateAuthToken } from '../middlewares';
import { routeFnWrapper } from '../utils';

const router = Router();

router.get('/', validateAuthToken, routeFnWrapper(getStaff));
router.get('/:state', validateAuthToken, routeFnWrapper(getStaffByState));

export default router;
