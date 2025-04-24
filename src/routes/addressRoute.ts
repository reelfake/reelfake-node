import { Router } from 'express';
import { getAddresses, getAddressesInCity, getAddressesInState } from '../controllers';
import { routeFnWrapper } from '../utils';

const router = Router();

router.get('/', routeFnWrapper(getAddresses));
router.get('/city/:city', routeFnWrapper(getAddressesInCity));
router.get('/state/:state', routeFnWrapper(getAddressesInState));

export default router;
