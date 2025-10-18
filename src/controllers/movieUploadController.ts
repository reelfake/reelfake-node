import type { Request, Response } from 'express';
import { Op } from 'sequelize';
import sequelize from '../sequelize.config';
import { MovieModel } from '../models';

import { availableGenres, availableCountries, availableMovieLanguages } from '../constants';
import { UploadUtil, CsvRow, CsvRowWithIndex, UploadError } from '../utils/upload';

async function bulkCreateMovies(rows: CsvRowWithIndex[]) {
  const transformedRows = rows.map((r) => ({
    index: r.index,
    tmdbId: Number(r.tmdb_id),
    imdbId: r.imdb_id || null,
    title: r.title,
    originalTitle: r.original_title,
    overview: r.overview,
    runtime: r.runtime,
    releaseDate: r.release_date,
    genreIds: Array.from(JSON.parse(rows[0].genres.replaceAll("'", '"'))).map((g) => availableGenres[String(g).toUpperCase()]),
    originCountryIds: Array.from(JSON.parse(rows[0].countries_of_origin.replaceAll("'", '"'))).map(
      (c) => availableCountries[String(c).toUpperCase()]
    ),
    languageId: availableMovieLanguages[r.language.toUpperCase()],
    movieStatus: r.movie_status,
    popularity: r.popularity,
    budget: r.budget,
    revenue: r.revenue,
    ratingAverage: r.rating_average,
    ratingCount: r.rating_count,
    posterUrl: r.poster_url,
    rentalRate: r.rental_rate,
  }));

  const newRecords = await sequelize.transaction(async (t) => {
    const result = await MovieModel.bulkCreate(transformedRows, {
      fields: [
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
      ],
      ignoreDuplicates: true,
      logging: false,
      validate: false,
      individualHooks: false,
      returning: ['id', 'tmdbId'],
      transaction: t,
    });
    return result.map((res) => ({
      id: Number(res.getDataValue('id')),
      tmdbId: Number(res.getDataValue('tmdbId')),
      isDuplicate: !res.isNewRecord,
    }));
  });

  const newMovieIds = newRecords.map((rec) => {
    const csvRow = transformedRows.find((r) => r.tmdbId === rec.tmdbId);

    if (!csvRow) {
      throw new Error(`Error getting the row from csv for tmdb id ${rec.tmdbId}`);
    }
    if (rec.isDuplicate) {
      return { rowIndex: csvRow.index, movieId: rec.id === 0 ? null : rec.id, isDuplicate: true };
    }
    return { rowIndex: csvRow.index, movieId: rec.id === 0 ? null : rec.id };
  });

  return newMovieIds;
}

export const trackUpload = async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const { totalRows, processedRows, invalidRows } = await UploadUtil.process(
      3,
      async (rows: CsvRowWithIndex[], totalRows: number) => {
        const newMovieIds = await bulkCreateMovies(rows);
        res.write(`data: ${JSON.stringify({ status: 'processing', data: { totalRows, data: newMovieIds } })}\n\n`);
        // await new Promise((resolve) => setTimeout(resolve, 1000));
      },
      (rowIndex: number, errors: string[]) => {
        res.write(`data: ${JSON.stringify({ status: 'error', data: { rowIndex, errors } })}\n\n`);
      }
    );
    res.write(
      `data: ${JSON.stringify({
        status: 'done',
        data: {
          totalRows,
          processedRows,
          invalidRows,
          failed: 0,
          success: 0,
          failedRows: [{ rowIndex: 0, errorMessage: '' }],
        },
      })}\n\n`
    );
  } catch (err) {
    const uploadError = err as UploadError;
    res.write(
      `data: ${JSON.stringify({ status: 'api-error', data: { rowIndex: uploadError.rowIndex, message: uploadError.message } })}\n\n`
    );
  } finally {
    UploadUtil.deleteFile();
    UploadUtil.cleanUp();
    res.end();
  }

  req.on('close', () => {
    res.end();
  });
};

export const uploadMovies = async (req: Request, res: Response) => {
  const filePath = req.file?.path;
  if (!filePath) {
    res.status(404).json({ message: 'File not found in the request' });
    return;
  }

  const enable_tracking = 'enable_tracking' in req.query ? req.query.enable_tracking : undefined;
  const enableTracking =
    enable_tracking !== undefined ? ['', 'yes', 'true'].includes(enable_tracking.toString().toLowerCase().trim()) : false;

  UploadUtil.initiate(filePath);

  if (!enableTracking) {
    // Proceed with processing of csv file and send resposne on completion
    try {
      const { totalRows, processedRows, invalidRows } = await UploadUtil.process(
        5,
        async (rows: CsvRowWithIndex[]) => {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        },
        (rowIndex: number, errors: string[]) => {
          // throw new UploadError('InvalidRow', rowIndex, JSON.stringify(errors));
        }
      );
      res.status(201).json({
        totalRows,
        processedRows,
        invalidRows,
        failed: 0,
        success: 0,
        failedRows: [{ rowIndex: 0, errorMessage: '' }],
      });
    } catch (err: unknown) {
      const uploadError = err as UploadError;
      res.status(500).json({ rowIndex: uploadError.rowIndex, message: uploadError.message });
    }
  } else {
    // Do not process the csv and instead wait for the tracking url to be triggered by client
    res.status(202).json({ trackingUrl: `${req.protocol}://${req.hostname}:${8000}/api/movies/upload/track` });
  }
};

export const validateUpload = async (req: Request, res: Response) => {
  const filePath = req.file?.path;

  if (!filePath) {
    res.status(404).json({ message: 'File not found in the request' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  UploadUtil.initiate(filePath);

  const tmdbIds = new Set<number>();
  const imdbIds = new Set<string>();
  let totalRows = 0;
  let validRowsCount = 0;
  let invalidRowsCount = 0;

  await UploadUtil.validate((rowNumber: number, rowData: CsvRow, isValid: boolean, reason?: string) => {
    if (!isNaN(Number(rowData.tmdb_id)) && Number(rowData.tmdb_id) !== 0) {
      tmdbIds.add(Number(rowData.tmdb_id));
    }
    if (rowData.imdb_id.trim() !== '') {
      imdbIds.add(rowData.imdb_id);
    }
    if (isValid) {
      validRowsCount++;
    } else {
      invalidRowsCount++;
    }
    totalRows++;
    res.write(`data: ${JSON.stringify({ status: 'processing', index: rowNumber, isValid, reason })}\n\n`);
  });

  const moviesWithDuplicateTmdbIds = await MovieModel.findAll({
    attributes: ['tmdbId'],
    where: {
      tmdbId: {
        [Op.in]: Array.from(tmdbIds),
      },
    },
  });

  const moviesWithDuplicateImdbIds = await MovieModel.findAll({
    attributes: ['imdbId'],
    where: {
      imdbId: {
        [Op.in]: Array.from(imdbIds),
      },
    },
  });

  const duplicateTmdbIds = moviesWithDuplicateTmdbIds.map((m) => m.getDataValue('tmdbId'));
  const duplicateImdbIds = moviesWithDuplicateImdbIds.map((m) => m.getDataValue('imdbId'));

  res.write(
    `data: ${JSON.stringify({ status: 'done', totalRows, validRowsCount, invalidRowsCount, existingTmdbIds: duplicateTmdbIds, existingImdbIds: duplicateImdbIds })}\n\n`
  );

  UploadUtil.deleteFile();
  UploadUtil.cleanUp();
  res.end();
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
