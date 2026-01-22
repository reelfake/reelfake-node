import { Router } from 'express';
import { validateAuthToken, validateUserRole } from '../middlewares';
import { getCart, addCart, updateCartItemCount, deleteCart, moveToWishlist } from '../controllers';
import { routeFnWrapper } from '../utils';
import { USER_ROLES } from '../constants';

const router = Router();

router.get('/', validateAuthToken, validateUserRole(USER_ROLES.CUSTOMER), routeFnWrapper(getCart));
router.post(
  '/:id/move_to_wishlist',
  validateAuthToken,
  validateUserRole(USER_ROLES.CUSTOMER),
  routeFnWrapper(moveToWishlist),
);
router.post('/', validateAuthToken, validateUserRole(USER_ROLES.CUSTOMER), routeFnWrapper(addCart));
router.put('/:id', validateAuthToken, validateUserRole(USER_ROLES.CUSTOMER), routeFnWrapper(updateCartItemCount));
router.delete('/:id', validateAuthToken, validateUserRole(USER_ROLES.CUSTOMER), routeFnWrapper(deleteCart));

export default router;
