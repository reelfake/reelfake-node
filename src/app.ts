import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import compression from 'compression';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { AppError } from './utils';
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

// Statistics
app.use('/api/v1/stats', statsRoutes);

// Login and logout
app.use('/api/v1/auth', authRoutes);

// Register user and get/update user
app.use('/api/v1/user', userRoutes);

// Addresses
app.use('/api/v1/addresses', addressRoutes);

// Genres
app.use('/api/v1/genres', genreRoutes);

// Countries
app.use('/api/v1/countries', countryRoutes);

// Movie languages
app.use('/api/v1/movie_languages', movieLanguageRoutes);

// Cities
app.use('/api/v1/cities', cityRoutes);

// Movies
app.use('/api/v1/movies', movieRoutes);

// Actors
app.use('/api/v1/actors', actorRoutes);

// Stores
app.use('/api/v1/stores', storeRoutes);

// Staff
app.use('/api/v1/staff', staffRoutes);

// Customers
app.use('/api/v1/customers', customerRoutes);

// Rentals
app.use('/api/v1/rentals', rentalRoutes);

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
