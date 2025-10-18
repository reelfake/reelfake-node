import fs from 'fs';
import * as csv from 'fast-csv';
import { availableCountries, availableGenres, availableMovieLanguages } from '../../constants';

export type CsvRow = {
  tmdb_id: string;
  imdb_id: string;
  title: string;
  original_title: string;
  overview: string;
  runtime: number;
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

export type CsvRowWithIndex = CsvRow & { index: number };

function validateArrayTypeValue(key: string, value: string) {
  if (key !== 'genres' && key !== 'countries_of_origin') {
    throw new Error(`${key} is not of array type data item`);
  }

  const reasonsForInvalid = [];

  let validData: { [key: string]: number };

  if (key === 'genres') {
    validData = availableGenres;
  } else {
    validData = availableCountries;
  }

  const validValues = Object.keys(validData);

  try {
    const arr = JSON.parse(value);
    if (!Array.isArray(arr)) {
      reasonsForInvalid.push(`${key} must be an array`);
    } else if (arr.findIndex((val) => validValues.includes(val)) === -1) {
      reasonsForInvalid.push(
        `The valid ${key} are ${Object.entries(validData)
          .map((data) => `${data[1]} (${data[0]})`)
          .join(', ')}`
      );
    }
  } catch (err) {
    reasonsForInvalid.push(`${key} must be an array`);
  }

  return reasonsForInvalid;
}

function validateRow(row: CsvRow) {
  const reasonsForInvalid = [];

  const entries = Object.entries(row);

  for (const item of entries) {
    const [key, value] = item;
    if (
      [
        'tmdb_id',
        'title',
        'original_title',
        'release_date',
        'genres',
        'countries_of_origin',
        'language',
        'movie_status',
        'popularity',
        'budget',
        'revenue',
        'rating_average',
        'rating_count',
      ].includes(key) &&
      value === ''
    ) {
      reasonsForInvalid.push(`${key} cannot be empty`);
      continue;
    }

    if (
      ['tmdb_id', 'runtime', 'popularity', 'rating_average', 'rating_count', 'rental_rate'].includes(key) &&
      isNaN(Number(value))
    ) {
      reasonsForInvalid.push(`${key} must be a number`);
      continue;
    }

    if (['genres', 'countries_of_origin'].includes(key)) {
      const reasons = validateArrayTypeValue(key, value.toString().toUpperCase().replaceAll("'", '"'));
      if (reasons.length > 0) {
        reasonsForInvalid.push(...reasons);
        continue;
      }
    }

    if (key === 'language' && !Object.keys(availableMovieLanguages).includes(value.toString().toUpperCase())) {
      reasonsForInvalid.push(
        `Valid movie languages are ${Object.entries(availableMovieLanguages)
          .map((data) => `${data[1]} (${data[0]})`)
          .join(', ')}`
      );
      continue;
    }

    if (key === 'release_date' && /^\d{4}-(0[1-9]|1[0,1,2])-(0[1-9]|[12][0-9]|3[01])$/.test(value.toString()) === false) {
      reasonsForInvalid.push(`${key} must be in format YYYY-MM-DD`);
      continue;
    }
  }

  return reasonsForInvalid;
}

export class UploadUtil {
  static FILE_PATH: string;
  static CSV_STREAM: csv.CsvParserStream<CsvRow, CsvRowWithIndex>;
  static TOTAL_ROWS: number;

  static initiate(filePath: string) {
    UploadUtil.TOTAL_ROWS = 0;
    UploadUtil.FILE_PATH = filePath;

    UploadUtil.CSV_STREAM = fs
      .createReadStream(filePath, { encoding: 'utf-8' })
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
      if (resolveNext) {
        resolveNext({ done: false, value: row });
        resolveNext = null;
      } else {
        queue.push(row);
      }
    })
      .on('close', () => {
        done = true;
        if (resolveNext) {
          resolveNext({ done: true, value: undefined });
          resolveNext = null;
        }
      })
      .on('error', (err) => {
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

  static validate(onRowProcessed: (rowNumber: number, row: CsvRow, isValid: boolean, reason?: string) => void) {
    return new Promise((resolve) => {
      UploadUtil.CSV_STREAM.validate((row, cb) => {
        const reasonsIfInvalid = validateRow(row);
        const isValid = reasonsIfInvalid.length === 0;
        if (!isValid) {
          return cb(null, false, JSON.stringify(reasonsIfInvalid));
        }

        onRowProcessed(row.index, row, true);
        return cb(null, true);
      })
        .on('data-invalid', (row: CsvRow, rowNumber: number, reason) => {
          onRowProcessed(rowNumber, row, false, reason);
        })
        .on('data', () => {})
        .on('close', resolve);
    });
  }

  static async process(
    batchCount: number,
    rowProcessor: (rows: CsvRowWithIndex[], totalRows: number) => Promise<void>,
    onInvalidRow?: (index: number, errors: string[]) => void
  ) {
    const invalidRowsIndex = [];
    const processedRowsIndex = [];
    let index = 0;

    try {
      const batch: CsvRowWithIndex[] = [];
      for await (const row of UploadUtil.parseCsv()) {
        const invalidRowMessages = validateRow(row);

        if (invalidRowMessages.length > 0) {
          onInvalidRow?.(row.index, invalidRowMessages);
          invalidRowsIndex.push(index);
        } else {
          batch.push(row);
          if (batch.length >= batchCount) {
            await rowProcessor(batch, UploadUtil.TOTAL_ROWS);
            batch.length = 0;
          }
          processedRowsIndex.push(index);
        }

        index++;
      }

      if (batch.length > 0) {
        await rowProcessor(batch, UploadUtil.TOTAL_ROWS);
      }
    } finally {
      UploadUtil.deleteFile();
    }

    return { totalRows: index, processedRows: processedRowsIndex, invalidRows: invalidRowsIndex };
  }
}

export class UploadError extends Error {
  rowIndex: number;

  constructor(name: string, rowIndex: number, message: string) {
    super(message);
    this.name = name;
    this.rowIndex = rowIndex;
  }
}
