# Express.js Documentation for Healthcare Service Log Portal

## Overview
Express.js is a minimal and flexible Node.js web application framework that provides robust features for building healthcare APIs with security, performance, and reliability in mind.

## Basic Setup and Configuration

### Project Setup
```javascript
// app.js - Main application file
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';
import patientRoutes from './routes/patients.js';
import serviceRoutes from './routes/services.js';
import authRoutes from './routes/auth.js';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting for API protection
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
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

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', authMiddleware, patientRoutes);
app.use('/api/services', authMiddleware, serviceRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.info(`Healthcare API server running on port ${PORT}`);
});

export default app;
```

## Routing Patterns

### RESTful API Routes
```javascript
// routes/patients.js
import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validation.js';
import { requireRole } from '../middleware/auth.js';
import * as patientController from '../controllers/patientController.js';

const router = Router();

// GET /api/patients - List patients with pagination and filtering
router.get('/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().isLength({ min: 2, max: 100 }),
    validate
  ],
  patientController.getPatients
);

// GET /api/patients/:id - Get single patient
router.get('/:id',
  [
    param('id').isUUID().withMessage('Invalid patient ID'),
    validate
  ],
  patientController.getPatient
);

// POST /api/patients - Create new patient
router.post('/',
  requireRole(['admin', 'staff']),
  [
    body('firstName').notEmpty().trim().isLength({ min: 2, max: 50 }),
    body('lastName').notEmpty().trim().isLength({ min: 2, max: 50 }),
    body('dateOfBirth').isISO8601().toDate(),
    body('phone').matches(/^\d{10}$/).withMessage('Phone must be 10 digits'),
    body('email').optional().isEmail().normalizeEmail(),
    body('emergencyContact.name').notEmpty().trim(),
    body('emergencyContact.phone').matches(/^\d{10}$/),
    body('emergencyContact.relationship').notEmpty().trim(),
    validate
  ],
  patientController.createPatient
);

// PUT /api/patients/:id - Update patient
router.put('/:id',
  requireRole(['admin', 'staff']),
  [
    param('id').isUUID(),
    body('firstName').optional().trim().isLength({ min: 2, max: 50 }),
    body('lastName').optional().trim().isLength({ min: 2, max: 50 }),
    body('phone').optional().matches(/^\d{10}$/),
    body('email').optional().isEmail().normalizeEmail(),
    validate
  ],
  patientController.updatePatient
);

// DELETE /api/patients/:id - Delete patient (admin only)
router.delete('/:id',
  requireRole(['admin']),
  [
    param('id').isUUID(),
    validate
  ],
  patientController.deletePatient
);

export default router;
```

### Service Entry Routes
```javascript
// routes/services.js
import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validation.js';
import { requireRole } from '../middleware/auth.js';
import * as serviceController from '../controllers/serviceController.js';

const router = Router();

// GET /api/services - List services with filtering
router.get('/',
  [
    query('patientId').optional().isUUID(),
    query('serviceType').optional().isIn(['consultation', 'procedure', 'therapy', 'diagnostic']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('status').optional().isIn(['scheduled', 'in-progress', 'completed', 'cancelled']),
    validate
  ],
  serviceController.getServices
);

// POST /api/services - Create new service entry
router.post('/',
  requireRole(['admin', 'provider', 'staff']),
  [
    body('patientId').isUUID(),
    body('serviceType').isIn(['consultation', 'procedure', 'therapy', 'diagnostic']),
    body('scheduledDate').isISO8601().toDate(),
    body('duration').isInt({ min: 15, max: 480 }), // 15 minutes to 8 hours
    body('notes').optional().trim().isLength({ max: 1000 }),
    body('billing.code').optional().trim().isLength({ min: 3, max: 20 }),
    body('billing.amount').optional().isFloat({ min: 0 }),
    validate
  ],
  serviceController.createService
);

// PUT /api/services/:id/status - Update service status
router.put('/:id/status',
  requireRole(['admin', 'provider']),
  [
    param('id').isUUID(),
    body('status').isIn(['scheduled', 'in-progress', 'completed', 'cancelled']),
    body('notes').optional().trim().isLength({ max: 500 }),
    validate
  ],
  serviceController.updateServiceStatus
);

export default router;
```

