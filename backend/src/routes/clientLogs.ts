// Client-Side Error Logging API Routes
// Following Express.js patterns from devdocs/express.md for comprehensive error handling
import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken, optionalAuth } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/errorHandler';
import { HealthcareLogger } from '@/utils/logger';
import { HIPAALogger } from '@/utils/hipaa-compliance';
import { AlertSystem } from '@/utils/alertSystem';
import { rateLimit } from 'express-rate-limit';

const router = Router();

// Rate limiting for client error reports (more permissive to avoid losing critical errors)
const clientErrorLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // Allow up to 50 error reports per 5 minutes per IP
  message: {
    success: false,
    error: {
      code: 'CLIENT_ERROR_RATE_LIMIT',
      message: 'Too many error reports from this client'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Allow through critical errors even if rate limited
  skip: (req) => {
    return req.body?.error?.context?.level === 'critical';
  }
});

// Critical error rate limiting (very permissive to ensure critical errors are logged)
const criticalErrorLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Allow up to 10 critical errors per minute
  message: {
    success: false,
    error: {
      code: 'CRITICAL_ERROR_RATE_LIMIT',
      message: 'Too many critical errors reported'
    }
  }
});

// Validation schemas for error reporting
const errorValidation = [
  body('errors').optional().isArray().withMessage('Errors must be an array'),
  body('errors.*.id').isString().withMessage('Error ID must be a string'),
  body('errors.*.timestamp').isISO8601().withMessage('Timestamp must be valid ISO8601'),
  body('errors.*.error.message').isString().isLength({ max: 1000 }).withMessage('Error message must be string, max 1000 chars'),
  body('errors.*.error.name').isString().withMessage('Error name must be a string'),
  body('errors.*.context.level').isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid error level'),
  body('errors.*.context.category').isIn(['ui', 'network', 'validation', 'security', 'healthcare']).withMessage('Invalid error category'),
  body('interactions').optional().isArray().withMessage('Interactions must be an array'),
  body('timestamp').isISO8601().withMessage('Timestamp must be valid ISO8601')
];

const criticalErrorValidation = [
  body('error.id').isString().withMessage('Error ID must be a string'),
  body('error.timestamp').isISO8601().withMessage('Timestamp must be valid ISO8601'),
  body('error.error.message').isString().isLength({ max: 1000 }).withMessage('Error message must be string, max 1000 chars'),
  body('error.context.level').equals('critical').withMessage('Must be critical error'),
  body('error.context.category').isIn(['ui', 'network', 'validation', 'security', 'healthcare']).withMessage('Invalid error category'),
  body('timestamp').isISO8601().withMessage('Timestamp must be valid ISO8601')
];

// POST /api/client-logs - Batch client error reporting
router.post('/', 
  clientErrorLimiter,
  optionalAuth, // Optional auth - errors can be reported even without authentication
  errorValidation,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid error report format',
          details: errors.array()
        }
      });
    }

    const { errors: clientErrors = [], interactions = [], timestamp } = req.body;
    const clientInfo = {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      userRole: req.user?.role,
      reportedAt: timestamp
    };

    let processedErrors = 0;
    let criticalErrors = 0;
    let securityEvents = 0;
    let healthcareIssues = 0;

    // Process each client error
    for (const clientError of clientErrors) {
      try {
        await processClientError(clientError, clientInfo);
        processedErrors++;

        // Count error types
        if (clientError.context.level === 'critical') {
          criticalErrors++;
        }
        
        if (clientError.context.category === 'security') {
          securityEvents++;
        }
        
        if (clientError.context.category === 'healthcare' || 
            clientError.healthcareContext?.hasPatientData) {
          healthcareIssues++;
        }

      } catch (processingError) {
        HealthcareLogger.error('Failed to process client error', {
          clientErrorId: clientError.id,
          processingError: processingError instanceof Error ? processingError.message : 'Unknown error',
          clientInfo
        });
      }
    }

    // Process user interactions for error analysis
    let processedInteractions = 0;
    for (const interaction of interactions) {
      try {
        await processUserInteraction(interaction, clientInfo);
        processedInteractions++;
      } catch (processingError) {
        HealthcareLogger.warn('Failed to process user interaction', {
          interaction: interaction.event,
          processingError: processingError instanceof Error ? processingError.message : 'Unknown error'
        });
      }
    }

    // Send alerts for significant error patterns
    if (criticalErrors > 0) {
      await AlertSystem.sendAlert('client_critical_errors', {
        criticalCount: criticalErrors,
        totalErrors: processedErrors,
        userId: clientInfo.userId,
        userAgent: clientInfo.userAgent
      }, `${criticalErrors} critical client-side errors reported`);
    }

    if (securityEvents > 2) {
      await AlertSystem.sendAlert('client_security_events', {
        securityEventCount: securityEvents,
        totalErrors: processedErrors,
        userId: clientInfo.userId
      }, `Multiple security-related client errors detected`);
    }

    if (healthcareIssues > 0) {
      await AlertSystem.sendAlert('healthcare_client_errors', {
        healthcareIssueCount: healthcareIssues,
        totalErrors: processedErrors,
        userId: clientInfo.userId
      }, `Healthcare-related client errors reported`);
    }

    // Log batch processing summary
    HealthcareLogger.info('Client error batch processed', {
      category: 'client-errors',
      processedErrors,
      processedInteractions,
      criticalErrors,
      securityEvents,
      healthcareIssues,
      clientInfo
    });

    res.json({
      success: true,
      data: {
        processedErrors,
        processedInteractions,
        criticalErrors,
        securityEvents,
        healthcareIssues,
        timestamp: new Date().toISOString()
      }
    });
  })
);

