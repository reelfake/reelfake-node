import { DatabaseError, UniqueConstraintError, ValidationError } from 'sequelize';
import fs from 'fs';
import * as csv from 'fast-csv';
import { availableCountries, availableGenres, availableMovieLanguages } from '../../constants';

export type CsvRow = {
  tmdb_id: string;
  imdb_id: string;
  title: string;
  original_title: string;
  overview: string;
  runtime: string;
  release_date: string;
  genres: string;
  countries_of_origin: string;
  language: string;
  movie_status: string;
  popularity: number;
  budget: bigint;
  revenue: bigint;
  rating_average: number;
  rating_count: number;
  poster_url: string;
  rental_rate: number;
};

export type ParsedCsvRow = {
  tmdbId: string;
  imdbId: string | null;
  title: string;
  originalTitle: string;
  overview: string;
  runtime: number;
  releaseDate: string;
  genreIds: number[];
  originCountryIds: number[];
  languageId: number;
  movieStatus: string;
  popularity: number;
  budget: bigint;
  revenue: bigint;
  ratingAverage: number;
  ratingCount: number;
  posterUrl: string;
  rentalRate: number;
};

function parseGenres(genres: string[]) {
  const genresCopy = [...genres];
  const genreIds = [];

  let genreName = genresCopy.shift();

  while (genreName) {
    const genreId = availableGenres[genreName.toUpperCase()];
    genreIds.push(genreId);
    genreName = genresCopy.shift();
  }

  return genreIds;
}

function parseCountries(countries: string[]) {
  const countriesCopy = [...countries];
  const countryIds = [];

  let countryName = countriesCopy.shift();

  while (countryName) {
    const genreId = availableCountries[countryName.toUpperCase()];
    countryIds.push(genreId);
    countryName = countriesCopy.shift();
  }

  return countryIds;
}

export function parseCsvRow(row: CsvRow): ParsedCsvRow {
  const genreNames = Array.from(JSON.parse(row.genres.replaceAll("'", '"')) as string[]);
  const countryNames = Array.from(JSON.parse(row.countries_of_origin.toUpperCase().replaceAll("'", '"')) as string[]);

  return {
    tmdbId: row.tmdb_id,
    imdbId: row.imdb_id ? row.imdb_id : null,
    title: row.title,
    originalTitle: row.original_title,
    overview: row.overview,
    runtime: row.runtime ? Number(row.runtime) : 0,
    releaseDate: row.release_date,
    genreIds: parseGenres(genreNames),
    originCountryIds: parseCountries(countryNames),
    languageId: Number(availableMovieLanguages[row.language.toUpperCase()]),
    movieStatus: row.movie_status,
    popularity: parseFloat(row.popularity.toString()),
    budget: BigInt(row.budget),
    revenue: BigInt(row.revenue),
    ratingAverage: parseFloat(row.rating_average.toString()),
    ratingCount: Number(row.rating_count),
    posterUrl: row.poster_url,
    rentalRate: parseFloat(row.rental_rate.toString()),
  };
}

export type CsvRowWithIndex = CsvRow & { index: number };
export type ParsedCsvRowWithIndex = ParsedCsvRow & { index: number };

export class UploadUtil {
  static FILE_PATH: string;
  static CSV_STREAM: csv.CsvParserStream<CsvRow, CsvRowWithIndex>;
  static TOTAL_ROWS: number;
  static IS_DONE: boolean;
  static IS_INITIATED = false;
  static UNIQUE_KEY = 'tmdbId';

  static initiate(filePath: string) {
    UploadUtil.TOTAL_ROWS = 0;
    UploadUtil.FILE_PATH = filePath;

    UploadUtil.IS_INITIATED = true;
    UploadUtil.CSV_STREAM = fs
      .createReadStream(filePath, { encoding: 'utf-8', ...(process.env.NODE_ENV === 'test' && { highWaterMark: 10 * 1000 }) })
      .pipe(csv.parse<CsvRow, CsvRowWithIndex>({ headers: true }))
      .transform((row: CsvRow) => ({ ...row, index: ++UploadUtil.TOTAL_ROWS }));
  }

  static deleteFile() {
    if (fs.existsSync(UploadUtil.FILE_PATH)) {
      fs.unlinkSync(UploadUtil.FILE_PATH);
    }
  }

  static cleanUp() {
    UploadUtil.CSV_STREAM.removeAllListeners();
    UploadUtil.CSV_STREAM.destroy();
  }

  static async *parseCsv(): AsyncGenerator<CsvRowWithIndex> {
    const queue: CsvRowWithIndex[] = [];
    let done = false;
    let error = null;
    let resolveNext: any = null;

    UploadUtil.CSV_STREAM.on('data', (row: CsvRowWithIndex) => {
      UploadUtil.IS_DONE = false;
      if (resolveNext) {
        resolveNext({ done: false, value: row });
        resolveNext = null;
      } else {
        queue.push(row);
      }
    })
      .on('close', () => {
        UploadUtil.IS_DONE = true;
        done = true;
        if (resolveNext) {
          resolveNext({ done: true, value: undefined });
          resolveNext = null;
        }
      })
      .on('error', (err) => {
        UploadUtil.IS_DONE = true;
        error = err;
        if (resolveNext) {
          resolveNext(Promise.reject(err));
          resolveNext = null;
        }
      });

    while (true) {
      if (error) throw error;

      if (queue.length > 0) {
        yield queue.shift() as CsvRowWithIndex;
        continue;
      }

      if (done) break;

      const result: any = await new Promise((resolve) => (resolveNext = resolve));
      if (result.done) break;
      yield result.value;
    }
  }

