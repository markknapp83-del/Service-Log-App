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
      : (process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000']),
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
  const customFieldRoutes = await import('@/routes/customFields');
  // const serviceLogRoutes = await import('@/routes/serviceLogSimple');

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
  app.use('/api/custom-fields', customFieldRoutes.customFieldRoutes);
  
  // Temporary mock service log endpoints for demo
  app.get('/api/service-logs/options', (req, res) => {
    res.json({
      success: true,
      data: {
        clients: [
          { id: '1', name: 'Downtown Clinic', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
          { id: '2', name: 'Community Health Center', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
          { id: '3', name: 'Regional Hospital', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        ],
        activities: [
          { id: '1', name: 'General Consultation', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
          { id: '2', name: 'Physiotherapy', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
          { id: '3', name: 'Mental Health Counseling', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        ],
        outcomes: [
          { id: '1', name: 'Treatment Completed', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
          { id: '2', name: 'Referred to Specialist', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
          { id: '3', name: 'Follow-up Required', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        ]
      },
      timestamp: new Date().toISOString()
    });
  });

  app.post('/api/service-logs', (req, res) => {
    console.log('Service log submission received:', JSON.stringify(req.body, null, 2));
    res.json({
      success: true,
      data: {
        id: 'service-log-' + Date.now(),
        ...req.body,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  });

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