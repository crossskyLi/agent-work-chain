import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { logger } from './logger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const code = err instanceof AppError ? err.code : 'INTERNAL_ERROR';
  const requestId = String((req as { id?: string }).id || '');

  logger.error(
    {
      requestId,
      statusCode,
      code,
      path: req.originalUrl,
      method: req.method,
      err: err.stack || err.message,
    },
    'request failed',
  );

  res.status(statusCode).json({
    error: err.message || 'Internal Server Error',
    code,
    requestId,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
