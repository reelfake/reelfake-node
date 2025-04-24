export class AppError extends Error {
  statusCode: number;
  status: 'error' | 'failed';

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.status = statusCode < 500 ? 'error' : 'failed';
    if (process.env.NODE_ENV !== 'production') Error.captureStackTrace(this, this.constructor);
  }
}
