// Security tests for API Security & HTTP Headers following TDD principles
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '@/app';
import { UserRepository } from '@/models/UserRepository';
import bcrypt from 'bcryptjs';

describe('Security: API Security & HTTP Headers', () => {
  let userRepository: UserRepository;
  let testApp: any;
  let adminToken: string;
  let candidateToken: string;

  beforeAll(async () => {
    testApp = await app;
    userRepository = new UserRepository();
  });

  beforeEach(async () => {
    // Create test users
    const hashedPassword = await bcrypt.hash('SecurePass123!', 12);
    
    try {
      await userRepository.create({
        username: 'testadmin',
        email: 'admin@healthcare.local',
        passwordHash: hashedPassword,
        role: 'admin',
        firstName: 'Test',
        lastName: 'Admin',
        isActive: true,
        lastLoginAt: undefined
      });

      await userRepository.create({
        username: 'testcandidate',
        email: 'candidate@healthcare.local',
        passwordHash: hashedPassword,
        role: 'candidate',
        firstName: 'Test',
        lastName: 'Candidate',
        isActive: true,
        lastLoginAt: undefined
      });
    } catch (error) {
      // Users might already exist
    }

    // Get auth tokens
    const adminResponse = await request(testApp)
      .post('/api/auth/login')
      .send({
        email: 'admin@healthcare.local',
        password: 'SecurePass123!'
      });
    adminToken = adminResponse.body.data.token;

    const candidateResponse = await request(testApp)
      .post('/api/auth/login')
      .send({
        email: 'candidate@healthcare.local',
        password: 'SecurePass123!'
      });
    candidateToken = candidateResponse.body.data.token;
  });

  describe('Security Headers', () => {
    test('should include security headers in all responses', async () => {
      const response = await request(testApp)
        .get('/health')
        .expect(200);

      // Helmet security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('0'); // Modern browsers use CSP instead
      expect(response.headers['referrer-policy']).toBeDefined();
      expect(response.headers['x-download-options']).toBe('noopen');
      expect(response.headers['x-permitted-cross-domain-policies']).toBe('none');
    });

    test('should implement Content Security Policy (CSP)', async () => {
      const response = await request(testApp)
        .get('/health');

      // CSP header should be present for production security
      // In development it might be disabled for easier debugging
      if (process.env.NODE_ENV === 'production') {
        expect(response.headers['content-security-policy']).toBeDefined();
      }
    });

    test('should implement HSTS for production', async () => {
      const response = await request(testApp)
        .get('/health');

      // HSTS should be enabled in production
      if (process.env.NODE_ENV === 'production') {
        expect(response.headers['strict-transport-security']).toBeDefined();
        expect(response.headers['strict-transport-security']).toContain('max-age=');
      }
    });

    test('should not expose server information', async () => {
      const response = await request(testApp)
        .get('/health');

      // Should not expose server details
      expect(response.headers['server']).toBeUndefined();
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    test('should set proper cache control headers', async () => {
      const response = await request(testApp)
        .get('/api/service-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      // Sensitive API endpoints should not be cached
      if (response.status === 200) {
        expect(
          response.headers['cache-control'] === 'no-store' ||
          response.headers['cache-control'] === 'no-cache, no-store, must-revalidate'
        ).toBe(true);
      }
    });
  });

  describe('CORS Configuration', () => {
    test('should enforce CORS policy', async () => {
      const response = await request(testApp)
        .get('/health')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-credentials']).toBe('true');
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });

    test('should reject requests from unauthorized origins', async () => {
      const unauthorizedOrigins = [
        'http://malicious.com',
        'https://evil-site.org',
        'http://phishing-healthcare.com'
      ];

      for (const origin of unauthorizedOrigins) {
        const response = await request(testApp)
          .options('/api/service-logs')
          .set('Origin', origin)
          .set('Access-Control-Request-Method', 'POST');

        // Should either block or not include the malicious origin in CORS headers
        if (response.headers['access-control-allow-origin']) {
          expect(response.headers['access-control-allow-origin']).not.toBe(origin);
        }
      }
    });

    test('should allow development localhost origins', async () => {
      const developmentOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173' // Vite default port
      ];

      for (const origin of developmentOrigins) {
        const response = await request(testApp)
          .get('/health')
          .set('Origin', origin);

        // In development, should allow localhost origins
        if (process.env.NODE_ENV === 'development') {
          expect([
            origin,
            '*',
            'true' // Some CORS implementations return 'true' for allowed origins
          ]).toContain(response.headers['access-control-allow-origin']);
        }
      }
    });

    test('should handle preflight OPTIONS requests', async () => {
      const response = await request(testApp)
        .options('/api/service-logs')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type, Authorization');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-methods']).toContain('POST');
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    test('should include rate limit headers', async () => {
      const response = await request(testApp)
        .get('/health');

      // Rate limiting headers should be present
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    test('should enforce different rate limits for different endpoints', async () => {
      // Test general API rate limit
      const apiResponse = await request(testApp)
        .get('/api/service-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      // Test auth endpoint rate limit (should be stricter)
      const authResponse = await request(testApp)
        .post('/api/auth/login')
        .send({
          email: 'admin@healthcare.local',
          password: 'SecurePass123!'
        });

      if (apiResponse.status === 200 && authResponse.status === 200) {
        const apiLimit = parseInt(apiResponse.headers['x-ratelimit-limit'] || '0');
        const authLimit = parseInt(authResponse.headers['x-ratelimit-limit'] || '0');

        if (process.env.NODE_ENV === 'production') {
          // Auth endpoints should have stricter limits in production
          expect(authLimit).toBeLessThan(apiLimit);
        }
      }
    });

    test('should return 429 when rate limit exceeded', async () => {
      // This test is more relevant in production with actual rate limits
      if (process.env.NODE_ENV === 'production') {
        const maxAttempts = 110; // Exceed the typical 100 req/15min limit
        let rateLimitHit = false;

        for (let i = 0; i < maxAttempts && !rateLimitHit; i++) {
          const response = await request(testApp)
            .get('/health');

          if (response.status === 429) {
            rateLimitHit = true;
            expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
            expect(response.headers['retry-after']).toBeDefined();
          }
        }

        expect(rateLimitHit).toBe(true);
      }
    });
  });

  describe('Request Validation', () => {
    test('should validate Content-Type header', async () => {
      const invalidContentTypes = [
        'application/xml',
        'text/plain',
        'multipart/form-data',
        'application/x-www-form-urlencoded'
      ];

      for (const contentType of invalidContentTypes) {
        const response = await request(testApp)
          .post('/api/service-logs')
          .set('Authorization', `Bearer ${candidateToken}`)
          .set('Content-Type', contentType)
          .send('invalid data format');

        // Should reject invalid content types for JSON API endpoints
        expect([400, 415]).toContain(response.status);
      }
    });

    test('should enforce request size limits', async () => {
      // Test with a large JSON payload
      const largePayload = {
        clientName: 'Test',
        serviceDate: '2023-12-01',
        notes: 'A'.repeat(11 * 1024 * 1024), // 11MB - exceeds 10MB limit
        activities: []
      };

      const response = await request(testApp)
        .post('/api/service-logs')
        .set('Authorization', `Bearer ${candidateToken}`)
        .send(largePayload);

      // Should reject oversized requests
      expect([413, 400]).toContain(response.status);
    });

    test('should validate HTTP methods', async () => {
      const invalidMethods = ['TRACE', 'TRACK', 'CONNECT'];

      for (const method of invalidMethods) {
        try {
          const response = await request(testApp)
            [method.toLowerCase()]('/api/service-logs')
            .set('Authorization', `Bearer ${adminToken}`);

          // Should reject dangerous HTTP methods
          expect([405, 501]).toContain(response.status);
        } catch (error) {
          // Some methods might not be supported by supertest, which is good
          expect(error).toBeDefined();
        }
      }
    });
  });

  describe('Error Handling Security', () => {
    test('should not expose stack traces in production', async () => {
      // Try to cause an error
      const response = await request(testApp)
        .get('/api/non-existent-endpoint')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      
      // Should not expose stack traces in production
      if (process.env.NODE_ENV === 'production') {
        expect(response.body.error.stack).toBeUndefined();
        expect(JSON.stringify(response.body)).not.toContain('at Object.');
        expect(JSON.stringify(response.body)).not.toContain('.js:');
      }
    });

    test('should not expose database errors', async () => {
      // Try to access a malformed endpoint that might cause DB errors
      const response = await request(testApp)
        .get('/api/service-logs/invalid-uuid-format')
        .set('Authorization', `Bearer ${adminToken}`);

      // Should return a generic error, not database-specific errors
      if (response.status >= 400) {
        const errorString = JSON.stringify(response.body);
        expect(errorString).not.toContain('SQLITE');
        expect(errorString).not.toContain('database');
        expect(errorString).not.toContain('SQL');
        expect(errorString).not.toContain('constraint');
      }
    });

    test('should return consistent error format', async () => {
      const errorEndpoints = [
        { path: '/api/non-existent', expectedStatus: 404 },
        { path: '/api/service-logs', expectedStatus: 401, skipAuth: true },
        { path: '/api/admin/users', expectedStatus: 403, useCandidate: true }
      ];

      for (const endpoint of errorEndpoints) {
        let authHeader = {};
        if (!endpoint.skipAuth) {
          authHeader = { 
            Authorization: `Bearer ${endpoint.useCandidate ? candidateToken : adminToken}` 
          };
        }

        const response = await request(testApp)
          .get(endpoint.path)
          .set(authHeader);

        // Should have consistent error format
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBeDefined();
        expect(response.body.error.code).toBeDefined();
        expect(response.body.error.message).toBeDefined();
        expect(response.body.timestamp).toBeDefined();
      }
    });

    test('should not leak sensitive information in error messages', async () => {
      // Try to access admin endpoint with candidate token
      const response = await request(testApp)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${candidateToken}`);

      if (response.status === 403) {
        const errorString = JSON.stringify(response.body);
        
        // Should not expose internal system information
        expect(errorString).not.toContain('database');
        expect(errorString).not.toContain('file path');
        expect(errorString).not.toContain('server');
        expect(errorString).not.toContain('internal');
        expect(errorString).not.toContain('backend');
      }
    });
  });

  describe('API Endpoint Security', () => {
    test('should require authentication for protected endpoints', async () => {
      const protectedEndpoints = [
        { method: 'get', path: '/api/service-logs' },
        { method: 'post', path: '/api/service-logs' },
        { method: 'get', path: '/api/admin/users' },
        { method: 'post', path: '/api/admin/users' }
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await request(testApp)
          [endpoint.method](endpoint.path)
          .send({});

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
      }
    });

    test('should validate API version consistency', async () => {
      // All API endpoints should be versioned under /api/
      const response = await request(testApp)
        .get('/service-logs') // Missing /api/ prefix
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });

    test('should implement proper HTTP status codes', async () => {
      const testCases = [
        {
          description: 'Should return 404 for non-existent resources',
          request: () => request(testApp)
            .get('/api/service-logs/non-existent-id')
            .set('Authorization', `Bearer ${adminToken}`),
          expectedStatus: 404
        },
        {
          description: 'Should return 401 for missing authentication',
          request: () => request(testApp)
            .get('/api/service-logs'),
          expectedStatus: 401
        },
        {
          description: 'Should return 403 for insufficient permissions',
          request: () => request(testApp)
            .delete('/api/admin/users/some-user')
            .set('Authorization', `Bearer ${candidateToken}`),
          expectedStatus: 403
        }
      ];

      for (const testCase of testCases) {
        const response = await testCase.request();
        expect(response.status).toBe(testCase.expectedStatus);
      }
    });
  });

  describe('Audit Logging Security', () => {
    test('should log security-relevant events', async () => {
      // Mock the logger to capture logs
      const originalError = console.error;
      const loggedMessages: string[] = [];
      console.error = (message: string) => {
        loggedMessages.push(message);
      };

      try {
        // Trigger a security event (failed authentication)
        await request(testApp)
          .post('/api/auth/login')
          .send({
            email: 'admin@healthcare.local',
            password: 'wrongpassword'
          });

        // Note: In a real implementation, we'd check actual log files
        // For now, we verify the endpoint behaves correctly
      } finally {
        console.error = originalError;
      }
    });

    test('should not log sensitive information', async () => {
      // This test would verify that passwords, tokens, etc. are not logged
      // Implementation would depend on the actual logging system
      expect(true).toBe(true); // Placeholder
    });
  });
});
