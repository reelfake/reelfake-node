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

export type CsvRowWithIndex = CsvRow & { index: number };

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

export class UploadUtil {
  FILE_PATH: string;
  CSV_STREAM: csv.CsvParserStream<CsvRow, CsvRowWithIndex>;
  TOTAL_ROWS: number;
  IS_DONE: boolean;
  IS_INITIATED: boolean;
  UNIQUE_KEY = 'tmdbId';

  static PENDING_UPLOAD = new Map<String, UploadUtil>();

  constructor(filePath: string) {
    this.TOTAL_ROWS = 0;
    this.FILE_PATH = filePath;
    this.IS_DONE = false;
    this.IS_INITIATED = true;

    this.CSV_STREAM = fs
      .createReadStream(filePath, { encoding: 'utf-8', ...(envVars.nodeEnv === 'test' && { highWaterMark: 10 * 1000 }) })
      .pipe(csv.parse<CsvRow, CsvRowWithIndex>({ headers: true }))
      .transform((row: CsvRow) => ({ ...row, index: ++this.TOTAL_ROWS }));
  }

  deleteFile() {
    if (fs.existsSync(this.FILE_PATH)) {
      fs.unlinkSync(this.FILE_PATH);
    }
  }

  abort() {
    this.IS_DONE = true;
    this.CSV_STREAM.destroy(new Error('ABORTED'));
  }

  async *parseCsv(): AsyncGenerator<CsvRowWithIndex> {
    const queue: CsvRowWithIndex[] = [];
    let done = false;
    let error = null;
    let resolveNext: any = null;

    this.CSV_STREAM.on('error', (err) => {
      this.IS_DONE = true;
      error = err;
      if (resolveNext) {
        resolveNext(Promise.reject(err));
        resolveNext = null;
      }
    });
    this.CSV_STREAM.on('data', (row: CsvRowWithIndex) => {
      this.CSV_STREAM.pause();
      this.IS_DONE = false;
      if (resolveNext) {
        resolveNext({ done: false, value: row });
        resolveNext = null;
      } else {
        queue.push(row);
      }
    });
    this.CSV_STREAM.on('close', () => {
      this.IS_DONE = true;
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
        this.CSV_STREAM.resume();
        continue;
      }

      if (done) break;

      const result: any = await new Promise((resolve) => (resolveNext = resolve));
      if (result.done) break;
      this.CSV_STREAM.resume();
      yield result.value;
    }
  }

  async validate(
    validator: (rowNumber: number, row: CsvRow, delay?: number) => Promise<{ isValid: boolean; reasons: string[] }>,
    onRowProcessed: (rowNumber: number, isValid: boolean, reasons: string[]) => void,
    delayBetweenEvents = 0
  ) {
    for await (const row of this.parseCsv()) {
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

  async process(
    rowHandler: (row: { index: number } & CsvRow) => Promise<{ id: number; tmdbId: number }>,
    successCallback?: (rowNumber: number, id: number) => void,
    errorCallback?: (rowNumber: number, errors: UploadError[]) => void
  ) {
    for await (const row of this.parseCsv()) {
      try {
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
        this.deleteFile();
      }
    }
    return this.TOTAL_ROWS;
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
