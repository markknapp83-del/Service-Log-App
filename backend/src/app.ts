// Main Express application following Express.js documentation patterns
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { logger } from '@/utils/logger';
import { errorHandler } from '@/middleware/errorHandler';
import { initializeSchema } from '@/database/schema';

async function createApp() {
  const app = express();

  // Initialize database schema
  await initializeSchema();
  
  // Temporarily disable seeding due to datatype issues
  // const { seedDatabase } = await import('@/database/seed');
  // await seedDatabase();

  // Security middleware
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false
  }));
  app.use(cors({
    origin: process.env.NODE_ENV === 'development' 
      ? (origin, callback) => {
          // Allow any localhost origin in development
          if (!origin || origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:')) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
        }
      : (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200
  }));

  // Rate limiting for API protection
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 100 : 10000, // Very high limit for development
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP, please try again later.'
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api', limiter);

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Logging middleware
  app.use((req, res, next) => {
    logger.info('Request received', {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    next();
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      service: 'healthcare-portal-backend'
    });
  });

  // Import routes
  const authRoutes = await import('@/routes/auth');
  const adminRoutes = await import('@/routes/admin');
  // Note: customFieldRoutes removed in Phase 7.1 cleanup
  const reportsRoutes = await import('@/routes/reports');
  const serviceLogRoutes = await import('@/routes/serviceLog');

  // Rate limiting for authentication endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 5 : 50, // More lenient for development
    message: {
      success: false,
      error: {
        code: 'AUTH_RATE_LIMIT_EXCEEDED',
        message: 'Too many login attempts, please try again later.'
      }
    }
  });

  // API routes
  app.use('/api/auth', authLimiter, authRoutes.default);
  app.use('/api/admin', adminRoutes.default);
  // Note: /api/custom-fields routes removed in Phase 7.1 cleanup
  app.use('/api/reports', reportsRoutes.default);
  app.use('/api/service-logs', serviceLogRoutes.default);

  // 404 handler for undefined routes
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found'
      },
      timestamp: new Date().toISOString()
    });
  });

  // Error handling middleware (must be last)
  app.use(errorHandler);

  return app;
}

// Create and start the app
async function startServer() {
  try {
    const app = await createApp();
    const PORT = process.env.PORT || 3001;

    // Only start server if not in test environment
    if (process.env.NODE_ENV !== 'test') {
      app.listen(PORT, () => {
        logger.info(`Healthcare API server running on port ${PORT}`);
      });
    }

    return app;
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Start the server
const appPromise = startServer();

// Export the app promise for testing
export default appPromise;