import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

export interface CustomError extends Error {
  statusCode?: number;
  status?: string;
  isOperational?: boolean;
}

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    data: null,
  });
};

export const errorHandler = (
  err: CustomError | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const status = statusCode >= 500 ? 'error' : 'fail';
  console.error(`[${new Date().toISOString()}]`, err);

  if (process.env.NODE_ENV === 'development') {
    res.status(statusCode).json({ status, message: err.message, stack: err.stack, data: null });
    return;
  }

  const isOperational = 'isOperational' in err && err.isOperational;
  if (isOperational) {
    res.status(statusCode).json({ status, message: err.message, data: null });
    return;
  }

  res.status(500).json({ status: 'error', message: 'Something went wrong!', data: null });
};