import { Request, Response, Router, NextFunction } from 'express';
import { validateAuthToken, validateUserRole } from '../middlewares';
import {
  getCustomers,
  getCustomerById,
  deleteCustomer,
  updateCustomer,
  resetCustomerPassword,
  registerCustomer,
  deactivateCustomer,
  activateCustomer,
} from '../controllers';
import { routeFnWrapper, AppError, validateDateRangeInRequest } from '../utils';
import { USER_ROLES, CUSTOMER_EMAIL_FORMAT, ERROR_MESSAGES } from '../constants';

const router = Router();

function validateCustomersRouteQuery(req: Request, res: Response, next: NextFunction) {
  const { page: pageNumberText = '1', active, registered_on: registeredOn, email } = req.query;

  if (email !== undefined) {
    req.query.email = email.toString().toLowerCase();
  }

  if (active !== undefined) {
    req.query.active = active.toString().toLowerCase();
  }

  // Validate page number
  if (pageNumberText !== 'first' && pageNumberText !== 'last' && (isNaN(Number(pageNumberText)) || Number(pageNumberText) < 1)) {
    throw new AppError(ERROR_MESSAGES.INVALID_PAGE_NUMBER, 400);
  }

  if (pageNumberText === 'first') {
    req.query.page = '1';
  }

  if (pageNumberText === 'last') {
    req.query.page = '-1';
  }

  // Validate email
  if (
    email &&
    !email.toString().startsWith('%') &&
    !email.toString().endsWith('%') &&
    !CUSTOMER_EMAIL_FORMAT.test(email.toString())
  ) {
    return next(new AppError(ERROR_MESSAGES.INVALID_CUSTOMER_EMAIL_FORMAT, 400));
  }

  // Validate active
  if ((active && active === 'true') || active === 'false') {
    return next(new AppError('Customer active flag must be boolean (true or false)', 400));
  }

  const registeredOnDateRange = registeredOn ? registeredOn.toString().split(',') : [];
  try {
    validateDateRangeInRequest(
      registeredOnDateRange,
      () => {
        throw new AppError(ERROR_MESSAGES.INVALID_REGISTERED_ON, 400);
      },
      () => {
        throw new AppError(ERROR_MESSAGES.REGISTERED_ON_FORMAT, 400);
      }
    );
  } catch (err) {
    return next(err);
  }

  next();
}

// GET
router.get('/', validateCustomersRouteQuery, validateAuthToken, routeFnWrapper(getCustomers));
router.get('/:id', validateAuthToken, routeFnWrapper(getCustomerById));
// POST
router.post('/register', routeFnWrapper(registerCustomer));
// PUT
router.put(
  '/:id',
  validateAuthToken,
  validateUserRole(USER_ROLES.CUSTOMER, USER_ROLES.STORE_MANAGER),
  routeFnWrapper(updateCustomer)
);
router.put('/reset_password', validateAuthToken, validateUserRole(USER_ROLES.CUSTOMER), routeFnWrapper(resetCustomerPassword));
// PATCH - Deactivate customer
router.patch(
  '/:id/deactivate',
  validateAuthToken,
  validateUserRole(USER_ROLES.STORE_MANAGER),
  routeFnWrapper(deactivateCustomer)
);
// PATCH - Activate customer
router.patch('/:id/activate', validateAuthToken, validateUserRole(USER_ROLES.STORE_MANAGER), routeFnWrapper(activateCustomer));
// DELETE
router.delete(
  '/:id',
  validateAuthToken,
  validateUserRole(USER_ROLES.CUSTOMER, USER_ROLES.STORE_MANAGER),
  routeFnWrapper(deleteCustomer)
);

export default router;
