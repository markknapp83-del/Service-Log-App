// Centralized security configuration following Express.js security patterns
import { logger } from '@/utils/logger';

export interface SecurityConfig {
  // Rate limiting configuration
  rateLimiting: {
    general: {
      windowMs: number;
      maxRequests: number;
    };
    authentication: {
      windowMs: number;
      maxAttempts: number;
    };
    passwordReset: {
      windowMs: number;
      maxAttempts: number;
    };
  };
  
  // Account lockout configuration
  accountLockout: {
    maxFailedAttempts: number;
    lockoutDurationMs: number;
    resetWindowMs: number;
  };
  
  // Password policy
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    preventCommonPasswords: boolean;
    saltRounds: number;
  };
  
  // JWT configuration
  jwt: {
    accessTokenExpiry: string;
    refreshTokenExpiry: string;
    issuer: string;
    audience: string;
  };
  
  // Request validation
  requestValidation: {
    maxRequestSize: string;
    allowedContentTypes: string[];
    allowedHttpMethods: string[];
  };
  
  // CORS configuration
  cors: {
    allowedOrigins: string[];
    allowCredentials: boolean;
    maxAge: number;
  };
  
  // Security headers
  headers: {
    enableCSP: boolean;
    enableHSTS: boolean;
    hstsMaxAge: number;
    frameOptions: 'deny' | 'sameorigin';
  };
  
  // Audit logging
  audit: {
    enabled: boolean;
    logFailedAttempts: boolean;
    logSuccessfulLogins: boolean;
    logDataAccess: boolean;
    retentionDays: number;
  };
  
  // Data protection
  dataProtection: {
    enableEncryption: boolean;
    maskPHIInLogs: boolean;
    secureDataDeletion: boolean;
    dataRetentionDays: number;
  };
}

// Production security configuration
const PRODUCTION_CONFIG: SecurityConfig = {
  rateLimiting: {
    general: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100
    },
    authentication: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxAttempts: 5
    },
    passwordReset: {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxAttempts: 3
    }
  },
  
  accountLockout: {
    maxFailedAttempts: 5,
    lockoutDurationMs: 30 * 60 * 1000, // 30 minutes
    resetWindowMs: 15 * 60 * 1000 // 15 minutes
  },
  
  passwordPolicy: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: false,
    preventCommonPasswords: true,
    saltRounds: 12
  },
  
  jwt: {
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d',
    issuer: 'healthcare-portal',
    audience: 'healthcare-portal-client'
  },
  
  requestValidation: {
    maxRequestSize: '10mb',
    allowedContentTypes: ['application/json'],
    allowedHttpMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD']
  },
  
  cors: {
    allowedOrigins: process.env.CORS_ORIGIN?.split(',') || ['https://healthcare-portal.com'],
    allowCredentials: true,
    maxAge: 86400 // 24 hours
  },
  
  headers: {
    enableCSP: true,
    enableHSTS: true,
    hstsMaxAge: 31536000, // 1 year
    frameOptions: 'deny'
  },
  
  audit: {
    enabled: true,
    logFailedAttempts: true,
    logSuccessfulLogins: true,
    logDataAccess: true,
    retentionDays: 2555 // 7 years for healthcare compliance
  },
  
  dataProtection: {
    enableEncryption: true,
    maskPHIInLogs: true,
    secureDataDeletion: true,
    dataRetentionDays: 2555 // 7 years for healthcare compliance
  }
};

