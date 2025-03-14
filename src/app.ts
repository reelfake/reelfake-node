import express from 'express';
import path from 'path';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from './utils';
import { genreRoutes, cityRoutes, countryRoutes, movieLanguageRoutes, movieRoutes } from './routes';
import { ERROR_MESSAGES } from './constants';

// app.use(cors());
// app.use(helmet());
// app.use(compression());
// app.use(morgan('tiny', { stream: logStream }));
// app.use(bodyParser.json());

const app = express();

app.use((req: Request, res: Response, next: NextFunction) => {
  const skipAuth = new RegExp('/api/v1/(re)?docs/').test(req.path) || req.path === '/openapi/v1';
  if (
    !skipAuth &&
    (req.headers['api-key'] === undefined || req.headers['api-key'] !== process.env.API_KEY)
  ) {
    return next(new AppError(ERROR_MESSAGES.INVALID_MISSING_API_KEY, 401));
  }

  next();
});

app.get('/api/v1', (req: Request, res: Response) => {
  res.status(200).json({
    name: 'reelfake-api',
    version: '1.0.0',
  });
});

// OpenAPI routes
app.get('/openapi/v1', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'openapi', 'dist', 'openapi.yaml'));
});

app.get('/api/v1/docs', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'openapi', 'docs.html'));
});

app.get('/api/v1/redocs', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'openapi', 'redocs.html'));
});

// /api/genres
app.use('/api/v1/genres', genreRoutes);

// /api/countries
app.use('/api/v1/countries', countryRoutes);

// /api/movie_languages
app.use('/api/v1/movie_languages', movieLanguageRoutes);

// /api/cities
app.use('/api/v1/cities', cityRoutes);

// /api/movies?page_number=page_number&limit_per_page=limit
app.use('/api/v1/movies', movieRoutes);

// /api/movies/:id
// Returns complete information about the movie

// /api/movies/:id?genres=genres_separated_by_comma&include_actors=flag
// Returns complete data about movie with the ability to
// filter by genres, whether or not to include actors

// /api/actors?include_movies={true or false or yes or no or 0 or 1}
// Each actor data will have movie id, title, genres and release dates

app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    message: `Route ${req.originalUrl} does not exist`,
  });
});

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof AppError) {
    const appError = error as AppError;
    appError.status = appError.status || 'failed';
    appError.statusCode = appError.statusCode || 500;
    res.status(appError.statusCode).json({
      status: appError.status,
      message: error.message,
      stack: process.env.NODE_ENV === 'dev' ? error.stack : undefined,
    });
  } else {
    res.status(500).json({
      status: 'error',
      message: error.message,
      stack: process.env.NODE_ENV === 'dev' ? error.stack : undefined,
    });
  }
});

export default app;
