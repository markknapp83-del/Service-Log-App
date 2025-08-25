// Authentication middleware following Express.js documentation patterns
import { Request, Response, NextFunction } from 'express';
import { UserRepository } from '@/models/UserRepository';
import { AuthService } from '@/services/AuthService';
import { JWTUtils } from '@/utils/jwt';
import { AuthenticationError, AuthorizationError } from '@/utils/errors';
import { UserRole } from '@/types/index';
import { logger } from '@/utils/logger';

const userRepository = new UserRepository();
const authService = new AuthService(userRepository);
const jwtUtils = new JWTUtils();

export const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Access token required');
    }

    const token = jwtUtils.extractTokenFromBearer(authHeader);
    if (!token) {
      throw new AuthenticationError('Invalid token format');
    }

    // Verify token and get user
    const result = await authService.verifyToken(token);
    
    if (!result.success) {
      if (result.error === 'Token expired') {
        throw new AuthenticationError('Token expired');
      } else if (result.error === 'Invalid token') {
        throw new AuthenticationError('Invalid token');
      } else {
        throw new AuthenticationError('Authentication failed');
      }
    }

    // Add user to request object
    req.user = result.data;
    next();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      logger.debug('Authentication failed', { error: error.message, url: req.url });
    } else {
      logger.error('Unexpected error in auth middleware', { error, url: req.url });
    }
    next(error);
  }
};

export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Insufficient permissions', { 
        userId: req.user.id, 
        userRole: req.user.role, 
        requiredRoles: allowedRoles,
        url: req.url
      });
      return next(new AuthorizationError('Insufficient permissions'));
    }

    next();
  };
};

// Optional auth middleware - doesn't throw error if no token provided
export const optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = jwtUtils.extractTokenFromBearer(authHeader);
    if (!token) {
      return next();
    }

    // Verify token and get user
    const result = await authService.verifyToken(token);
    
    if (result.success) {
      req.user = result.data;
    }
    
    next();
  } catch (error) {
    // For optional auth, we don't fail the request
    logger.debug('Optional auth failed', { error, url: req.url });
    next();
  }
};

// Convenience aliases
export const authenticateToken = authMiddleware;
export const adminOnly = requireRole(['admin']);