## Controllers and Business Logic

### Patient Controller
```javascript
// controllers/patientController.js
import { PatientService } from '../services/PatientService.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/errors.js';

const patientService = new PatientService();

export const getPatients = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    
    const result = await patientService.getPatients({
      page: parseInt(page),
      limit: parseInt(limit),
      search
    });

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};

export const getPatient = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const patient = await patientService.getPatientById(id);
    
    if (!patient) {
      throw new ApiError(404, 'Patient not found');
    }

    res.json({
      success: true,
      data: patient,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};

export const createPatient = async (req, res, next) => {
  try {
    const patientData = req.body;
    
    // Add audit information
    patientData.createdBy = req.user.id;
    
    const patient = await patientService.createPatient(patientData);

    logger.info('Patient created', { 
      patientId: patient.id, 
      createdBy: req.user.id 
    });

    res.status(201).json({
      success: true,
      data: patient,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};

export const updatePatient = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Add audit information
    updateData.updatedBy = req.user.id;
    
    const patient = await patientService.updatePatient(id, updateData);
    
    if (!patient) {
      throw new ApiError(404, 'Patient not found');
    }

    logger.info('Patient updated', { 
      patientId: id, 
      updatedBy: req.user.id 
    });

    res.json({
      success: true,
      data: patient,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};

export const deletePatient = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const deleted = await patientService.deletePatient(id);
    
    if (!deleted) {
      throw new ApiError(404, 'Patient not found');
    }

    logger.info('Patient deleted', { 
      patientId: id, 
      deletedBy: req.user.id 
    });

    res.json({
      success: true,
      message: 'Patient deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
};
```

## Middleware

### Authentication Middleware
```javascript
// middleware/auth.js
import jwt from 'jsonwebtoken';
import { UserService } from '../services/UserService.js';
import { ApiError } from '../utils/errors.js';

const userService = new UserService();

export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'Access token required');
    }

    const token = authHeader.substring(7);
    
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        throw new ApiError(401, 'Token expired');
      }
      throw new ApiError(401, 'Invalid token');
    }

    const user = await userService.getUserById(decoded.userId);
    
    if (!user || !user.isActive) {
      throw new ApiError(401, 'User not found or inactive');
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ApiError(403, 'Insufficient permissions'));
    }

    next();
  };
};
```

### Validation Middleware
```javascript
// middleware/validation.js
import { validationResult } from 'express-validator';
import { ApiError } from '../utils/errors.js';

export const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));

    throw new ApiError(400, 'Validation failed', { errors: errorMessages });
  }
  
  next();
};

// Custom validators for healthcare data
export const customValidators = {
  isValidPatientId: (value) => {
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
  },
  
  isValidServiceType: (value) => {
    const validTypes = ['consultation', 'procedure', 'therapy', 'diagnostic'];
    return validTypes.includes(value);
  },
  
  isValidPhoneNumber: (value) => {
    return /^\d{10}$/.test(value.replace(/\D/g, ''));
  },

  isFutureDate: (value) => {
    return new Date(value) > new Date();
  }
};
```

### Error Handling Middleware
```javascript
// middleware/errorHandler.js
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/errors.js';

export const errorHandler = (error, req, res, next) => {
  let statusCode = 500;
  let message = 'Internal server error';
  let details = {};

  // Handle known error types
  if (error instanceof ApiError) {
    statusCode = error.statusCode;
    message = error.message;
    details = error.details;
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation error';
    details = { validationErrors: error.details };
  } else if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    statusCode = 409;
    message = 'Resource already exists';
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
    user: req.user?.id
  });

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      code: error.code || 'UNKNOWN_ERROR',
      message,
      details: process.env.NODE_ENV === 'development' ? details : {}
    },
    timestamp: new Date().toISOString()
  });
};

// Async error wrapper to catch async errors
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
```

## Security Best Practices

