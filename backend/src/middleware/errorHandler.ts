// Error handling middleware following Express.js documentation patterns
import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger.js';
import { ApiError } from '@/utils/errors.js';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal server error';
  let details: Record<string, unknown> = {};
  let code = 'INTERNAL_ERROR';

  // Handle known error types
  if (error instanceof ApiError) {
    statusCode = error.statusCode;
    message = error.message;
    details = error.details || {};
    code = error.name.replace('Error', '').toUpperCase();
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation error';
    code = 'VALIDATION_ERROR';
    details = { validationErrors: (error as any).details };
  } else if ((error as any).code === 'SQLITE_CONSTRAINT_UNIQUE') {
    statusCode = 409;
    message = 'Resource already exists';
    code = 'DUPLICATE_RESOURCE';
    details = { constraint: error.message };
  } else if ((error as any).code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    statusCode = 400;
    message = 'Invalid reference';
    code = 'FOREIGN_KEY_CONSTRAINT';
    details = { constraint: error.message };
  }

  // Log error for monitoring
  logger.error('API Error', {
    statusCode,
    message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    user: req.user?.id,
    code
  });

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details: process.env.NODE_ENV === 'development' ? details : {}
    },
    timestamp: new Date().toISOString()
  });
};

// Async error wrapper to catch async errors
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};