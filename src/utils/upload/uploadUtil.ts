import { DatabaseError, UniqueConstraintError, ValidationError } from 'sequelize';
import fs from 'fs';
import * as csv from 'fast-csv';
import { availableCountries, availableGenres, availableMovieLanguages, envVars } from '../../constants';

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
      .createReadStream(filePath, { encoding: 'utf-8', ...(envVars.nodeEnv === 'test' && { highWaterMark: 10 * 1000 }) })
      .pipe(csv.parse<CsvRow, CsvRowWithIndex>({ headers: true }))
      .transform((row: CsvRow) => ({ ...row, index: ++UploadUtil.TOTAL_ROWS }));
  }

  static deleteFile() {
    if (fs.existsSync(UploadUtil.FILE_PATH)) {
      fs.unlinkSync(UploadUtil.FILE_PATH);
    }
  }

  static abort() {
    UploadUtil.IS_DONE = true;
    UploadUtil.CSV_STREAM.destroy(new Error('ABORTED'));
  }

  static async *parseCsv(): AsyncGenerator<CsvRowWithIndex> {
    const queue: CsvRowWithIndex[] = [];
    let done = false;
    let error = null;
    let resolveNext: any = null;

    UploadUtil.CSV_STREAM.on('error', (err) => {
      UploadUtil.IS_DONE = true;
      error = err;
      if (resolveNext) {
        resolveNext(Promise.reject(err));
        resolveNext = null;
      }
    });
    UploadUtil.CSV_STREAM.on('data', (row: CsvRowWithIndex) => {
      UploadUtil.CSV_STREAM.pause();
      UploadUtil.IS_DONE = false;
      if (resolveNext) {
        resolveNext({ done: false, value: row });
        resolveNext = null;
      } else {
        queue.push(row);
      }
    });
    UploadUtil.CSV_STREAM.on('close', () => {
      UploadUtil.IS_DONE = true;
      done = true;
      if (resolveNext) {
        resolveNext({ done: true, value: undefined });
        resolveNext = null;
      }
    });

    while (true) {
      if (error) throw error;

      if (queue.length > 0) {
        yield queue.shift() as CsvRowWithIndex;
        UploadUtil.CSV_STREAM.resume();
        continue;
      }

      if (done) break;

      const result: any = await new Promise((resolve) => (resolveNext = resolve));
      if (result.done) break;
      UploadUtil.CSV_STREAM.resume();
      yield result.value;
    }
  }

  static async validate(
    validator: (rowNumber: number, row: CsvRow, delay?: number) => Promise<{ isValid: boolean; reasons: string[] }>,
    onRowProcessed: (rowNumber: number, isValid: boolean, reasons: string[]) => void,
    delayBetweenEvents = 0
  ) {
    for await (const row of UploadUtil.parseCsv()) {
      const validationResult = await validator(row.index, row, delayBetweenEvents);
      onRowProcessed(row.index, validationResult.isValid, validationResult.reasons);
    }
  }

  static async executeRowHandler(
    row: { index: number } & CsvRow,
    rowHandler: (row: { index: number } & CsvRow) => Promise<{ id: number; tmdbId: number }>
  ) {
    try {
      const { id: generatedId, tmdbId: generatedTmdbId } = await rowHandler(row);

      if (generatedTmdbId.toString() === row.tmdb_id) {
        return { rowNumber: row.index, id: generatedId };
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
          acc.push(new UploadError('ValidationFailed', row.index, `(${key}: ${curr.value}) ${curr.message}`));

          return acc;
        }, []);
        throw accumulatedErrors;
      } else if (Array.isArray(err) && err.every((e) => e instanceof UploadError)) {
        throw err;
      } else if (err instanceof DatabaseError) {
        // Todo - Handle DatabaseError type of error
        throw new UploadError(err.name, -1, err.message);
      } else {
        throw new UploadError('UnhandledException', -1, (err as Error).message);
      }
    }
  }

  static async process(
    rowHandler: (row: { index: number } & CsvRow) => Promise<{ id: number; tmdbId: number }>,
    successCallback?: (rowNumber: number, id: number) => void,
    errorCallback?: (rowNumber: number, errors: UploadError[]) => void
  ) {
    for await (const row of UploadUtil.parseCsv()) {
      try {
        // const parsed = parseCsvRow(row);
        // const parsedIncludingIndex = { index: row.index, ...parsed };

        const { id, rowNumber } = await UploadUtil.executeRowHandler(row, rowHandler);
        successCallback?.(rowNumber, id);
      } catch (err) {
        if (err instanceof UploadError) {
          errorCallback?.(row.index, [err]);
        } else if (Array.isArray(err) && err.every((e) => e instanceof UploadError)) {
          errorCallback?.(row.index, err);
        } else {
          throw err;
        }
      } finally {
        UploadUtil.deleteFile();
      }
    }
    return UploadUtil.TOTAL_ROWS;
  }
}

export class UploadError extends Error {
  rowNumber: number;
  name: string;
  field: { key: string; value: string | null } | undefined;

  constructor(name: string, rowNumber: number, message: string, field?: { key: string; value: string | null }) {
    super(message);
    this.name = name;
    this.rowNumber = rowNumber;
    if (field) {
      this.field = field;
    }
  }

  public toJSON() {
    return { rowNumber: this.rowNumber, name: this.name, message: this.message, field: this.field };
  }
}
