// Security hardening middleware following Express.js documentation patterns
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
// import slowDown from 'express-slow-down'; // Commented out for now
import DOMPurify from 'isomorphic-dompurify';
import { logger } from '@/utils/logger';
import { ApiError } from '@/utils/errors';

// Enhanced rate limiting configurations
export const createRateLimiter = (windowMs: number, max: number, message: string, keyGenerator?: (req: Request) => string) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keyGenerator || ((req) => req.ip),
    skip: (req) => {
      // Skip rate limiting for health checks in development
      return process.env.NODE_ENV !== 'production' && req.path === '/health';
    },
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent'),
        limit: max,
        windowMs
      });
      
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message
        }
      });
    }
  });
};

// Stricter rate limiting for authentication endpoints
export const authRateLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  process.env.NODE_ENV === 'production' ? 5 : 50, // 5 attempts in production, 50 in development
  'Too many authentication attempts, please try again later.'
);

// Rate limiting for password reset endpoints
export const passwordResetLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  process.env.NODE_ENV === 'production' ? 3 : 10, // 3 attempts in production
  'Too many password reset requests, please try again later.'
);

// API rate limiting with different limits per user role
export const createRoleBasedRateLimiter = () => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: (req) => {
      if (process.env.NODE_ENV !== 'production') return 10000;
      
      const user = (req as any).user;
      if (!user) return 20; // Unauthenticated users
      
      switch (user.role) {
        case 'admin': return 500;
        case 'candidate': return 100;
        default: return 50;
      }
    },
    keyGenerator: (req) => {
      const user = (req as any).user;
      return user?.id || req.ip;
    },
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later.'
      }
    }
  });
};

// Slow down middleware for suspicious activity (temporarily disabled)
export const slowDownMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Placeholder - implement custom slow down logic if needed
  next();
};

// Input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      // Remove potential script tags and event handlers
      const sanitized = DOMPurify.sanitize(value, {
        ALLOWED_TAGS: [], // Remove all HTML tags
        ALLOWED_ATTR: []
      });
      
      // Additional sanitization for common injection patterns
      return sanitized
        .replace(/javascript:/gi, '')
        .replace(/on\w+=/gi, '')
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, ''); // Remove any remaining HTML tags
    }
    
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        return value.map(sanitizeValue);
      }
      
      const sanitized: Record<string, any> = {};
      for (const [key, val] of Object.entries(value)) {
        // Prevent prototype pollution
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          continue;
        }
        sanitized[key] = sanitizeValue(val);
      }
      return sanitized;
    }
    
    return value;
  };

  try {
    if (req.body) {
      req.body = sanitizeValue(req.body);
    }
    
    if (req.query) {
      req.query = sanitizeValue(req.query);
    }
    
    if (req.params) {
      req.params = sanitizeValue(req.params);
    }
    
    next();
  } catch (error) {
    logger.error('Input sanitization failed', { error, url: req.url });
    next(new ApiError(400, 'Invalid input data'));
  }
};

// Request size limiting middleware
export const requestSizeLimiter = (maxSize: string = '10mb') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = req.get('content-length');
    
    if (contentLength) {
      const sizeInBytes = parseInt(contentLength);
      const maxSizeInBytes = parseSize(maxSize);
      
      if (sizeInBytes > maxSizeInBytes) {
        logger.warn('Request size limit exceeded', {
          ip: req.ip,
          path: req.path,
          contentLength: sizeInBytes,
          maxSize: maxSizeInBytes
        });
        
        return res.status(413).json({
          success: false,
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: 'Request entity too large'
          },
          timestamp: new Date().toISOString()
        });
      }
    }
    
    next();
  };
};

// Helper function to parse size strings (e.g., '10mb', '1gb')
function parseSize(size: string): number {
  const units: Record<string, number> = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024
  };
  
  const match = size.toLowerCase().match(/^(\d+)(\w+)$/);
  if (!match) return 10 * 1024 * 1024; // Default 10MB
  
  const [, num, unit] = match;
  return parseInt(num) * (units[unit] || 1);
}

// Content-Type validation middleware
export const validateContentType = (allowedTypes: string[] = ['application/json']) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (['GET', 'HEAD', 'DELETE'].includes(req.method)) {
      return next(); // Skip validation for methods without body
    }
    
    const contentType = req.get('content-type');
    
    if (!contentType) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CONTENT_TYPE',
          message: 'Content-Type header is required'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    const isAllowed = allowedTypes.some(type => contentType.includes(type));
    
    if (!isAllowed) {
      logger.warn('Invalid content type', {
        ip: req.ip,
        path: req.path,
        contentType,
        allowedTypes
      });
      
      return res.status(415).json({
        success: false,
        error: {
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: `Content-Type must be one of: ${allowedTypes.join(', ')}`
        },
        timestamp: new Date().toISOString()
      });
    }
    
    next();
  };
};

// HTTP method validation middleware
export const validateHttpMethod = (allowedMethods: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!allowedMethods.includes(req.method)) {
      logger.warn('Invalid HTTP method', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        allowedMethods
      });
      
      return res.status(405).json({
        success: false,
        error: {
          code: 'METHOD_NOT_ALLOWED',
          message: `Method ${req.method} not allowed`
        },
        timestamp: new Date().toISOString()
      });
    }
    
    next();
  };
};

