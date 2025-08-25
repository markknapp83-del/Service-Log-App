// Enhanced Logger utility following Express.js documentation patterns with healthcare-specific features
import winston from 'winston';
import path from 'path';
import fs from 'fs';

const logLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
const logDir = process.env.LOG_DIR || 'logs';

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Custom log format with correlation ID and healthcare context
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, correlationId, userId, healthcareContext, ...meta }) => {
    const baseInfo: any = {
      timestamp,
      level: level.toUpperCase(),
      message,
      service: 'healthcare-portal'
    };

    if (correlationId) baseInfo.correlationId = correlationId;
    if (userId) baseInfo.userId = userId;
    if (healthcareContext) baseInfo.healthcareContext = healthcareContext;

    return JSON.stringify({ ...baseInfo, ...meta });
  })
);

// Production log format (structured JSON)
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Development console format (readable)
const developmentFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, correlationId, userId, ...meta }) => {
    let logMessage = `${timestamp} [${level}] ${message}`;
    if (correlationId) logMessage += ` [ID: ${correlationId.substring(0, 8)}]`;
    if (userId) logMessage += ` [User: ${userId}]`;
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta, null, 2)}`;
    }
    return logMessage;
  })
);

// Create transports based on environment
const transports: winston.transport[] = [];

// Console transport for all environments
transports.push(
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'production' ? productionFormat : developmentFormat
  })
);

// File transports for non-test environments
if (process.env.NODE_ENV !== 'test') {
  // Error log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: logFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    })
  );

  // Combined log file
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: logFormat,
      maxsize: 50 * 1024 * 1024, // 50MB
      maxFiles: 10,
      tailable: true
    })
  );

  // Security audit log (separate file for compliance)
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'security-audit.log'),
      level: 'warn',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
        winston.format.printf((info: any) => {
          // Only log security-related events
          if (info.category === 'security' || info.securityEvent) {
            return JSON.stringify(info);
          }
          return '';
        })
      ),
      maxsize: 20 * 1024 * 1024, // 20MB
      maxFiles: 20, // Keep more security logs
      tailable: true
    })
  );

  // Performance monitoring log
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'performance.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
        winston.format.printf((info: any) => {
          // Only log performance-related events
          if (info.performanceMetrics || info.responseTime || info.category === 'performance') {
            return JSON.stringify(info);
          }
          return '';
        })
      ),
      maxsize: 100 * 1024 * 1024, // 100MB
      maxFiles: 5,
      tailable: true
    })
  );
}

export const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: { 
    service: 'healthcare-portal',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  },
  transports,
  exitOnError: false
});

// Enhanced logging functions with healthcare context
export const HealthcareLogger = {
  // Standard logging with automatic correlation ID
  info: (message: string, meta: Record<string, unknown> = {}) => {
    logger.info(message, { ...meta, timestamp: new Date().toISOString() });
  },

  warn: (message: string, meta: Record<string, unknown> = {}) => {
    logger.warn(message, { ...meta, timestamp: new Date().toISOString() });
  },

  error: (message: string, meta: Record<string, unknown> = {}) => {
    logger.error(message, { ...meta, timestamp: new Date().toISOString() });
  },

  // Healthcare-specific logging
  auditLog: (action: string, resource: string, userId: string, meta: Record<string, unknown> = {}) => {
    logger.info('Healthcare audit event', {
      category: 'audit',
      action,
      resource,
      userId,
      timestamp: new Date().toISOString(),
      ...meta
    });
  },

  performanceLog: (operation: string, duration: number, meta: Record<string, unknown> = {}) => {
    logger.info('Performance measurement', {
      category: 'performance',
      operation,
      duration,
      timestamp: new Date().toISOString(),
      ...meta
    });
  },

  securityLog: (event: string, severity: 'low' | 'medium' | 'high' | 'critical', meta: Record<string, unknown> = {}) => {
    const logLevel = severity === 'critical' ? 'error' : severity === 'high' ? 'warn' : 'info';
    logger[logLevel]('Security event', {
      category: 'security',
      securityEvent: event,
      severity,
      timestamp: new Date().toISOString(),
      ...meta
    });
  },

  // Request/Response logging
  requestLog: (method: string, url: string, userId?: string, correlationId?: string, meta: Record<string, unknown> = {}) => {
    logger.info('Request received', {
      category: 'request',
      method,
      url,
      userId,
      correlationId,
      timestamp: new Date().toISOString(),
      ...meta
    });
  },

  responseLog: (method: string, url: string, statusCode: number, responseTime: number, correlationId?: string, meta: Record<string, unknown> = {}) => {
    const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    logger[logLevel]('Request completed', {
      category: 'response',
      method,
      url,
      statusCode,
      responseTime,
      correlationId,
      timestamp: new Date().toISOString(),
      ...meta
    });
  }
};

// If we're in test environment, suppress logs to avoid noise
if (process.env.NODE_ENV === 'test') {
  logger.transports.forEach((transport) => {
    transport.silent = true;
  });
}

// Export log level checking functions
export const isDebugEnabled = () => logger.isDebugEnabled();
export const isInfoEnabled = () => logger.isInfoEnabled();
export const isWarnEnabled = () => logger.isWarnEnabled();
export const isErrorEnabled = () => logger.isErrorEnabled();