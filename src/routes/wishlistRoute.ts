import { Router } from 'express';
import { validateAuthToken, validateUserRole } from '../middlewares';
import { getWishlist, addWishlist, deleteWishlist, moveToCart } from '../controllers';
import { routeFnWrapper } from '../utils';
import { USER_ROLES } from '../constants';

const router = Router();

router.get('/', validateAuthToken, validateUserRole(USER_ROLES.CUSTOMER), routeFnWrapper(getWishlist));
router.post('/:id/move_to_cart', validateAuthToken, validateUserRole(USER_ROLES.CUSTOMER), routeFnWrapper(moveToCart));
router.post('/', validateAuthToken, validateUserRole(USER_ROLES.CUSTOMER), routeFnWrapper(addWishlist));
router.delete('/:id', validateAuthToken, validateUserRole(USER_ROLES.CUSTOMER), routeFnWrapper(deleteWishlist));

export default router;