// Security headers middleware (additional to Helmet)
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  // Add custom security headers
  res.setHeader('X-API-Version', '1.0');
  res.setHeader('X-Request-ID', req.headers['x-request-id'] || crypto.randomUUID());
  
  // Prevent caching of sensitive endpoints
  if (req.path.startsWith('/api/auth') || req.path.startsWith('/api/admin')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
  
  next();
};

// CSRF protection middleware (basic implementation)
export const csrfProtection = (req: Request, res: Response, next: NextFunction): void => {
  // Skip CSRF protection for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Skip for API endpoints with proper authentication
  if (req.headers.authorization?.startsWith('Bearer ')) {
    return next();
  }
  
  const origin = req.get('origin');
  const referer = req.get('referer');
  const host = req.get('host');
  
  // In production, enforce same-origin policy
  if (process.env.NODE_ENV === 'production') {
    const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [];
    
    if (origin && !allowedOrigins.includes(origin)) {
      logger.warn('CSRF: Invalid origin', {
        ip: req.ip,
        path: req.path,
        origin,
        allowedOrigins
      });
      
      return res.status(403).json({
        success: false,
        error: {
          code: 'CSRF_INVALID_ORIGIN',
          message: 'Invalid origin for cross-site request'
        },
        timestamp: new Date().toISOString()
      });
    }
  }
  
  next();
};

// Request logging for security monitoring
export const securityLogging = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  
  // Log security-relevant request information
  logger.info('Security: Request received', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    origin: req.get('Origin'),
    referer: req.get('Referer'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    timestamp: new Date().toISOString()
  });
  
  // Override res.json to log response information
  const originalJson = res.json;
  res.json = function(body: any) {
    const responseTime = Date.now() - startTime;
    
    // Log security events
    if (res.statusCode >= 400) {
      logger.warn('Security: Error response', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        statusCode: res.statusCode,
        responseTime,
        errorCode: body?.error?.code
      });
    }
    
    // Log successful authentication events
    if (req.path.includes('/auth/login') && res.statusCode === 200) {
      logger.info('Security: Successful authentication', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
    }
    
    return originalJson.call(this, body);
  };
  
  next();
};

// Account lockout tracking
interface LoginAttempt {
  count: number;
  lastAttempt: number;
  lockoutUntil?: number;
}

const loginAttempts = new Map<string, LoginAttempt>();

export const accountLockout = {
  // Track failed login attempt
  recordFailedAttempt: (identifier: string): void => {
    const attempt = loginAttempts.get(identifier) || { count: 0, lastAttempt: 0 };
    const now = Date.now();
    const resetWindow = 15 * 60 * 1000; // 15 minutes
    
    // Reset count if outside reset window
    if (now - attempt.lastAttempt > resetWindow) {
      attempt.count = 1;
    } else {
      attempt.count += 1;
    }
    
    attempt.lastAttempt = now;
    
    // Implement progressive lockout
    const maxAttempts = process.env.NODE_ENV === 'production' ? 5 : 10;
    if (attempt.count >= maxAttempts) {
      const lockoutDuration = Math.min(30 * 60 * 1000 * Math.pow(2, attempt.count - maxAttempts), 24 * 60 * 60 * 1000);
      attempt.lockoutUntil = now + lockoutDuration;
      
      logger.warn('Account locked due to repeated failed attempts', {
        identifier,
        attempts: attempt.count,
        lockoutUntil: new Date(attempt.lockoutUntil).toISOString()
      });
    }
    
    loginAttempts.set(identifier, attempt);
  },
  
  // Check if account is locked
  isLocked: (identifier: string): boolean => {
    const attempt = loginAttempts.get(identifier);
    if (!attempt?.lockoutUntil) return false;
    
    const now = Date.now();
    if (now < attempt.lockoutUntil) {
      return true;
    }
    
    // Clear lockout if expired
    delete attempt.lockoutUntil;
    attempt.count = 0;
    loginAttempts.set(identifier, attempt);
    
    return false;
  },
  
  // Clear attempts on successful login
  clearAttempts: (identifier: string): void => {
    loginAttempts.delete(identifier);
  },
  
  // Get remaining lockout time
  getLockoutTime: (identifier: string): number => {
    const attempt = loginAttempts.get(identifier);
    if (!attempt?.lockoutUntil) return 0;
    
    return Math.max(0, attempt.lockoutUntil - Date.now());
  }
};

// Middleware to check account lockout
export const checkAccountLockout = (identifierField: string = 'email') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const identifier = req.body[identifierField] || req.ip;
    
    if (accountLockout.isLocked(identifier)) {
      const remainingTime = accountLockout.getLockoutTime(identifier);
      const remainingMinutes = Math.ceil(remainingTime / (60 * 1000));
      
      logger.warn('Blocked request to locked account', {
        identifier,
        ip: req.ip,
        remainingMinutes
      });
      
      return res.status(429).json({
        success: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: `Account temporarily locked. Try again in ${remainingMinutes} minutes.`,
          retryAfter: remainingMinutes * 60
        },
        timestamp: new Date().toISOString()
      });
    }
    
    next();
  };
};

// Export the account lockout utilities for use in auth controllers
export { accountLockout as accountLockoutUtils };
