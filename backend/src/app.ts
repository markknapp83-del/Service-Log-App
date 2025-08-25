// Main Express application following Express.js documentation patterns
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { logger } from '@/utils/logger';
import { HIPAALogger } from '@/utils/hipaa-compliance';
import { errorHandler } from '@/middleware/errorHandler';
import { initializeSchema } from '@/database/schema';
import { migrator } from '@/database/migrate';
import { 
  createRateLimiter,
  createRoleBasedRateLimiter,
  slowDownMiddleware,
  sanitizeInput,
  requestSizeLimiter,
  validateContentType,
  validateHttpMethod,
  securityHeaders,
  csrfProtection,
  securityLogging
} from '@/middleware/security';
import { DatabaseAuditLogger, SecureDatabaseConnection } from '@/utils/database-security';

async function createApp() {
  const app = express();

  // Initialize security utilities
  DatabaseAuditLogger.initialize(process.env.AUDIT_DB_PATH || './audit.db');

  // Initialize database schema
  await initializeSchema();
  
  // Apply any pending database migrations for performance optimizations
  try {
    await migrator.migrate();
    logger.info('Database initialized and performance migrations applied');
  } catch (error) {
    logger.error('Failed to apply database migrations', { error });
    throw error;
  }
  
  // Temporarily disable seeding due to datatype issues
  // const { seedDatabase } = await import('@/database/seed');
  // await seedDatabase();

  // Security logging (must be first to capture all requests)
  app.use(securityLogging);

  // Enhanced security headers with Helmet
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        childSrc: ["'none'"],
        workerSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: [],
      }
    } : false,
    crossOriginEmbedderPolicy: false,
    hsts: process.env.NODE_ENV === 'production' ? {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    } : false
  }));

  // Additional security headers
  app.use(securityHeaders);
  // Enhanced CORS configuration with ngrok support for demos
  app.use(cors({
    origin: process.env.NODE_ENV === 'development' 
      ? (origin, callback) => {
          // Allow localhost origins and ngrok tunnels in development
          if (!origin || 
              origin.startsWith('http://localhost:') || 
              origin.startsWith('https://localhost:') ||
              origin.includes('ngrok-free.app') ||
              origin.includes('ngrok.app') ||
              origin.includes('ngrok.io')) {
            callback(null, true);
          } else {
            HIPAALogger.warn('CORS: Blocked unauthorized origin', { origin });
            callback(new Error('Not allowed by CORS'));
          }
        }
      : (origin, callback) => {
          const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
          const allowedOrigins = typeof corsOrigin === 'string' ? corsOrigin.split(',') : ['http://localhost:3000'];
          
          // Also allow ngrok domains in production for demos
          const isNgrokDomain = origin && (
            origin.includes('ngrok-free.app') ||
            origin.includes('ngrok.app') ||
            origin.includes('ngrok.io')
          );
          
          if (!origin || allowedOrigins.includes(origin) || isNgrokDomain) {
            callback(null, true);
          } else {
            HIPAALogger.warn('CORS: Production origin blocked', { origin, allowedOrigins });
            callback(new Error('Not allowed by CORS'));
          }
        },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Remaining'],
    optionsSuccessStatus: 200,
    maxAge: 86400 // Cache preflight for 24 hours
  }));

  // Progressive request slowing for suspicious activity
  app.use(slowDownMiddleware);

  // Enhanced rate limiting for API protection
  const generalLimiter = createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    process.env.NODE_ENV === 'production' ? 100 : 50000, // Much higher for development
    'Too many requests from this IP, please try again later.'
  );
  app.use('/api', generalLimiter);

  // Role-based rate limiting (applied after authentication)
  const roleBasedLimiter = createRoleBasedRateLimiter();
  app.use('/api', roleBasedLimiter);

  // Request size validation
  app.use(requestSizeLimiter('10mb'));

  // Content-Type validation
  app.use('/api', validateContentType(['application/json']));

  // HTTP method validation for security
  app.use(validateHttpMethod(['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD']));

  // CSRF protection
  app.use(csrfProtection);

  // Body parsing with security considerations
  app.use(express.json({ 
    limit: '10mb',
    strict: true,
    type: 'application/json'
  }));
  app.use(express.urlencoded({ 
    extended: true,
    limit: '10mb',
    parameterLimit: 20
  }));

  // Input sanitization (must be after body parsing)
  app.use(sanitizeInput);

  // Initialize application monitoring
  const { applicationMonitor, monitoringMiddleware } = await import('@/utils/applicationMonitor');
  app.use(monitoringMiddleware);

  // Enhanced logging middleware with HIPAA compliance
  app.use((req, res, next) => {
    HIPAALogger.info('Request received', {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
    next();
  });

  // Basic health check endpoint (kept for backward compatibility)
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
  const monitoringRoutes = await import('@/routes/monitoring');
  const clientLogsRoutes = await import('@/routes/clientLogs');
  const healthCheckRoutes = await import('@/routes/healthCheck');

  // Comprehensive health check routes
  app.use('/api/health', healthCheckRoutes.default);

  // Enhanced rate limiting for authentication endpoints
  const authLimiter = createRateLimiter(
    15 * 60 * 1000, // 15 minutes  
    process.env.NODE_ENV === 'production' ? 5 : 50,
    'Too many authentication attempts, please try again later.',
    (req) => {
      // Rate limit by IP + email for more precise limiting
      const email = req.body?.email;
      return email ? `${req.ip}:${email}` : req.ip || 'unknown';
    }
  );

  // API routes
  app.use('/api/auth', authLimiter, authRoutes.default);
  app.use('/api/admin', adminRoutes.default);
  // Note: /api/custom-fields routes removed in Phase 7.1 cleanup
  app.use('/api/reports', reportsRoutes.default);
  app.use('/api/service-logs', serviceLogRoutes.default);
  app.use('/api/monitoring', monitoringRoutes.default);
  app.use('/api/client-logs', clientLogsRoutes.default);

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

  // Enhanced error handling middleware (must be last)
  app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Log security events
    HIPAALogger.error('Application error', {
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    errorHandler(error, req, res, next);
  });

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
    console.error('Failed to start server:', error);
    logger.error('Failed to start server', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
}

// Start the server
const appPromise = startServer();

// Export the app promise for testing
export default appPromise;