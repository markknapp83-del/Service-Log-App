// Enhanced Error handling middleware following Express.js documentation patterns
import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';
import { HIPAALogger } from '@/utils/hipaa-compliance';
import { ApiError } from '@/utils/errors';
import { v4 as uuidv4 } from 'uuid';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const correlationId = uuidv4();
  let statusCode = 500;
  let message = 'Internal server error';
  let details: Record<string, unknown> = {};
  let code = 'INTERNAL_ERROR';
  let category = 'system';
  let severity = 'error';
  let recoverable = false;

  // Enhanced error categorization and classification
  if (error instanceof ApiError) {
    statusCode = error.statusCode;
    message = sanitizeErrorMessage(error.message);
    details = sanitizeErrorDetails(error.details || {});
    
    // Map error names to expected codes with categorization
    switch (error.name) {
      case 'AuthenticationError':
        code = 'AUTHENTICATION_ERROR';
        category = 'security';
        severity = 'warning';
        break;
      case 'AuthorizationError':
        code = 'FORBIDDEN';
        category = 'security';
        severity = 'warning';
        break;
      case 'ValidationError':
        code = 'VALIDATION_ERROR';
        category = 'validation';
        severity = 'info';
        recoverable = true;
        break;
      case 'NotFoundError':
        code = 'NOT_FOUND';
        category = 'business';
        severity = 'info';
        break;
      case 'ConflictError':
        code = 'CONFLICT';
        category = 'business';
        severity = 'warning';
        recoverable = true;
        break;
      default:
        code = error.name.replace('Error', '').toUpperCase();
        category = 'system';
    }
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Data validation failed';
    code = 'VALIDATION_ERROR';
    category = 'validation';
    severity = 'info';
    recoverable = true;
    details = { validationErrors: sanitizeValidationErrors((error as any).details) };
  } else if ((error as any).code === 'SQLITE_CONSTRAINT_UNIQUE') {
    statusCode = 409;
    message = 'Duplicate entry detected';
    code = 'DUPLICATE_RESOURCE';
    category = 'business';
    severity = 'warning';
    recoverable = true;
    details = { type: 'unique_constraint' }; // Don't expose constraint details
  } else if ((error as any).code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    statusCode = 400;
    message = 'Invalid data reference';
    code = 'FOREIGN_KEY_CONSTRAINT';
    category = 'business';
    severity = 'warning';
    recoverable = true;
    details = { type: 'reference_constraint' };
  } else if ((error as any).code === 'ENOTFOUND' || (error as any).code === 'ECONNREFUSED') {
    statusCode = 503;
    message = 'Service temporarily unavailable';
    code = 'SERVICE_UNAVAILABLE';
    category = 'infrastructure';
    severity = 'critical';
    recoverable = true;
  } else if (error.name === 'PayloadTooLargeError') {
    statusCode = 413;
    message = 'Request payload too large';
    code = 'PAYLOAD_TOO_LARGE';
    category = 'validation';
    severity = 'warning';
  }

  // Enhanced error logging with HIPAA compliance and correlation tracking
  const errorContext = {
    correlationId,
    statusCode,
    code,
    category,
    severity,
    recoverable,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    userRole: req.user?.role,
    timestamp: new Date().toISOString(),
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    // Healthcare-specific context
    healthcareContext: extractHealthcareContext(req),
    requestSize: req.get('Content-Length'),
    responseTime: Date.now() - (req as any).startTime
  };

  // Log with appropriate level based on severity
  switch (severity) {
    case 'critical':
      HIPAALogger.error('Critical system error', errorContext);
      break;
    case 'error':
      HIPAALogger.error('System error', errorContext);
      break;
    case 'warning':
      HIPAALogger.warn('Application warning', errorContext);
      break;
    case 'info':
    default:
      HIPAALogger.info('Application info', errorContext);
  }

  // Send HIPAA-compliant error response
  const errorResponse = {
    success: false,
    error: {
      code,
      message,
      correlationId,
      category,
      recoverable,
      details: process.env.NODE_ENV === 'development' ? details : {},
      // Healthcare-specific guidance
      guidance: getHealthcareErrorGuidance(category, code)
    },
    timestamp: new Date().toISOString()
  };

  // Add retry information for recoverable errors
  if (recoverable) {
    (errorResponse.error as any).retryable = true;
    (errorResponse.error as any).retryAfter = calculateRetryDelay(statusCode, category);
  }

  // Set correlation ID header for request tracking
  res.set('X-Correlation-ID', correlationId);
  
  // Set cache headers for error responses
  if (statusCode >= 500) {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  }

  res.status(statusCode).json(errorResponse);
};

