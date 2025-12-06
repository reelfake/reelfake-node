import type { Request, Response } from 'express';
import { ValidationError, Transaction } from 'sequelize';

import sequelize from '../sequelize.config';
import { UploadUtil, CsvRow, UploadError, parseCsvRow } from '../utils/upload';
import { AppError } from '../utils';
import { MovieModel } from '../models';
import { ERROR_MESSAGES } from '../constants';
import { CustomRequest } from '../types';

const fieldsForBulkCreate = [
  'tmdbId',
  'imdbId',
  'title',
  'originalTitle',
  'overview',
  'runtime',
  'releaseDate',
  'genreIds',
  'originCountryIds',
  'languageId',
  'movieStatus',
  'popularity',
  'budget',
  'revenue',
  'ratingAverage',
  'ratingCount',
  'posterUrl',
  'rentalRate',
];

const uploadValidationMap = new Map<string, UploadUtil>();
const uploadMap = new Map<string, UploadUtil>();

async function validateCsvRow(rowNumber: number, row: CsvRow, delay = 0) {
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  const parsedRow = parseCsvRow(row);
  try {
    await MovieModel.build(parsedRow, { isNewRecord: true }).validate();
    // Check for duplicate tmdb id
    const existingTmdbIdCount = await MovieModel.count({
      where: {
        tmdbId: row.tmdb_id,
      },
    });
    if (existingTmdbIdCount > 0) {
      throw new UploadError('DuplicateTmdbId', rowNumber, `The tmdb_id ${row.tmdb_id} already exist`);
    }
    // Check for duplicate imdb id
    if (row.imdb_id) {
      const existingImdbIdCount = await MovieModel.count({
        where: {
          imdbId: row.imdb_id,
        },
      });
      if (existingImdbIdCount > 0) {
        throw new UploadError('DuplicateImdbId', rowNumber, `The imdb_id ${row.imdb_id} already exist`);
      }
    }
    return { isValid: true, reasons: [] };
  } catch (err) {
    if (err instanceof ValidationError) {
      const messages = err.errors.map((error) => {
        if (error.path === 'genreIds') {
          return `(genres: ${row.genres}) ${error.message}`;
        } else if (error.path === 'originCountryIds') {
          return `(countries_of_origin: ${row.countries_of_origin}) ${error.message}`;
        } else if (error.path === 'releaseDate' && error.value === 'Invalid date') {
          return `(release_date: ${row.release_date}) Expecting a date in format YYYY-MM-DD`;
        } else if (error.path === 'releaseDate' && error.value !== 'Invalid date') {
          return `(release_date: ${row.release_date}) ${error.message}`;
        } else {
          return `(${error.path}: ${error.value}) ${error.message}`;
        }
      });
      return { isValid: false, reasons: messages };
    }

    if (err instanceof UploadError) {
      const messages = [err.message];
      return { isValid: false, reasons: messages };
    }

    return { isValid: false, reasons: [(err as Error).message] };
  }
}

export const trackUpload = async (req: CustomRequest, res: Response) => {
  const { user } = req;
  if (!user) {
    throw new AppError(ERROR_MESSAGES.FORBIDDEN, 403);
  }

  const { delay_event_ms } = req.query;
  const delayEventMs = delay_event_ms ? Number(delay_event_ms) : 0;

  if (isNaN(delayEventMs)) {
    throw new AppError('Delay event query string should be a number', 400);
  }

  if (delayEventMs > 1000) {
    throw new AppError('Delay event (ms) should be less than 1000 milliseconds', 400);
  }

  let successRowsCount = 0;
  let failedRowsCount = 0;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const uploadUtil = uploadMap.get(user.email);
  if (!uploadUtil) {
    throw new AppError('Upload validation request is not found', 404);
  }

  try {
    const totalRows = await uploadUtil.process(
      async (row: { index: number } & CsvRow) => {
        const validationResult = await validateCsvRow(row.index, row, delayEventMs);
        if (validationResult.isValid === false) {
          throw validationResult.reasons.map((reason) => new UploadError('ValidationFailed', row.index, reason));
        }
        const parsedRow = parseCsvRow(row);
        const movieInstance = await MovieModel.create(parsedRow, {
          fields: fieldsForBulkCreate,
          ignoreDuplicates: false,
          validate: true,
        });

        return { id: Number(movieInstance.getDataValue('id')), tmdbId: movieInstance.getDataValue('tmdbId') };
      },
      (rowNumber: number, id: number) => {
        successRowsCount++;
        res.write(`data: ${JSON.stringify({ status: 'processing', outcome: 'success', rowNumber, id })}\n\n`);
        res.flush();
      },
      (rowNumber: number, errors: UploadError[]) => {
        failedRowsCount++;
        res.write(
          `data: ${JSON.stringify({ status: 'processing', outcome: 'failed', rowNumber, reasons: errors.map((err) => err.message) })}\n\n`
        );
        res.flush();
      }
    );
    res.write(
      `data: ${JSON.stringify({
        status: 'done',
        totalRows,
        successRowsCount,
        failedRowsCount,
      })}\n\n`
    );
    res.flush();
  } catch (err) {
    const uploadError = err as UploadError;
    res.write(
      `data: ${JSON.stringify({ status: 'api-error', rowNumber: uploadError.rowNumber, message: uploadError.message })}\n\n`
    );
    res.flush();
  } finally {
    uploadUtil.deleteFile();
    uploadMap.delete(user.email);
    res.end();
  }

  req.on('close', () => {
    uploadMap.delete(user.email);
    res.end();
  });
};