// Development security configuration (more lenient for testing)
const DEVELOPMENT_CONFIG: SecurityConfig = {
  rateLimiting: {
    general: {
      windowMs: 15 * 60 * 1000,
      maxRequests: 10000 // Much higher for development
    },
    authentication: {
      windowMs: 15 * 60 * 1000,
      maxAttempts: 50 // More lenient for testing
    },
    passwordReset: {
      windowMs: 60 * 60 * 1000,
      maxAttempts: 10
    }
  },
  
  accountLockout: {
    maxFailedAttempts: 10, // Higher threshold for development
    lockoutDurationMs: 5 * 60 * 1000, // 5 minutes
    resetWindowMs: 15 * 60 * 1000
  },
  
  passwordPolicy: {
    minLength: 6, // More lenient for testing
    requireUppercase: false,
    requireLowercase: true,
    requireNumbers: false,
    requireSpecialChars: false,
    preventCommonPasswords: false,
    saltRounds: 12 // Keep secure even in development
  },
  
  jwt: {
    accessTokenExpiry: '1h', // Longer for development convenience
    refreshTokenExpiry: '7d',
    issuer: 'healthcare-portal',
    audience: 'healthcare-portal-client'
  },
  
  requestValidation: {
    maxRequestSize: '50mb', // Larger for development
    allowedContentTypes: ['application/json', 'multipart/form-data'],
    allowedHttpMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH']
  },
  
  cors: {
    allowedOrigins: ['*'], // Allow all origins in development
    allowCredentials: true,
    maxAge: 86400
  },
  
  headers: {
    enableCSP: false, // Disabled for easier development
    enableHSTS: false,
    hstsMaxAge: 0,
    frameOptions: 'sameorigin'
  },
  
  audit: {
    enabled: true,
    logFailedAttempts: true,
    logSuccessfulLogins: true,
    logDataAccess: false, // Less verbose in development
    retentionDays: 30
  },
  
  dataProtection: {
    enableEncryption: false, // Disabled for easier debugging
    maskPHIInLogs: false, // Show full data in development logs
    secureDataDeletion: false,
    dataRetentionDays: 90
  }
};

// Test security configuration
const TEST_CONFIG: SecurityConfig = {
  ...DEVELOPMENT_CONFIG,
  rateLimiting: {
    general: {
      windowMs: 1000,
      maxRequests: 1000000 // Effectively unlimited for tests
    },
    authentication: {
      windowMs: 1000,
      maxAttempts: 1000
    },
    passwordReset: {
      windowMs: 1000,
      maxAttempts: 100
    }
  },
  
  accountLockout: {
    maxFailedAttempts: 100,
    lockoutDurationMs: 1000, // Very short for tests
    resetWindowMs: 1000
  },
  
  audit: {
    enabled: false, // Disable audit logging in tests
    logFailedAttempts: false,
    logSuccessfulLogins: false,
    logDataAccess: false,
    retentionDays: 1
  }
};

// Get security configuration based on environment
export function getSecurityConfig(): SecurityConfig {
  const env = process.env.NODE_ENV || 'development';
  
  let config: SecurityConfig;
  
  switch (env) {
    case 'production':
      config = PRODUCTION_CONFIG;
      break;
    case 'test':
      config = TEST_CONFIG;
      break;
    case 'development':
    default:
      config = DEVELOPMENT_CONFIG;
      break;
  }
  
  logger.info('Security configuration loaded', {
    environment: env,
    rateLimitingEnabled: true,
    auditEnabled: config.audit.enabled,
    encryptionEnabled: config.dataProtection.enableEncryption,
    cspEnabled: config.headers.enableCSP
  });
  
  return config;
}

