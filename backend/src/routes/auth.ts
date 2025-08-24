// Authentication routes following Express.js documentation patterns
import { Router } from 'express';
import { body } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { UserRepository } from '@/models/UserRepository';
import { AuthService } from '@/services/AuthService';
import { JWTUtils } from '@/utils/jwt';
import { validate } from '@/middleware/validation';
import { authMiddleware } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/errorHandler';
import { AuthenticationError } from '@/utils/errors';
import { logger } from '@/utils/logger';

const router = Router();
const userRepository = new UserRepository();
const authService = new AuthService(userRepository);
const jwtUtils = new JWTUtils();

// POST /api/auth/login - User login
router.post('/login',
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
    validate
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const result = await authService.login({ email, password });

    if (!result.success) {
      throw new AuthenticationError(result.error);
    }

    logger.info('User login successful', { 
      userId: result.data.user.id, 
      email: result.data.user.email,
      ip: req.ip
    });

    res.json({
      success: true,
      data: result.data,
      timestamp: new Date().toISOString()
    });
  })
);

// POST /api/auth/refresh - Refresh access token
router.post('/refresh',
  [
    body('refreshToken')
      .notEmpty()
      .withMessage('Refresh token is required'),
    validate
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    const result = await authService.refreshToken(refreshToken);

    if (!result.success) {
      throw new AuthenticationError(result.error);
    }

    logger.debug('Token refresh successful');

    res.json({
      success: true,
      data: result.data,
      timestamp: new Date().toISOString()
    });
  })
);

// POST /api/auth/logout - User logout
router.post('/logout',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const token = jwtUtils.extractTokenFromBearer(authHeader);

    if (token) {
      const result = await authService.logout(token);
      
      if (!result.success) {
        logger.warn('Logout failed', { error: result.error, userId: req.user?.id });
      }
    }

    logger.info('User logout successful', { userId: req.user?.id });

    res.json({
      success: true,
      message: 'Logged out successfully',
      timestamp: new Date().toISOString()
    });
  })
);

// GET /api/auth/verify - Verify current token and get user info
router.get('/verify',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    // User is already available from authMiddleware
    res.json({
      success: true,
      data: {
        user: req.user
      },
      timestamp: new Date().toISOString()
    });
  })
);

// GET /api/auth/me - Get current user profile (alias for verify)
router.get('/me',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        user: req.user
      },
      timestamp: new Date().toISOString()
    });
  })
);

export default router;