  static async validate(
    validator: (rowNumber: number, row: CsvRow) => Promise<{ isValid: boolean; reasons: string[] }>,
    onRowProcessed: (rowNumber: number, isValid: boolean, reasons: string[]) => void
  ) {
    try {
      for await (const row of UploadUtil.parseCsv()) {
        // await new Promise((resolve) => setTimeout(resolve, 2000));
        const validationResult = await validator(row.index, row);
        onRowProcessed(row.index, validationResult.isValid, validationResult.reasons);
      }
    } catch (err) {
      console.log('ERRROR', err);
    }
  }

  static validate1(
    valiationHandler: (rowNumber: number, row: CsvRow) => Promise<{ isValid: boolean; reasons: string[] }>,
    onRowProcessed: (rowNumber: number, isValid: boolean, reasons: string[]) => void
  ) {
    const validator = new Promise((resolve, reject) => {
      UploadUtil.CSV_STREAM.validate(async (row, cb) => {
        const validationResult = await valiationHandler(row.index, row);
        return cb(null, validationResult.isValid, JSON.stringify(validationResult.reasons));
      })
        .on('error', (error) => reject(error))
        .on('data', (row: CsvRowWithIndex) => {
          onRowProcessed(row.index, true, []);
        })
        .on('data-invalid', (row) => console.log(`Invalid [row=${JSON.stringify(row)}]`))
        .on('end', (rowCount: number) => resolve(rowCount));
    });

    return validator;

    // return new Promise((resolve) => {
    //   UploadUtil.CSV_STREAM.validate(async (row, cb) => {
    //     const validationResult = await valiationHandler(row.index, row);
    //     onRowProcessed(row.index, validationResult.isValid, validationResult.reasons);
    //     return cb(null, validationResult.isValid, JSON.stringify(validationResult.reasons));
    //   })
    //     // .on('data-invalid', (row: CsvRow, rowNumber: number, reason) => {
    //     //   onRowProcessed(rowNumber, false, reason);
    //     // })
    //     .on('data', () => {})
    //     .on('close', resolve);
    // });
  }

  static async executeRowHandler(
    row: ParsedCsvRowWithIndex,
    rowHandler: (row: ParsedCsvRowWithIndex) => Promise<{ id: number; tmdbId: number }>
  ) {
    try {
      const { id: generatedId, tmdbId: generatedTmdbId } = await rowHandler(row);

      if (generatedTmdbId.toString() === row.tmdbId) {
        return { rowIndex: row.index, id: generatedId };
      } else {
        throw new UploadError('DatabaseError', -1, `Error adding data for row ${row.index}`);
      }
    } catch (err) {
      if (err instanceof UniqueConstraintError) {
        const culpritsOfCsvColumns = err.errors.map((e) => ({ key: e.path, value: e.value, message: e.message }));
        const accumulatedErrors = culpritsOfCsvColumns.reduce<UploadError[]>((acc, curr) => {
          const { key, value } = curr;
          if (key === null) return acc;
          acc.push(new UploadError('UniqueKeyViolation', row.index, `(${key}) ${curr.message}`));
          return acc;
        }, []);
        throw accumulatedErrors;
      } else if (err instanceof ValidationError) {
        const culpritsOfCsvColumns = err.errors.map((e) => ({ key: e.path, value: e.value, message: e.message }));
        const accumulatedErrors = culpritsOfCsvColumns.reduce<UploadError[]>((acc, curr) => {
          const { key, value } = curr;
          if (key === null) return acc;
          acc.push(new UploadError('ValidationFailed', row.index, `(${key}) ${curr.message}`));
          return acc;
        }, []);
        throw accumulatedErrors;
      } else if (err instanceof DatabaseError) {
        // Todo - Handle DatabaseError type of error
        throw new UploadError(err.name, -1, err.message);
      } else {
        throw new UploadError('UnhandledException', -1, (err as Error).message);
      }
    }
  }

  static async process(
    rowHandler: (row: ParsedCsvRowWithIndex) => Promise<{ id: number; tmdbId: number }>,
    successCallback?: (data: { id: number; rowIndex: number }) => void,
    errorCallback?: (errors: UploadError[]) => void
  ) {
    const failedRows = [];
    const successRows = [];

    for await (const row of UploadUtil.parseCsv()) {
      try {
        const parsed = parseCsvRow(row);
        const parsedIncludingIndex = { index: row.index, ...parsed };

        const result = await UploadUtil.executeRowHandler(parsedIncludingIndex, rowHandler);
        successCallback?.(result);
        successRows.push(result);
      } catch (err) {
        if (err instanceof UploadError) {
          errorCallback?.([err]);
          failedRows.push(err);
        } else if (Array.isArray(err) && err.every((e) => e instanceof UploadError)) {
          errorCallback?.(err);
          failedRows.push(...err);
        } else {
          throw err;
        }
      } finally {
        UploadUtil.cleanUp();
        UploadUtil.deleteFile();
      }
    }
    return { totalRows: UploadUtil.TOTAL_ROWS, successRows: successRows, failedRows: failedRows };
  }
}

export class UploadError extends Error {
  rowIndex: number;
  name: string;
  field: { key: string; value: string | null } | undefined;

  constructor(name: string, rowIndex: number, message: string, field?: { key: string; value: string | null }) {
    super(message);
    this.name = name;
    this.rowIndex = rowIndex;
    if (field) {
      this.field = field;
    }
  }

  public toJSON() {
    return { rowIndex: this.rowIndex, name: this.name, message: this.message, field: this.field };
  }
}
