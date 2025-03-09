import { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { routeFnWrapper, AppError } from '../utils';
import { getMovies } from '../controllers';
import { PAGINATION_HEADERS } from '../constants';

const router = Router();

function validatePaginationRequest(req: Request, res: Response, next: NextFunction) {
  const { page_number } = req.query;

  if (!req.query.page_number) {
    throw new AppError('Page number is required in the request', 400);
  }

  const pageNumber = Number(page_number);

  if (isNaN(pageNumber) || pageNumber < 1) {
    throw new AppError('Page number must be a valid non-zero number', 400);
  }

  const lastSeenPageNumber = req.get(PAGINATION_HEADERS.LAST_SEEN_PAGE_NUMBER);
  const lastIdOfLastSeenPage = req.get(PAGINATION_HEADERS.LAST_SEEN_PAGE_LAST_ID);

  if (pageNumber > 1 && (!lastSeenPageNumber || !lastIdOfLastSeenPage)) {
    throw new AppError(
      'Last seen page number with last id are required when current page number is more than 1',
      400
    );
  }

  if (pageNumber > 1 && isNaN(Number(lastSeenPageNumber))) {
    throw new AppError('Last seen page number must be a non-zero positive number', 400);
  }

  if (pageNumber > 1 && pageNumber <= Number(lastSeenPageNumber)) {
    throw new AppError('Page number cannot be less than or equal to last seen page number', 400);
  }

  next();
}

router.use(validatePaginationRequest);

router.get('/', routeFnWrapper(getMovies));

export default router;
