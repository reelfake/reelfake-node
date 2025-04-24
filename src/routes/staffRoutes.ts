import { Router } from 'express';
import { getStaff, createStaff, getStaffByState, getStoreManagers, updateStaff, deleteStaff } from '../controllers';
import { validateAuthToken } from '../middlewares';
import { routeFnWrapper } from '../utils';

const router = Router();

router.get('/', validateAuthToken, routeFnWrapper(getStaff));
router.post('/', validateAuthToken, routeFnWrapper(createStaff));
router.put('/:id', validateAuthToken, routeFnWrapper(updateStaff));
router.delete('/:id', validateAuthToken, routeFnWrapper(deleteStaff));
router.get('/managers', validateAuthToken, routeFnWrapper(getStoreManagers));
router.get('/:state', validateAuthToken, routeFnWrapper(getStaffByState));

export default router;
