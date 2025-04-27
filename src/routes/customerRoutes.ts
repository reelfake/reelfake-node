import { Router } from 'express';
import { validateAuthToken } from '../middlewares';
import { getCustomers, getCustomerById, createCustomer, deleteCustomer, updateCustomer } from '../controllers';
import { routeFnWrapper } from '../utils';

const router = Router();

router.get('/', validateAuthToken, routeFnWrapper(getCustomers));
router.post('/', validateAuthToken, routeFnWrapper(createCustomer));
router.get('/:id', validateAuthToken, routeFnWrapper(getCustomerById));
router.put('/:id', validateAuthToken, routeFnWrapper(updateCustomer));
router.delete('/:id', validateAuthToken, routeFnWrapper(deleteCustomer));

export default router;