// POST /api/client-logs/critical - Immediate critical error reporting
router.post('/critical', 
  criticalErrorLimiter,
  optionalAuth,
  criticalErrorValidation,
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid critical error format',
          details: errors.array()
        }
      });
    }

    const { error: clientError, timestamp } = req.body;
    const clientInfo = {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      userRole: req.user?.role,
      reportedAt: timestamp,
      immediate: true
    };

    try {
      await processClientError(clientError, clientInfo);

      // Immediate alert for critical errors
      await AlertSystem.sendAlert('critical_client_error', {
        errorId: clientError.id,
        errorMessage: clientError.error.message,
        category: clientError.context.category,
        hasPatientData: clientError.healthcareContext?.hasPatientData,
        userId: clientInfo.userId,
        page: clientError.context.page
      }, `Critical client-side error: ${clientError.error.message}`);

      HealthcareLogger.error('Critical client error processed immediately', {
        category: 'critical-client-error',
        errorId: clientError.id,
        errorCategory: clientError.context.category,
        clientInfo
      });

      res.json({
        success: true,
        data: {
          processed: true,
          errorId: clientError.id,
          alertSent: true,
          timestamp: new Date().toISOString()
        }
      });

    } catch (processingError) {
      HealthcareLogger.error('Failed to process critical client error', {
        clientErrorId: clientError.id,
        processingError: processingError instanceof Error ? processingError.message : 'Unknown error',
        clientInfo
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'PROCESSING_ERROR',
          message: 'Failed to process critical error',
          errorId: clientError.id
        }
      });
    }
  })
);

// GET /api/client-logs/statistics - Get client error statistics (admin only)
router.get('/statistics',
  authenticateToken,
  asyncHandler(async (req, res) => {
    // This would typically query a database for stored client errors
    // For now, return mock statistics
    const stats = {
      last24Hours: {
        totalErrors: 0,
        criticalErrors: 0,
        errorsByCategory: {
          ui: 0,
          network: 0,
          validation: 0,
          security: 0,
          healthcare: 0
        },
        topErrors: [],
        affectedUsers: 0
      },
      trends: {
        errorRate: 'stable',
        criticalTrend: 'decreasing',
        mostProblematicPage: 'dashboard'
      }
    };

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  })
);

// Helper function to process individual client errors
async function processClientError(clientError: any, clientInfo: any): Promise<void> {
  const enhancedError = {
    ...clientError,
    clientInfo,
    processedAt: new Date().toISOString(),
    serverContext: {
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version
    }
  };

  // Determine logging level based on error severity
  const logLevel = clientError.context.level === 'critical' ? 'error' :
                   clientError.context.level === 'high' ? 'warn' : 'info';

  // Log with healthcare compliance
  HIPAALogger[logLevel](`Client ${clientError.context.level} error`, {
    category: 'client-error',
    errorId: clientError.id,
    errorType: clientError.error.name,
    errorMessage: clientError.error.message,
    errorCategory: clientError.context.category,
    errorLevel: clientError.context.level,
    page: clientError.context.page,
    component: clientError.context.component,
    userId: clientInfo.userId,
    userRole: clientInfo.userRole,
    hasPatientData: clientError.healthcareContext?.hasPatientData,
    activeForm: clientError.healthcareContext?.activeForm,
    dataType: clientError.healthcareContext?.dataType,
    recovery: clientError.recovery,
    clientInfo: {
      userAgent: clientInfo.userAgent,
      viewport: clientError.environment.viewport,
      timestamp: clientError.timestamp
    }
  });

  // Special handling for healthcare-related errors
  if (clientError.context.category === 'healthcare' || 
      clientError.healthcareContext?.hasPatientData) {
    
    HealthcareLogger.auditLog(
      'client_healthcare_error',
      clientError.healthcareContext?.dataType || 'unknown',
      clientInfo.userId || 'anonymous',
      {
        errorId: clientError.id,
        errorMessage: clientError.error.message,
        page: clientError.context.page,
        hasPatientData: clientError.healthcareContext?.hasPatientData,
        activeForm: clientError.healthcareContext?.activeForm
      }
    );
  }

  // Special handling for security errors
  if (clientError.context.category === 'security') {
    HealthcareLogger.securityLog(
      'client_security_error',
      clientError.context.level,
      {
        errorId: clientError.id,
        errorMessage: clientError.error.message,
        page: clientError.context.page,
        userId: clientInfo.userId,
        userAgent: clientInfo.userAgent,
        ip: clientInfo.ip
      }
    );
  }
}

// Helper function to process user interactions
async function processUserInteraction(interaction: any, clientInfo: any): Promise<void> {
  HealthcareLogger.info('Client user interaction', {
    category: 'user-interaction',
    event: interaction.event,
    page: interaction.context.page,
    component: interaction.context.component,
    userId: clientInfo.userId,
    timestamp: interaction.timestamp,
    data: interaction.data
  });

  // Track healthcare-specific interactions
  if (interaction.event.includes('patient') || 
      interaction.event.includes('healthcare') ||
      interaction.event.includes('service')) {
    
    HealthcareLogger.auditLog(
      `client_${interaction.event}`,
      'user_interaction',
      clientInfo.userId || 'anonymous',
      {
        page: interaction.context.page,
        component: interaction.context.component,
        interactionData: interaction.data
      }
    );
  }
}

export default router;