import { Request, Response, NextFunction, Router } from 'express';
import {
  getStaff,
  getStaffById,
  createStaff,
  getStoreManagers,
  updateStaff,
  deleteStaff,
  changeStaffPassword,
  forgotStaffPassword,
} from '../controllers';
import { validateAuthToken, validateUserRole, validateNewPassword } from '../middlewares';
import { AppError, routeFnWrapper } from '../utils';
import { STAFF_EMAIL_FORMAT, ERROR_MESSAGES, USER_ROLES } from '../constants';

const router = Router();

function validateStaffRouteQuery(req: Request, res: Response, next: NextFunction) {
  const { page: pageNumberText = '1', active, email } = req.query;

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
    !STAFF_EMAIL_FORMAT.test(email.toString())
  ) {
    return next(new AppError(ERROR_MESSAGES.INVALID_STAFF_EMAIL_FORMAT, 400));
  }

  // Validate active
  if ((active && active === 'true') || active === 'false') {
    return next(new AppError('Active flag must be boolean (true or false)', 400));
  }

  next();
}

router.get('/', validateStaffRouteQuery, validateAuthToken, routeFnWrapper(getStaff));
router.post('/', validateAuthToken, validateUserRole(USER_ROLES.STORE_MANAGER), routeFnWrapper(createStaff));
router.get(
  '/managers',
  validateAuthToken,
  validateUserRole(USER_ROLES.STAFF, USER_ROLES.STORE_MANAGER),
  routeFnWrapper(getStoreManagers)
);
router.get('/:id', validateAuthToken, validateUserRole(USER_ROLES.STAFF, USER_ROLES.STORE_MANAGER), routeFnWrapper(getStaffById));

router.put('/:id/forgot_password', validateNewPassword, routeFnWrapper(forgotStaffPassword));
router.put(
  '/change_password',
  validateAuthToken,
  validateUserRole(USER_ROLES.STAFF),
  validateNewPassword,
  routeFnWrapper(changeStaffPassword)
);

router.put('/:id', validateAuthToken, validateUserRole(USER_ROLES.STORE_MANAGER), routeFnWrapper(updateStaff));
router.delete('/:id', validateAuthToken, validateUserRole(USER_ROLES.STORE_MANAGER), routeFnWrapper(deleteStaff));

export default router;
