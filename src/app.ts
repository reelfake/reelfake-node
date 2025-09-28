import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import compression from 'compression';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { AppError, getOpenApiDocsHtmlString, getOpenApiReDocsHtmlString } from './utils';
import {
  statsRoutes,
  addressRoutes,
  userRoutes,
  genreRoutes,
  cityRoutes,
  countryRoutes,
  movieLanguageRoutes,
  movieRoutes,
  actorRoutes,
  storeRoutes,
  staffRoutes,
  customerRoutes,
  authRoutes,
  rentalRoutes,
} from './routes';

// app.use(helmet());
// app.use(morgan('tiny', { stream: logStream }));
// app.use(bodyParser.json());

const app = express();

app.use(express.json());

if (process.env.NODE_ENV === 'production') {
  app.use(
    cors({
      origin: 'http://localhost:3000',
      credentials: true,
    })
  );
}

app.use(cookieParser());
app.use(compression());

app.get('/', (req: Request, res: Response) => {
  res.status(200).send('Welcome to Reelfake API...');
});

app.get('/api', (req: Request, res: Response) => {
  res.status(200).json({
    name: 'reelfake-api',
    version: '1.0.0',
  });
});

// OpenAPI routes
app.get('/openapi/v1', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'openapi', 'dist', 'openapi.yaml'));
});

app.get('/api/docs', (req, res) => {
  if (req.protocol === 'https') {
    res.render(getOpenApiDocsHtmlString(true));
  } else {
    res.send(getOpenApiDocsHtmlString(false));
  }
});

app.get('/api/redocs', (req, res) => {
  if (req.protocol === 'https') {
    res.render(getOpenApiReDocsHtmlString(true));
  } else {
    res.send(getOpenApiReDocsHtmlString(false));
  }
});

// Statistics
app.use('/api/stats', statsRoutes);

// Login and logout
app.use('/api/auth', authRoutes);

// Register user and get/update user
app.use('/api/user', userRoutes);

// Addresses
app.use('/api/addresses', addressRoutes);

// Genres
app.use('/api/genres', genreRoutes);

// Countries
app.use('/api/countries', countryRoutes);

// Movie languages
app.use('/api/movie_languages', movieLanguageRoutes);

// Cities
app.use('/api/cities', cityRoutes);

// Movies
app.use('/api/movies', movieRoutes);

// Actors
app.use('/api/actors', actorRoutes);

// Stores
app.use('/api/stores', storeRoutes);

// Staff
app.use('/api/staff', staffRoutes);

// Customers
app.use('/api/customers', customerRoutes);

// Rentals
app.use('/api/rentals', rentalRoutes);

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
