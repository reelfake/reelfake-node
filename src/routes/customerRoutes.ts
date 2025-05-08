import { Router } from 'express';
import { validateAuthToken, validateUserRole } from '../middlewares';
import { getCustomers, getCustomerById, createCustomer, deleteCustomer, updateCustomer } from '../controllers';
import { routeFnWrapper } from '../utils';
import { USER_ROLES } from '../constants';

const router = Router();

router.get('/', validateAuthToken, routeFnWrapper(getCustomers));
router.post('/', validateAuthToken, validateUserRole(USER_ROLES.STORE_MANAGER), routeFnWrapper(createCustomer));
router.get('/:id', validateAuthToken, routeFnWrapper(getCustomerById));
router.put(
  '/:id',
  validateAuthToken,
  validateUserRole(USER_ROLES.CUSTOMER, USER_ROLES.STORE_MANAGER),
  routeFnWrapper(updateCustomer)
);
router.delete(
  '/:id',
  validateAuthToken,
  validateUserRole(USER_ROLES.CUSTOMER, USER_ROLES.STORE_MANAGER),
  routeFnWrapper(deleteCustomer)
);

export default router;