export const uploadMovies = async (req: CustomRequest, res: Response) => {
  const filePath = req.file?.path;
  if (!filePath) {
    res.status(404).json({ message: 'File not found in the request' });
    return;
  }

  const { user } = req;
  if (!user) {
    throw new AppError(ERROR_MESSAGES.FORBIDDEN, 403);
  }

  const enable_tracking = 'enable_tracking' in req.query ? req.query.enable_tracking : undefined;
  const enableTracking =
    enable_tracking !== undefined ? ['', 'yes', 'true'].includes(enable_tracking.toString().toLowerCase().trim()) : false;
  const stop_on_error = 'stop_on_error' in req.query ? req.query.stop_on_error : undefined;
  const stopOnError =
    stop_on_error !== undefined ? ['', 'yes', 'true'].includes(stop_on_error.toString().toLowerCase().trim()) : false;

  const uploadUtil = new UploadUtil(filePath);

  if (!enableTracking) {
    let t: Transaction | undefined = undefined;
    if (stopOnError) {
      t = await sequelize.transaction();
    }
    try {
      const successRows: { rowNumber: number; id: number }[] = [];
      const failedRows: { rowNumber: number; reasons: string[] }[] = [];
      const totalRows = await uploadUtil.process(
        async (row: { index: number } & CsvRow): Promise<{ id: number; tmdbId: number }> => {
          const validationResult = await validateCsvRow(row.index, row);
          if (validationResult.isValid === false) {
            throw validationResult.reasons.map((reason) => new UploadError('ValidationFailed', row.index, reason));
          }
          const parsedRow = parseCsvRow(row);
          const movieInstance = await MovieModel.create(parsedRow, {
            fields: fieldsForBulkCreate,
            ignoreDuplicates: false,
            validate: true,
            ...(t && { transaction: t }),
          });
          return { id: Number(movieInstance.getDataValue('id')), tmdbId: movieInstance.getDataValue('tmdbId') };
        },
        (rowNumber: number, id: number) => {
          successRows.push({ rowNumber, id });
        },
        (rowNumber: number, errors: UploadError[]) => {
          if (stopOnError) {
            throw errors;
          } else {
            failedRows.push({ rowNumber, reasons: errors.map((err) => err.message) });
          }
        }
      );
      await t?.commit();
      res.status(201).json({
        totalRows,
        successRows,
        failedRows,
      });
    } catch (err: unknown) {
      await t?.rollback();
      if (Array.isArray(err) && err.every((e) => e instanceof UploadError)) {
        res.status(400).json(err);
      } else {
        res.status(500).json(err);
      }
    }
  } else {
    uploadMap.set(user.email, uploadUtil);

    const { query } = req;
    let queryString = '';
    if ('delay_event_ms' in query) {
      queryString = `?delay_event_ms=${query['delay_event_ms']}`;
    }

    const trackingUrl = `/movies/upload/track${queryString}`;
    res.status(202).json({ trackingUrl });
  }
};

