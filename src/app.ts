import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import { URL } from 'url';
import compression from 'compression';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { allowOnlyMe } from './middlewares';
import { AppError, getOpenApiDocsHtmlString, getOpenApiReDocsHtmlString, getOpenApiUril, testDbConnection } from './utils';
import {
  statsRoutes,
  addressRoutes,
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
  inventoryRoutes,
} from './routes';
import sequelize from './sequelize.config';

// app.use(helmet());
// app.use(morgan('tiny', { stream: logStream }));

const app = express();

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      const url = new URL(origin);
      const { protocol, hostname, port } = url;

      if (!['http:', 'https:'].includes(protocol)) {
        callback(new Error(`Unknown protocol - ${protocol}`));
        return;
      }

      if (['localhost', '127.0.0.1'].includes(hostname)) {
        callback(null, true);
        return;
      }
    },
    credentials: true,
  })
);
app.use(express.json());

app.use(cookieParser());
app.use((req, res, next) => {
  if (req.path.endsWith('/movies/upload/track') || req.path.endsWith('/movies/upload/validate')) {
    return next();
  }
  compression()(req, res, next);
});

app.use(allowOnlyMe);

app.get('/', (req: Request, res: Response) => {
  res.status(200).send('Welcome to Reelfake API...');
});

app.get('/api', (req: Request, res: Response) => {
  res.status(200).json({
    name: 'reelfake-api',
    version: '1.0.0',
    ...(process.env['BUILD_AT'] && { BUILD_AT: process.env['BUILD_AT'] }),
  });
});

// OpenAPI routes
app.get('/openapi', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'openapi', 'dist', 'openapi.yaml'));
});

app.get('/api/docs', (req, res) => {
  const docsUrl = getOpenApiUril(req.hostname);
  res.send(getOpenApiDocsHtmlString(docsUrl));
});

app.get('/api/redocs', (req, res) => {
  const docsUrl = getOpenApiUril(req.hostname);
  res.send(getOpenApiReDocsHtmlString(docsUrl));
});

app.get('/api/test', async (req, res) => {
  try {
    const dbMetadata = await testDbConnection(sequelize);
    res.status(200).send({ status: 'RUNNING', message: 'Database is running', db: { ...dbMetadata } });
  } catch (err) {
    res.status(500).send({ status: 'ERROR', message: (err as Error).message });
  }
});

// Statistics
app.use('/api/stats', statsRoutes);

// Login and logout
app.use('/api/auth', authRoutes);

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

// Inventory
app.use('/api/inventory', inventoryRoutes);

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