// Validate security configuration
export function validateSecurityConfig(config: SecurityConfig): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate password policy
  if (config.passwordPolicy.minLength < 8) {
    warnings.push('Password minimum length is less than 8 characters');
  }
  
  if (config.passwordPolicy.saltRounds < 10) {
    errors.push('Password salt rounds should be at least 10');
  }
  
  // Validate JWT configuration
  if (!config.jwt.issuer || !config.jwt.audience) {
    errors.push('JWT issuer and audience must be configured');
  }
  
  // Validate rate limiting
  if (config.rateLimiting.authentication.maxAttempts > 10) {
    warnings.push('Authentication rate limit is quite high, consider lowering');
  }
  
  // Validate CORS
  if (process.env.NODE_ENV === 'production' && config.cors.allowedOrigins.includes('*')) {
    errors.push('Wildcard CORS origins not allowed in production');
  }
  
  // Validate security headers
  if (process.env.NODE_ENV === 'production' && !config.headers.enableHSTS) {
    warnings.push('HSTS should be enabled in production');
  }
  
  if (process.env.NODE_ENV === 'production' && !config.headers.enableCSP) {
    warnings.push('Content Security Policy should be enabled in production');
  }
  
  // Validate data protection
  if (process.env.NODE_ENV === 'production' && !config.dataProtection.maskPHIInLogs) {
    errors.push('PHI masking in logs must be enabled in production');
  }
  
  if (config.dataProtection.dataRetentionDays < 2555 && process.env.NODE_ENV === 'production') {
    warnings.push('Healthcare data retention should be at least 7 years (2555 days)');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// Security health check
export function performSecurityHealthCheck(): {
  healthy: boolean;
  checks: Array<{
    name: string;
    status: 'pass' | 'warn' | 'fail';
    message: string;
  }>;
} {
  const checks: Array<{
    name: string;
    status: 'pass' | 'warn' | 'fail';
    message: string;
  }> = [];
  
  const config = getSecurityConfig();
  
  // Check environment variables
  checks.push({
    name: 'JWT_SECRET',
    status: process.env.JWT_SECRET ? 'pass' : 'fail',
    message: process.env.JWT_SECRET ? 'JWT secret is configured' : 'JWT secret is missing'
  });
  
  checks.push({
    name: 'JWT_REFRESH_SECRET',
    status: process.env.JWT_REFRESH_SECRET ? 'pass' : 'fail',
    message: process.env.JWT_REFRESH_SECRET ? 'JWT refresh secret is configured' : 'JWT refresh secret is missing'
  });
  
  // Check database encryption
  checks.push({
    name: 'Database Encryption',
    status: process.env.DATABASE_ENCRYPTION_KEY ? 'pass' : (process.env.NODE_ENV === 'production' ? 'fail' : 'warn'),
    message: process.env.DATABASE_ENCRYPTION_KEY ? 'Database encryption key is configured' : 'Database encryption key is missing'
  });
  
  // Check CORS configuration
  const corsStatus = process.env.NODE_ENV === 'production' && config.cors.allowedOrigins.includes('*') ? 'fail' : 'pass';
  checks.push({
    name: 'CORS Configuration',
    status: corsStatus,
    message: corsStatus === 'fail' ? 'Wildcard CORS origins detected in production' : 'CORS is properly configured'
  });
  
  // Check HTTPS enforcement
  const httpsStatus = process.env.NODE_ENV === 'production' && !process.env.FORCE_HTTPS ? 'warn' : 'pass';
  checks.push({
    name: 'HTTPS Enforcement',
    status: httpsStatus,
    message: httpsStatus === 'warn' ? 'HTTPS enforcement should be enabled in production' : 'HTTPS configuration is appropriate'
  });
  
  // Check audit logging
  checks.push({
    name: 'Audit Logging',
    status: config.audit.enabled ? 'pass' : 'warn',
    message: config.audit.enabled ? 'Audit logging is enabled' : 'Audit logging is disabled'
  });
  
  const failedChecks = checks.filter(check => check.status === 'fail');
  
  return {
    healthy: failedChecks.length === 0,
    checks
  };
}

// Export the current security configuration
export const securityConfig = getSecurityConfig();

// Log security configuration validation on startup
const validation = validateSecurityConfig(securityConfig);
if (!validation.valid) {
  logger.error('Security configuration validation failed', {
    errors: validation.errors,
    warnings: validation.warnings
  });
} else if (validation.warnings.length > 0) {
  logger.warn('Security configuration warnings', {
    warnings: validation.warnings
  });
} else {
  logger.info('Security configuration validation passed');
}
