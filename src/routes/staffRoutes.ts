import { Router } from 'express';
import { getStaff, getStaffById, createStaff, getStoreManagers, updateStaff, deleteStaff } from '../controllers';
import { validateAuthToken } from '../middlewares';
import { routeFnWrapper } from '../utils';

const router = Router();

router.get('/', validateAuthToken, routeFnWrapper(getStaff));
router.post('/', validateAuthToken, routeFnWrapper(createStaff));
router.get('/:id', validateAuthToken, routeFnWrapper(getStaffById));
router.put('/:id', validateAuthToken, routeFnWrapper(updateStaff));
router.delete('/:id', validateAuthToken, routeFnWrapper(deleteStaff));
router.get('/managers', validateAuthToken, routeFnWrapper(getStoreManagers));

export default router;
