import { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import multer from 'multer';
import { routeFnWrapper, AppError } from '../utils';
import {
  findInStores,
  getMovieById,
  getMovies,
  createMovie,
  addActors,
  updateMovie,
  deleteMovie,
  uploadMovies,
  trackUpload,
  validateUpload,
} from '../controllers';
import { validateMoviesRouteQuery, validateAuthToken, validateUserRole } from '../middlewares';
import { USER_ROLES } from '../constants';

const router = Router();

function validateMovieByIdRouteQuery(req: Request, res: Response, next: NextFunction) {
  const { id: idText } = req.params;
  const { include_actors: includeActors } = req.query;

  const includeActorsText = includeActors ? String(includeActors).trim().toLowerCase() : '';

  const id = Number(idText);

  if (isNaN(id) || id <= 0) {
    throw new AppError('Invalid movie id. Movie id must be a non-zero positive number.', 400);
  }

  const includeActorsTruthies = ['true', 'yes', '1'];
  const includeActorsFalsies = ['false', 'no', '0'];

  if (includeActorsText && ![...includeActorsTruthies, ...includeActorsFalsies].includes(includeActorsText)) {
    throw new AppError('Invalid value for includeActors in query. Please refer to api specs for more information.', 400);
  }

  req.query.includeActors = String(includeActorsTruthies.includes(includeActorsText));

  next();
}

const upload = multer({ dest: '/Users/pratap.reddy/repos/reelfake-node/movie_uploads' });

// GET
router.get('/', validateMoviesRouteQuery, routeFnWrapper(getMovies));
router.get('/upload/track', trackUpload);
router.post(
  '/upload/validate',
  validateAuthToken,
  validateUserRole(USER_ROLES.STORE_MANAGER),
  upload.single('file'),
  validateUpload
);
router.post('/upload', upload.single('file'), uploadMovies);
router.get('/:id', validateMovieByIdRouteQuery, routeFnWrapper(getMovieById));
router.get('/:id/stores', routeFnWrapper(findInStores));
// POST
router.post('/', validateAuthToken, validateUserRole(USER_ROLES.STORE_MANAGER), routeFnWrapper(createMovie));
router.post('/:id/add_actors', validateAuthToken, validateUserRole(USER_ROLES.STORE_MANAGER), routeFnWrapper(addActors));
// PUT
router.put('/:id', validateAuthToken, validateUserRole(USER_ROLES.STORE_MANAGER), routeFnWrapper(updateMovie));
// DELETE
router.delete('/:id', validateAuthToken, validateUserRole(USER_ROLES.STORE_MANAGER), routeFnWrapper(deleteMovie));

export default router;