// Async error wrapper to catch async errors
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Add request start time for performance tracking
    (req as any).startTime = Date.now();
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// HIPAA-compliant error message sanitization
function sanitizeErrorMessage(message: string): string {
  // Remove any potential PHI from error messages
  return message
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]')  // SSN pattern
    .replace(/\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/g, '[REDACTED_CARD]')  // Card number pattern
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[REDACTED_EMAIL]')  // Email pattern
    .replace(/\b\d{10,}\b/g, '[REDACTED_NUMBER]')  // Long numbers that might be identifiers
    .substring(0, 200); // Limit message length
}

// Sanitize error details to prevent PHI leakage
function sanitizeErrorDetails(details: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(details)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeErrorMessage(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeErrorDetails(value as Record<string, unknown>);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    } else {
      sanitized[key] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

// Sanitize validation errors
function sanitizeValidationErrors(errors: any[]): any[] {
  if (!Array.isArray(errors)) return [];
  return errors.map(error => ({
    field: error.field,
    message: sanitizeErrorMessage(error.message || 'Validation failed'),
    code: error.code
  }));
}

// Extract healthcare-specific context (without PHI)
function extractHealthcareContext(req: Request): Record<string, unknown> {
  const context: Record<string, unknown> = {};
  
  // Extract relevant context without PHI
  if (req.url.includes('/patients/')) {
    context.entityType = 'patient';
    context.operation = req.method;
  } else if (req.url.includes('/service-logs/')) {
    context.entityType = 'service';
    context.operation = req.method;
  } else if (req.url.includes('/admin/')) {
    context.entityType = 'admin';
    context.operation = req.method;
  }
  
  // Add form context if available
  if (req.body && typeof req.body === 'object') {
    context.hasFormData = true;
    context.formFieldCount = Object.keys(req.body).length;
  }
  
  return context;
}

// Get healthcare-specific error guidance
function getHealthcareErrorGuidance(category: string, code: string): string {
  const guidance: Record<string, Record<string, string>> = {
    security: {
      AUTHENTICATION_ERROR: 'Please log in again to continue accessing patient data.',
      FORBIDDEN: 'You do not have permission to access this healthcare information.'
    },
    validation: {
      VALIDATION_ERROR: 'Please check your input and ensure all required healthcare fields are completed correctly.',
      PAYLOAD_TOO_LARGE: 'The file or data you are trying to upload is too large for healthcare compliance.'
    },
    business: {
      NOT_FOUND: 'The requested healthcare record could not be found.',
      CONFLICT: 'This action conflicts with existing healthcare data. Please refresh and try again.',
      DUPLICATE_RESOURCE: 'This healthcare record already exists in the system.'
    },
    infrastructure: {
      SERVICE_UNAVAILABLE: 'Healthcare services are temporarily unavailable. Please try again in a few moments.'
    }
  };
  
  return guidance[category]?.[code] || 'An unexpected error occurred. Please contact technical support if the issue persists.';
}

// Calculate retry delay based on error type
function calculateRetryDelay(statusCode: number, category: string): number {
  switch (category) {
    case 'infrastructure':
      return 30000; // 30 seconds for infrastructure issues
    case 'business':
      return 5000;  // 5 seconds for business logic conflicts
    case 'validation':
      return 0;     // Immediate retry allowed for validation errors
    default:
      return statusCode >= 500 ? 15000 : 5000;
  }
}