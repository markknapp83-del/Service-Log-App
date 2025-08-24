// Validation middleware following Express.js documentation patterns
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { ValidationError } from '@/utils/errors';

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