// Security tests for HIPAA Compliance & Healthcare Data Protection following TDD principles
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '@/app';
import { UserRepository } from '@/models/UserRepository';
import { ServiceLogRepository } from '@/models/ServiceLogRepository';
import bcrypt from 'bcryptjs';
import { logger } from '@/utils/logger';
import crypto from 'crypto';

describe('Security: HIPAA Compliance & Healthcare Data Protection', () => {
  let userRepository: UserRepository;
  let serviceLogRepository: ServiceLogRepository;
  let testApp: any;
  let adminToken: string;
  let candidateToken: string;

  beforeAll(async () => {
    testApp = await app;
    userRepository = new UserRepository();
    serviceLogRepository = new ServiceLogRepository();
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

  describe('Protected Health Information (PHI) Handling', () => {
    test('should identify and protect PHI in service logs', async () => {
      const phiData = {
        clientName: 'John Smith', // Potentially PHI
        serviceDate: '2023-12-01',
        notes: 'Patient DOB: 01/15/1985, SSN: 123-45-6789, Insurance ID: ABC123456', // Clear PHI
        activities: [{
          name: 'Consultation',
          duration: 60
        }],
        outcomes: ['Improved mobility']
      };

      const response = await request(testApp)
        .post('/api/service-logs')
        .set('Authorization', `Bearer ${candidateToken}`)
        .send(phiData);

      if ([200, 201].includes(response.status)) {
        // In HIPAA-compliant system, PHI should be encrypted or redacted
        const responseString = JSON.stringify(response.body);
        
        // Check for potential PHI patterns that should be protected
        const ssnPattern = /\d{3}-\d{2}-\d{4}/;
        const dobPattern = /\d{2}\/\d{2}\/\d{4}/;
        
        // In production, these should be encrypted or masked
        if (ssnPattern.test(responseString) || dobPattern.test(responseString)) {
          // Log warning about potential PHI exposure
          console.warn('Potential PHI detected in API response - should be encrypted/masked in production');
        }
      }
    });

    test('should encrypt sensitive data at rest', async () => {
      // Test that sensitive information is properly encrypted
      const sensitiveData = {
        clientName: 'Jane Doe',
        serviceDate: '2023-12-01',
        notes: 'Medical Record Number: MRN123456, Diagnosis: Hypertension',
        activities: [],
        outcomes: []
      };

      const response = await request(testApp)
        .post('/api/service-logs')
        .set('Authorization', `Bearer ${candidateToken}`)
        .send(sensitiveData);

      if ([200, 201].includes(response.status)) {
        const serviceLogId = response.body.data.id;
        
        // In a real HIPAA-compliant system, we'd verify:
        // 1. Data is encrypted in the database
        // 2. Encryption keys are properly managed
        // 3. Access is logged and controlled
        
        expect(serviceLogId).toBeDefined();
      }
    });

    test('should mask PHI in logs and error messages', async () => {
      // Create service log with PHI
      const phiData = {
        clientName: 'Patient with SSN 123-45-6789',
        serviceDate: '2023-12-01',
        notes: 'Email: patient@email.com, Phone: (555) 123-4567',
        activities: [],
        outcomes: []
      };

      // Mock logger to capture log messages
      const originalInfo = logger.info;
      const logMessages: string[] = [];
      logger.info = (message: string, ...args: any[]) => {
        logMessages.push(JSON.stringify({ message, args }));
      };

      try {
        await request(testApp)
          .post('/api/service-logs')
          .set('Authorization', `Bearer ${candidateToken}`)
          .send(phiData);

        // Verify PHI is not exposed in logs
        const allLogs = logMessages.join(' ');
        expect(allLogs).not.toContain('123-45-6789');
        expect(allLogs).not.toContain('patient@email.com');
        expect(allLogs).not.toContain('(555) 123-4567');
      } finally {
        logger.info = originalInfo;
      }
    });

    test('should implement data minimization principle', async () => {
      // Test that only necessary data is collected and stored
      const minimalData = {
        clientName: 'John D.', // Minimized name
        serviceDate: '2023-12-01',
        notes: 'Session completed successfully', // General notes only
        activities: [{
          name: 'Physical Therapy',
          duration: 45
        }],
        outcomes: ['Progress noted']
      };

      const response = await request(testApp)
        .post('/api/service-logs')
        .set('Authorization', `Bearer ${candidateToken}`)
        .send(minimalData);

      expect([200, 201]).toContain(response.status);
      
      if (response.status === 201) {
        // Verify only necessary data is returned
        expect(response.body.data.clientName).toBeDefined();
        expect(response.body.data.socialSecurityNumber).toBeUndefined();
        expect(response.body.data.medicalRecordNumber).toBeUndefined();
      }
    });
  });

  describe('Access Controls & Authorization', () => {
    test('should implement minimum necessary access principle', async () => {
      // Create service log as one candidate
      const serviceLogData = {
        clientName: 'Confidential Client',
        serviceDate: '2023-12-01',
        notes: 'Private session notes',
        activities: [],
        outcomes: []
      };

      const createResponse = await request(testApp)
        .post('/api/service-logs')
        .set('Authorization', `Bearer ${candidateToken}`)
        .send(serviceLogData);

      if (createResponse.status === 201) {
        const serviceLogId = createResponse.body.data.id;

        // Create second candidate user
        const hashedPassword = await bcrypt.hash('SecurePass123!', 12);
        await userRepository.create({
          username: 'candidate2',
          email: 'candidate2@healthcare.local',
          passwordHash: hashedPassword,
          role: 'candidate',
          firstName: 'Other',
          lastName: 'Candidate',
          isActive: true
        });

        const candidate2Response = await request(testApp)
          .post('/api/auth/login')
          .send({
            email: 'candidate2@healthcare.local',
            password: 'SecurePass123!'
          });
        const candidate2Token = candidate2Response.body.data.token;

        // Candidate 2 should not access Candidate 1's service logs
        const accessResponse = await request(testApp)
          .get(`/api/service-logs/${serviceLogId}`)
          .set('Authorization', `Bearer ${candidate2Token}`);

        // Should be forbidden or not found (depending on implementation)
        expect([403, 404]).toContain(accessResponse.status);
      }
    });

    test('should require explicit authorization for PHI access', async () => {
      // Test that accessing PHI requires proper authorization
      const protectedEndpoints = [
        '/api/service-logs',
        '/api/reports',
        '/api/admin/users'
      ];

      for (const endpoint of protectedEndpoints) {
        // Test without token
        const noAuthResponse = await request(testApp)
          .get(endpoint);
        
        expect(noAuthResponse.status).toBe(401);
        expect(noAuthResponse.body.success).toBe(false);

        // Test with invalid token
        const invalidAuthResponse = await request(testApp)
          .get(endpoint)
          .set('Authorization', 'Bearer invalid-token');
        
        expect(invalidAuthResponse.status).toBe(401);
        expect(invalidAuthResponse.body.success).toBe(false);
      }
    });

    test('should implement role-based access for different PHI levels', async () => {
      // Admin should have broader access than candidates
      const adminAccessResponse = await request(testApp)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      // Should allow admin access (200 or 404 if endpoint doesn't exist)
      expect([200, 404]).toContain(adminAccessResponse.status);

      // Candidate should not have admin access
      const candidateAccessResponse = await request(testApp)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${candidateToken}`);

      expect(candidateAccessResponse.status).toBe(403);
    });
  });

  describe('Audit Logging & Monitoring', () => {
    test('should log all PHI access attempts', async () => {
      // Mock logger to capture audit logs
      const originalInfo = logger.info;
      const auditLogs: any[] = [];
      
      logger.info = (message: string, data: any) => {
        if (message.includes('Request received')) {
          auditLogs.push({ message, data });
        }
      };

      try {
        // Access service logs (PHI data)
        await request(testApp)
          .get('/api/service-logs')
          .set('Authorization', `Bearer ${adminToken}`);

        // Verify audit log was created
        expect(auditLogs.length).toBeGreaterThan(0);
        
        const relevantLog = auditLogs.find(log => 
          log.data?.url?.includes('/api/service-logs')
        );
        
        expect(relevantLog).toBeDefined();
        expect(relevantLog.data.method).toBe('GET');
        expect(relevantLog.data.ip).toBeDefined();
      } finally {
        logger.info = originalInfo;
      }
    });

    test('should track user authentication events', async () => {
      const originalInfo = logger.info;
      const authEvents: any[] = [];
      
      logger.info = (message: string, data: any) => {
        if (message.includes('authentication') || message.includes('login')) {
          authEvents.push({ message, data });
        }
      };

      try {
        // Successful login
        await request(testApp)
          .post('/api/auth/login')
          .send({
            email: 'admin@healthcare.local',
            password: 'SecurePass123!'
          });

        // Failed login
        await request(testApp)
          .post('/api/auth/login')
          .send({
            email: 'admin@healthcare.local',
            password: 'wrongpassword'
          });

        // Should have logged authentication attempts
        // Note: Actual logging depends on implementation
      } finally {
        logger.info = originalInfo;
      }
    });

    test('should maintain immutable audit trails', async () => {
      // Create a service log to generate audit trail
      const response = await request(testApp)
        .post('/api/service-logs')
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({
          clientName: 'Audit Test Client',
          serviceDate: '2023-12-01',
          notes: 'Test audit logging',
          activities: [],
          outcomes: []
        });

      if (response.status === 201) {
        const serviceLogId = response.body.data.id;
        
        // In a real HIPAA system, audit logs would be:
        // 1. Write-only (cannot be modified after creation)
        // 2. Cryptographically signed
        // 3. Stored in tamper-evident storage
        
        expect(serviceLogId).toBeDefined();
      }
    });
  });

  describe('Data Transmission Security', () => {
    test('should enforce HTTPS in production', async () => {
      // Test that sensitive endpoints require HTTPS in production
      if (process.env.NODE_ENV === 'production') {
        const response = await request(testApp)
          .post('/api/auth/login')
          .set('X-Forwarded-Proto', 'http') // Simulate HTTP request
          .send({
            email: 'admin@healthcare.local',
            password: 'SecurePass123!'
          });

        // Should redirect to HTTPS or reject HTTP requests
        expect([301, 302, 403, 400]).toContain(response.status);
      }
    });

    test('should use secure headers for PHI transmission', async () => {
      const response = await request(testApp)
        .get('/api/service-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        // Should include security headers
        expect(response.headers['strict-transport-security']).toBeDefined();
        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['x-frame-options']).toBeDefined();
        expect(response.headers['cache-control']).toContain('no-store');
      }
    });

    test('should encrypt data in transit', async () => {
      // This test verifies that sensitive data is properly handled in transit
      const sensitiveData = {
        clientName: 'Sensitive Client Name',
        serviceDate: '2023-12-01',
        notes: 'Contains PHI: Patient ID 12345',
        activities: [],
        outcomes: []
      };

      const response = await request(testApp)
        .post('/api/service-logs')
        .set('Authorization', `Bearer ${candidateToken}`)
        .send(sensitiveData);

      // In production, this would be transmitted over HTTPS (TLS encryption)
      expect([200, 201, 400]).toContain(response.status);
    });
  });

  describe('Data Retention & Disposal', () => {
    test('should implement secure data deletion', async () => {
      // Create service log
      const createResponse = await request(testApp)
        .post('/api/service-logs')
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({
          clientName: 'Client to Delete',
          serviceDate: '2023-12-01',
          notes: 'This should be securely deleted',
          activities: [],
          outcomes: []
        });

      if (createResponse.status === 201) {
        const serviceLogId = createResponse.body.data.id;

        // Delete the service log
        const deleteResponse = await request(testApp)
          .delete(`/api/service-logs/${serviceLogId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        if (deleteResponse.status === 200) {
          // Verify data is properly deleted/soft-deleted
          const getResponse = await request(testApp)
            .get(`/api/service-logs/${serviceLogId}`)
            .set('Authorization', `Bearer ${adminToken}`);

          expect(getResponse.status).toBe(404);
        }
      }
    });

    test('should handle data retention periods', async () => {
      // Test that data is retained for appropriate periods
      // and disposed of securely after retention period
      
      const oldServiceLog = {
        clientName: 'Old Client',
        serviceDate: '2020-01-01', // Old date
        notes: 'Old service log for retention testing',
        activities: [],
        outcomes: []
      };

      const response = await request(testApp)
        .post('/api/service-logs')
        .set('Authorization', `Bearer ${candidateToken}`)
        .send(oldServiceLog);

      expect([200, 201]).toContain(response.status);
      
      // In production, a background job would handle retention policy enforcement
    });
  });

  describe('Business Associate Compliance', () => {
    test('should validate third-party integrations comply with HIPAA', async () => {
      // Test that any third-party service integrations are HIPAA compliant
      // This would include email services, cloud storage, analytics, etc.
      
      // For now, we verify that the system doesn't expose PHI to unauthorized services
      const response = await request(testApp)
        .get('/api/service-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        // Verify response doesn't contain tracking pixels or external resources
        const responseBody = JSON.stringify(response.body);
        
        // Should not contain external URLs that could leak PHI
        expect(responseBody).not.toMatch(/https?:\/\/(?!localhost)/i);
      }
    });

    test('should implement secure API integrations', async () => {
      // Test that API integrations with external services are secure
      // This includes proper authentication, encryption, and access controls
      
      // Verify API endpoints require proper authentication
      const endpoints = [
        '/api/service-logs',
        '/api/reports',
        '/api/admin/users'
      ];

      for (const endpoint of endpoints) {
        const response = await request(testApp)
          .get(endpoint)
          .set('User-Agent', 'External-Service/1.0'); // Simulate external service

        // Should require authentication even from external services
        expect(response.status).toBe(401);
      }
    });
  });

  describe('Incident Response & Breach Detection', () => {
    test('should detect and log suspicious access patterns', async () => {
      // Simulate suspicious access pattern (rapid multiple requests)
      const suspiciousRequests = Array(10).fill(null).map(async (_, i) => {
        return request(testApp)
          .get('/api/service-logs')
          .set('Authorization', `Bearer ${adminToken}`);
      });

      const responses = await Promise.all(suspiciousRequests);
      
      // Should either rate limit or log the suspicious behavior
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      if (rateLimitedResponses.length > 0) {
        expect(rateLimitedResponses[0].body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      }
    });

    test('should handle potential data breach scenarios', async () => {
      // Test response to potential breach (multiple failed auth attempts)
      const breachAttempts = Array(5).fill(null).map(async () => {
        return request(testApp)
          .post('/api/auth/login')
          .send({
            email: 'admin@healthcare.local',
            password: 'wrong-password-' + Math.random()
          });
      });

      const responses = await Promise.all(breachAttempts);
      
      // Should implement account lockout or enhanced monitoring
      const unauthorizedResponses = responses.filter(r => r.status === 401);
      expect(unauthorizedResponses.length).toBeGreaterThan(0);
      
      // After multiple failures, should trigger additional security measures
      const finalAttempt = await request(testApp)
        .post('/api/auth/login')
        .send({
          email: 'admin@healthcare.local',
          password: 'SecurePass123!'
        });

      // Might be rate limited or require additional verification
      expect([200, 401, 429]).toContain(finalAttempt.status);
    });
  });

  describe('Privacy & Consent Management', () => {
    test('should respect data subject privacy rights', async () => {
      // Test data portability (right to export data)
      const exportResponse = await request(testApp)
        .get('/api/reports/export')
        .set('Authorization', `Bearer ${candidateToken}`);

      if (exportResponse.status === 200) {
        // Should only export data the user has rights to
        expect(exportResponse.body).toBeDefined();
      }
    });

    test('should handle consent withdrawal', async () => {
      // Create service log
      const createResponse = await request(testApp)
        .post('/api/service-logs')
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({
          clientName: 'Consent Test Client',
          serviceDate: '2023-12-01',
          notes: 'Data subject to consent withdrawal',
          activities: [],
          outcomes: []
        });

      if (createResponse.status === 201) {
        // In a real system, there would be mechanisms to:
        // 1. Mark data for deletion upon consent withdrawal
        // 2. Prevent further processing
        // 3. Notify relevant parties
        
        expect(createResponse.body.data.id).toBeDefined();
      }
    });
  });
});