### Input Sanitization
```javascript
// middleware/sanitization.js
import DOMPurify from 'isomorphic-dompurify';
import { escape } from 'html-escaper';

export const sanitizeInput = (req, res, next) => {
  // Sanitize string inputs to prevent XSS
  const sanitizeObject = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = DOMPurify.sanitize(obj[key]);
        obj[key] = escape(obj[key]);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    }
  };

  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);

  next();
};
```

### Rate Limiting Configuration
```javascript
// config/rateLimiting.js
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

// General API rate limiting
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiting for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per window
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many login attempts, please try again later.'
    }
  }
});

// Slow down repeated requests
export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 50,
  delayMs: 500
});
```

## Database Integration

### Database Service Pattern
```javascript
// services/DatabaseService.js
import Database from 'better-sqlite3';
import { logger } from '../utils/logger.js';

class DatabaseService {
  constructor() {
    this.db = new Database(process.env.DB_PATH || './healthcare.db');
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    
    // Prepare commonly used statements
    this.prepareStatements();
  }

  prepareStatements() {
    this.statements = {
      // Patient queries
      findPatientById: this.db.prepare(`
        SELECT * FROM patients WHERE id = ? AND deleted_at IS NULL
      `),
      
      findPatientsBySearch: this.db.prepare(`
        SELECT * FROM patients 
        WHERE (first_name LIKE ? OR last_name LIKE ? OR phone LIKE ?)
        AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `),
      
      insertPatient: this.db.prepare(`
        INSERT INTO patients (id, first_name, last_name, date_of_birth, phone, email, emergency_contact, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),
      
      updatePatient: this.db.prepare(`
        UPDATE patients 
        SET first_name = ?, last_name = ?, phone = ?, email = ?, updated_at = ?
        WHERE id = ? AND deleted_at IS NULL
      `),
      
      softDeletePatient: this.db.prepare(`
        UPDATE patients SET deleted_at = ? WHERE id = ?
      `),

      // Service queries
      findServicesByPatient: this.db.prepare(`
        SELECT * FROM services 
        WHERE patient_id = ? AND deleted_at IS NULL
        ORDER BY scheduled_date DESC
      `),
      
      insertService: this.db.prepare(`
        INSERT INTO services (id, patient_id, service_type, provider_id, scheduled_date, duration, status, notes, billing_code, billing_amount, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),
      
      updateServiceStatus: this.db.prepare(`
        UPDATE services 
        SET status = ?, notes = ?, updated_at = ?
        WHERE id = ? AND deleted_at IS NULL
      `)
    };
  }

  // Transaction wrapper
  transaction(callback) {
    const txn = this.db.transaction(callback);
    return txn;
  }

  close() {
    this.db.close();
  }
}

export const dbService = new DatabaseService();
```

## Testing Patterns

### API Testing Setup
```javascript
// tests/setup.js
import { jest } from '@jest/globals';
import Database from 'better-sqlite3';
import app from '../app.js';

// Setup test database
export const setupTestDb = () => {
  const testDb = new Database(':memory:');
  
  // Create tables
  testDb.exec(`
    CREATE TABLE patients (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      date_of_birth TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      email TEXT,
      emergency_contact TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE TABLE services (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      service_type TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      scheduled_date TEXT NOT NULL,
      duration INTEGER NOT NULL,
      status TEXT DEFAULT 'scheduled',
      notes TEXT,
      billing_code TEXT,
      billing_amount REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      FOREIGN KEY (patient_id) REFERENCES patients (id)
    );
  `);

  return testDb;
};

// Test data factories
export const createTestPatient = (overrides = {}) => ({
  id: `patient-${Date.now()}`,
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '1985-01-15',
  phone: '5551234567',
  email: 'john.doe@example.com',
  emergencyContact: JSON.stringify({
    name: 'Jane Doe',
    phone: '5551234568',
    relationship: 'spouse'
  }),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

export const createTestService = (patientId, overrides = {}) => ({
  id: `service-${Date.now()}`,
  patientId,
  serviceType: 'consultation',
  providerId: 'provider-123',
  scheduledDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
  duration: 60,
  status: 'scheduled',
  notes: 'Test service',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});
```

### API Endpoint Tests
```javascript
// tests/api/patients.test.js
import request from 'supertest';
import { jest } from '@jest/globals';
import app from '../../app.js';
import { setupTestDb, createTestPatient } from '../setup.js';

describe('Patient API', () => {
  let testDb;
  let authToken;

  beforeAll(async () => {
    testDb = setupTestDb();
    
    // Get auth token for testing
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'testuser',
        password: 'testpassword'
      });
    
    authToken = loginResponse.body.data.token;
  });

  afterAll(() => {
    testDb.close();
  });

  describe('GET /api/patients', () => {
    test('should return paginated patients list', async () => {
      // Create test patients
      const patient1 = createTestPatient({ firstName: 'Alice' });
      const patient2 = createTestPatient({ firstName: 'Bob' });
      
      // Insert test data
      testDb.prepare(`INSERT INTO patients VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(Object.values(patient1));
      testDb.prepare(`INSERT INTO patients VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(Object.values(patient2));

      const response = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.patients).toHaveLength(2);
      expect(response.body.data.total).toBe(2);
    });

    test('should filter patients by search term', async () => {
      const response = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ search: 'Alice' })
        .expect(200);

      expect(response.body.data.patients).toHaveLength(1);
      expect(response.body.data.patients[0].firstName).toBe('Alice');
    });
  });

  describe('POST /api/patients', () => {
    test('should create new patient with valid data', async () => {
      const patientData = {
        firstName: 'Jane',
        lastName: 'Smith',
        dateOfBirth: '1990-05-15',
        phone: '5559876543',
        email: 'jane.smith@example.com',
        emergencyContact: {
          name: 'John Smith',
          phone: '5559876544',
          relationship: 'spouse'
        }
      };

      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(patientData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.firstName).toBe('Jane');
      expect(response.body.data.id).toBeDefined();
    });

    test('should return validation error for invalid data', async () => {
      const invalidData = {
        firstName: '', // Empty first name
        lastName: 'Smith',
        phone: '123' // Invalid phone
      };

      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.details.errors).toBeDefined();
    });
  });
});
```

## Performance Optimization

### Caching Strategy
```javascript
// middleware/cache.js
import NodeCache from 'node-cache';

const cache = new NodeCache({ 
  stdTTL: 300, // 5 minutes default TTL
  checkperiod: 60 // Check for expired keys every minute
});

export const cacheMiddleware = (ttl = 300) => {
  return (req, res, next) => {
    const key = req.originalUrl;
    const cachedResponse = cache.get(key);

    if (cachedResponse) {
      return res.json(cachedResponse);
    }

    // Override res.json to cache the response
    const originalJson = res.json;
    res.json = function(body) {
      if (res.statusCode === 200) {
        cache.set(key, body, ttl);
      }
      return originalJson.call(this, body);
    };

    next();
  };
};

// Clear cache when data changes
export const clearCachePattern = (pattern) => {
  const keys = cache.keys();
  keys.forEach(key => {
    if (key.includes(pattern)) {
      cache.del(key);
    }
  });
};
```

## Production Configuration

### Environment Configuration
```javascript
// config/environment.js
export const config = {
  development: {
    port: 3001,
    dbPath: './dev.db',
    logLevel: 'debug',
    corsOrigins: ['http://localhost:3000'],
    jwtExpiry: '24h'
  },
  
  production: {
    port: process.env.PORT || 8080,
    dbPath: process.env.DB_PATH,
    logLevel: 'info',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || [],
    jwtExpiry: '1h'
  },
  
  test: {
    port: 0, // Use random port for tests
    dbPath: ':memory:',
    logLevel: 'error',
    corsOrigins: ['*'],
    jwtExpiry: '1h'
  }
};

export const getConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  return config[env];
};
```

## Common Patterns and Best Practices

1. **Error Handling**: Always use try-catch with async functions
2. **Validation**: Validate all inputs before processing
3. **Authentication**: Protect all sensitive endpoints
4. **Logging**: Log important events and errors
5. **Security**: Use helmet, CORS, rate limiting
6. **Testing**: Test all endpoints and middleware
7. **Performance**: Use caching and database optimization
8. **Monitoring**: Implement health checks and metrics

## Resources
- [Express.js Official Documentation](https://expressjs.com/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)