export const trackUploadValidation = async (req: CustomRequest, res: Response) => {
  let totalRows = 0;
  let validRowsCount = 0;
  let invalidRowsCount = 0;
  let processedCount = 0;

  const { delay_event_ms } = req.query;
  const delayEventMs = delay_event_ms ? Number(delay_event_ms) : 0;

  if (isNaN(delayEventMs)) {
    throw new AppError('Delay event query string should be a number', 400);
  }

  if (delayEventMs > 1000) {
    throw new AppError('Delay event (ms) should be less than 1000 milliseconds', 400);
  }

  const { user } = req;
  if (!user) {
    throw new AppError(ERROR_MESSAGES.FORBIDDEN, 403);
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const uploadUtil = uploadValidationMap.get(user.email);
  if (!uploadUtil) {
    throw new AppError('Upload validation request is not found', 404);
  }

  req.on('close', () => {
    uploadUtil.abort();
  });

  try {
    await uploadUtil.validate(
      validateCsvRow,
      (rowNumber: number, isValid: boolean, reasons: string[]) => {
        processedCount++;
        if (isValid) {
          validRowsCount++;
        } else {
          invalidRowsCount++;
        }
        totalRows++;
        res.write(
          `data: ${JSON.stringify({ status: 'processing', rowNumber, isValid, ...(reasons.length > 0 && { reasons }) })}\n\n`
        );
        res.flush();
      },
      delayEventMs
    );
    res.write(
      `data: ${JSON.stringify({ status: 'done', totalRows, processedRowsCount: processedCount, validRowsCount, invalidRowsCount })}\n\n`
    );
    res.flush();
  } catch (error: unknown) {
    if (error instanceof Error && error.message !== 'ABORTED') {
      res.write(`data: ${JSON.stringify({ status: 'error', message: error.message })}\n\n`);
      res.flush();
    }
  }

  uploadUtil.deleteFile();
  uploadValidationMap.delete(user.email);
  res.end();
};

export const validateUpload = async (req: CustomRequest, res: Response) => {
  const filePath = req.file?.path;
  const { delay_event_ms } = req.query;
  const delayEventMs = delay_event_ms ? Number(delay_event_ms) : 0;

  if (isNaN(delayEventMs)) {
    throw new AppError('Delay event query string should be a number', 400);
  }

  if (delayEventMs > 1000) {
    throw new AppError('Delay event (ms) should be less than 1000 milliseconds', 400);
  }

  if (!filePath) {
    res.status(404).json({ message: 'File not found in the request' });
    return;
  }

  const { user } = req;

  if (!user) {
    throw new AppError(ERROR_MESSAGES.FORBIDDEN, 403);
  }

  const enable_tracking = 'enable_tracking' in req.query ? req.query.enable_tracking : undefined;
  const enableTracking =
    enable_tracking !== undefined ? ['', 'yes', 'true'].includes(enable_tracking.toString().toLowerCase().trim()) : false;

  const uploadUtil = new UploadUtil(filePath);

  let totalRows = 0;
  let invalidRowsCount = 0;
  const invalidRows: { rowNumber: number; reasons: string[] }[] = [];

  if (!enableTracking) {
    try {
      await uploadUtil.validate(validateCsvRow, (rowNumber: number, isValid: boolean, reasons: string[]) => {
        if (!isValid) {
          invalidRowsCount++;
          invalidRows.push({ rowNumber, reasons });
        }
        totalRows++;
      });
    } finally {
      uploadUtil.deleteFile();
    }

    res.status(200).json({ totalRows, invalidRows });
    return;
  } else {
    uploadValidationMap.set(user.email, uploadUtil);

    // req.headers.orgin - https://localhost:3000
    // req.hostname - reelfake.cloud
    // req.url - /upload/validate?enable_tracking=true&delay_event_ms=500
    // req.originalUrl - /api/movies/upload/validate?enable_tracking=true&delay_event_ms=500

    const { query } = req;
    let queryString = '';
    if ('delay_event_ms' in query) {
      queryString = `?delay_event_ms=${query['delay_event_ms']}`;
    }

    const trackingUrl = `/movies/upload/track_validation${queryString}`;

    res.status(202).json({ trackingUrl });
  }
};

export const uploadMoviesUsingSocket = async (req: Request, res: Response) => {
  // const socketId = req.body.socketId;
  // const filePath = req.file?.path;
  // console.log(filePath);
  // if (!filePath) {
  //   throw new Error('Error getting file from request');
  // }
  // const socket = WebSocket.getSocket(socketId);
  // fs.createReadStream(filePath)
  //   .pipe(csv())
  //   .on('data', (row) => {
  //     if (WebSocket.cancelProcessing) return;
  //     socket?.emit('progress', row);
  //   })
  //   .on('end', () => {
  //     if (!WebSocket.cancelProcessing) socket?.emit('done', 'Processing complete');
  //     fs.unlinkSync(filePath);
  //     WebSocket.processing = false;
  //     res.json({ message: 'done' });
  //   });
};
