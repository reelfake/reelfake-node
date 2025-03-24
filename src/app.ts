import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { AppError } from './utils';
import {
  apiKeyRoutes,
  genreRoutes,
  cityRoutes,
  countryRoutes,
  movieLanguageRoutes,
  movieRoutes,
  actorRoutes,
  storeRoutes,
} from './routes';
import { validateApiKey } from './middlewares';

// app.use(cors());
// app.use(helmet());
// app.use(compression());
// app.use(morgan('tiny', { stream: logStream }));
// app.use(bodyParser.json());

const app = express();

app.use(express.json());
app.use(cors({ credentials: true }));
app.use(cookieParser());
app.use(validateApiKey);

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

app.use('/api/v1/api_key', apiKeyRoutes);

// /api/genres
app.use('/api/v1/genres', genreRoutes);

// /api/countries
app.use('/api/v1/countries', countryRoutes);

// /api/movie_languages
app.use('/api/v1/movie_languages', movieLanguageRoutes);

// /api/cities
app.use('/api/v1/cities', cityRoutes);

// /api/movies
app.use('/api/v1/movies', movieRoutes);

app.use('/api/v1/actors', actorRoutes);

app.use('/api/v1/stores', storeRoutes);

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
