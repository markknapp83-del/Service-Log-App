// Validation middleware following Express.js documentation patterns
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { z, ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../utils/errors';

export const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.type === 'field' ? error.path : 'unknown',
      message: error.msg,
      value: error.type === 'field' ? error.value : undefined
    }));

    throw new ValidationError('Validation failed', errorMessages);
  }
  
  next();
};

// Zod validation middleware for request body
export function validateRequest<T>(schema: ZodSchema<T>, location: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = location === 'body' ? req.body : location === 'query' ? req.query : req.params;
      const validatedData = schema.parse(data);
      
      // Replace the request data with validated data
      if (location === 'body') {
        req.body = validatedData;
      } else if (location === 'query') {
        req.query = validatedData as any;
      } else {
        req.params = validatedData as any;
      }
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        }));
        
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: formattedErrors,
          },
          timestamp: new Date().toISOString(),
        });
      }
      
      next(error);
    }
  };
}

// Helper for validating query parameters
export function validateQuery<T>(schema: ZodSchema<T>) {
  return validateRequest(schema, 'query');
}

// Custom validators for healthcare data
export const customValidators = {
  isValidUserId: (value: string) => {
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
  },
  
  isValidRole: (value: string) => {
    const validRoles = ['admin', 'candidate'];
    return validRoles.includes(value);
  },
  
  isValidPhoneNumber: (value: string) => {
    return /^\d{10}$/.test(value.replace(/\D/g, ''));
  },

  isStrongPassword: (value: string) => {
    // At least 8 characters, one lowercase, one uppercase or number
    return value.length >= 8 && 
           /[a-z]/.test(value) && 
           /[A-Z0-9]/.test(value);
  }
};