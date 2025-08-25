// Basic security tests for Phase 8 production readiness
import { describe, test, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import app from '@/app';
import { getSecurityConfig, validateSecurityConfig, performSecurityHealthCheck } from '@/config/security';
import { PHIDetector, HIPAALogger } from '@/utils/hipaa-compliance';
import { SQLSecurityUtils } from '@/utils/database-security';
import { accountLockoutUtils } from '@/middleware/security';

describe('Security: Basic Security & Hardening Tests', () => {
  let testApp: any;

  beforeAll(async () => {
    testApp = await app;
  });

  describe('Security Configuration', () => {
    test('should have valid security configuration', () => {
      const config = getSecurityConfig();
      const validation = validateSecurityConfig(config);
      
      expect(validation.valid).toBe(true);
      expect(config.passwordPolicy.saltRounds).toBeGreaterThanOrEqual(12);
      expect(config.jwt.issuer).toBeDefined();
      expect(config.jwt.audience).toBeDefined();
    });

    test('should pass security health check', () => {
      const healthCheck = performSecurityHealthCheck();
      
      expect(healthCheck.checks).toBeDefined();
      expect(Array.isArray(healthCheck.checks)).toBe(true);
      
      // Check that JWT secrets are configured
      const jwtSecretCheck = healthCheck.checks.find(check => check.name === 'JWT_SECRET');
      expect(jwtSecretCheck?.status).toBe('pass');
    });
  });

  describe('PHI Detection & HIPAA Compliance', () => {
    test('should detect PHI patterns in text', () => {
      const textWithPHI = 'Patient SSN: 123-45-6789, Phone: (555) 123-4567, DOB: 01/15/1985';
      const detection = PHIDetector.detectPHI(textWithPHI);
      
      expect(detection.hasPHI).toBe(true);
      expect(detection.detectedTypes).toContain('ssn');
      expect(detection.detectedTypes).toContain('phone');
      expect(detection.matches.length).toBeGreaterThan(0);
    });

    test('should mask PHI in text', () => {
      const textWithPHI = 'Patient SSN: 123-45-6789';
      const masked = PHIDetector.maskPHI(textWithPHI);
      
      expect(masked).not.toContain('123-45-6789');
      expect(masked).toContain('*');
    });

    test('should remove PHI from text', () => {
      const textWithPHI = 'Patient email: john@example.com and phone (555) 123-4567';
      const cleaned = PHIDetector.removePHI(textWithPHI);
      
      expect(cleaned).not.toContain('john@example.com');
      expect(cleaned).not.toContain('(555) 123-4567');
      expect(cleaned).toContain('[PHI_REMOVED]');
    });
  });

  describe('SQL Security', () => {
    test('should sanitize SQL input', () => {
      const maliciousInput = "'; DROP TABLE users; --";
      const sanitized = SQLSecurityUtils.sanitizeInput(maliciousInput);
      
      expect(sanitized).not.toEqual(maliciousInput);
      expect(sanitized).not.toContain('DROP TABLE');
    });

    test('should validate SQL queries for safety', () => {
      const safeQuery = 'SELECT * FROM users WHERE id = ?';
      const unsafeQuery = 'SELECT * FROM users WHERE id = ' + "'; DROP TABLE users; --";
      
      expect(SQLSecurityUtils.validateQuery(safeQuery)).toBe(true);
      expect(SQLSecurityUtils.validateQuery(unsafeQuery)).toBe(false);
    });
  });

  describe('Account Lockout Protection', () => {
    test('should track failed login attempts', () => {
      const testEmail = 'test@example.com';
      
      // Clear any existing attempts
      accountLockoutUtils.clearAttempts(testEmail);
      
      // Should not be locked initially
      expect(accountLockoutUtils.isLocked(testEmail)).toBe(false);
      
      // Record several failed attempts
      for (let i = 0; i < 3; i++) {
        accountLockoutUtils.recordFailedAttempt(testEmail);
      }
      
      // Should still not be locked (threshold is higher)
      expect(accountLockoutUtils.isLocked(testEmail)).toBe(false);
    });

    test('should lock account after many failed attempts', () => {
      const testEmail = 'locktest@example.com';
      
      // Clear any existing attempts
      accountLockoutUtils.clearAttempts(testEmail);
      
      // Record many failed attempts (more than threshold)
      const maxAttempts = process.env.NODE_ENV === 'production' ? 5 : 10;
      for (let i = 0; i <= maxAttempts; i++) {
        accountLockoutUtils.recordFailedAttempt(testEmail);
      }
      
      // Should be locked now
      expect(accountLockoutUtils.isLocked(testEmail)).toBe(true);
      expect(accountLockoutUtils.getLockoutTime(testEmail)).toBeGreaterThan(0);
    });

    test('should clear attempts on successful operation', () => {
      const testEmail = 'cleartest@example.com';
      
      // Record some failed attempts
      accountLockoutUtils.recordFailedAttempt(testEmail);
      accountLockoutUtils.recordFailedAttempt(testEmail);
      
      // Clear attempts (simulates successful login)
      accountLockoutUtils.clearAttempts(testEmail);
      
      // Should not be locked
      expect(accountLockoutUtils.isLocked(testEmail)).toBe(false);
      expect(accountLockoutUtils.getLockoutTime(testEmail)).toBe(0);
    });
  });

  describe('API Security Headers', () => {
    test('should include security headers in responses', async () => {
      const response = await request(testApp)
        .get('/health')
        .expect(200);

      // Check for security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-request-id']).toBeDefined();
    });

    test('should handle CORS properly', async () => {
      const response = await request(testApp)
        .get('/health')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  describe('Input Validation', () => {
    test('should reject oversized requests', async () => {
      const largePayload = {
        data: 'A'.repeat(20 * 1024 * 1024) // 20MB - should exceed 10MB limit
      };

      const response = await request(testApp)
        .post('/api/auth/login')
        .send(largePayload);

      // Should reject with 413 (Payload Too Large) or 400 (Bad Request)
      expect([400, 413]).toContain(response.status);
    });

    test('should validate content types', async () => {
      const response = await request(testApp)
        .post('/api/auth/login')
        .set('Content-Type', 'text/plain')
        .send('invalid data')
        .expect(415); // Unsupported Media Type

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });
  });

  describe('Rate Limiting', () => {
    test('should include rate limit headers', async () => {
      const response = await request(testApp)
        .get('/health');

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });
  });

  describe('Error Handling Security', () => {
    test('should not expose sensitive information in error responses', async () => {
      const response = await request(testApp)
        .get('/api/non-existent-endpoint')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('NOT_FOUND');
      
      // Should not expose stack traces or internal details
      const responseString = JSON.stringify(response.body);
      expect(responseString).not.toContain('at Object.');
      expect(responseString).not.toContain('.js:');
      expect(responseString).not.toContain('Error: ');
    });

    test('should return consistent error format', async () => {
      const response = await request(testApp)
        .post('/api/auth/login')
        .send({}) // Invalid login data
        .expect(400);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body.success).toBe(false);
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
    });
  });

  describe('Authentication Security', () => {
    test('should require authentication for protected endpoints', async () => {
      const protectedEndpoints = [
        '/api/service-logs',
        '/api/admin/users',
        '/api/reports'
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await request(testApp)
          .get(endpoint);

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
      }
    });

    test('should reject malformed authorization headers', async () => {
      const malformedHeaders = [
        'InvalidToken',
        'Bearer',
        'Bearer ',
        'Token invalid-format',
      ];

      for (const header of malformedHeaders) {
        const response = await request(testApp)
          .get('/api/auth/verify')
          .set('Authorization', header);

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      }
    });
  });

  describe('Request Security', () => {
    test('should validate HTTP methods', async () => {
      // Test unsupported HTTP method
      const response = await request(testApp)
        .patch('/api/auth/login') // PATCH might not be allowed
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      // Should either work (200/400) or be method not allowed (405)
      expect([200, 400, 401, 405]).toContain(response.status);
    });

    test('should handle malicious request patterns', async () => {
      // Test request with suspicious patterns
      const suspiciousData = {
        email: 'test@example.com<script>alert(1)</script>',
        password: 'password\"; DROP TABLE users; --'
      };

      const response = await request(testApp)
        .post('/api/auth/login')
        .send(suspiciousData);

      // Should handle gracefully without crashing
      expect([400, 401, 422]).toContain(response.status);
      expect(response.body.success).toBe(false);
    });
  });
});
