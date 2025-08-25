/**
 * Concurrent Request Handling Performance Tests
 * Following documented patterns from devdocs/jest.md
 * Tests system performance under load with 50+ simultaneous users
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import Database from 'better-sqlite3';
import app from '../../../app';
import { PerformanceTestUtils } from '../utils/PerformanceTestUtils';
import { generateTestToken } from '../../../utils/testHelpers';

describe('Concurrent User Load Performance Tests', () => {
  let db: Database.Database;
  let authTokens: string[] = [];
  let adminToken: string;
  let testPatientIds: string[] = [];

  const CONCURRENT_USERS = 50;
  const LOAD_TEST_REQUESTS = 200;
  const CONCURRENT_TARGET_MS = 2000; // 2 seconds for concurrent operations
  const SUCCESS_RATE_TARGET = 95; // 95% success rate minimum
  const AVERAGE_RESPONSE_TARGET_MS = 300; // Average response time target

  beforeAll(async () => {
    // Create test database with connection pool optimization
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = -64000'); // 64MB cache
    db.pragma('temp_store = MEMORY');
    db.pragma('mmap_size = 268435456'); // 256MB mmap

    // Create optimized schema
    db.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        role TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

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
        deleted_at TEXT,
        created_by TEXT NOT NULL,
        FOREIGN KEY (created_by) REFERENCES users (id)
      );

      CREATE TABLE service_logs (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        service_type TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        scheduled_date TEXT NOT NULL,
        duration INTEGER NOT NULL,
        status TEXT NOT NULL,
        priority TEXT NOT NULL,
        notes TEXT,
        custom_fields TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT NOT NULL,
        FOREIGN KEY (patient_id) REFERENCES patients (id),
        FOREIGN KEY (created_by) REFERENCES users (id)
      );

      -- Performance indexes for concurrent access
      CREATE INDEX idx_patients_phone ON patients(phone);
      CREATE INDEX idx_patients_name ON patients(last_name, first_name);
      CREATE INDEX idx_service_logs_patient ON service_logs(patient_id);
      CREATE INDEX idx_service_logs_date ON service_logs(scheduled_date);
      CREATE INDEX idx_service_logs_status ON service_logs(status);
    `);

    // Create multiple test users to simulate concurrent access
    const users = [];
    for (let i = 0; i < CONCURRENT_USERS; i++) {
      const userId = `user-${i.toString().padStart(3, '0')}`;
      users.push({
        id: userId,
        username: `testuser${i}`,
        password: '$2b$12$hash',
        first_name: `User${i}`,
        last_name: 'Test',
        role: 'staff'
      });
    }

    // Create admin user
    users.push({
      id: 'admin-user-000',
      username: 'admin',
      password: '$2b$12$hash',
      first_name: 'Admin',
      last_name: 'User',
      role: 'admin'
    });

    // Insert all users
    const insertUser = db.prepare(`
      INSERT INTO users (id, username, password, first_name, last_name, role)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const user of users) {
      insertUser.run(user.id, user.username, user.password, user.first_name, user.last_name, user.role);
    }

    // Generate auth tokens for all test users
    authTokens = users.slice(0, -1).map(user => // Exclude admin user
      generateTestToken({ 
        userId: user.id, 
        role: 'staff',
        permissions: [
          { resource: 'patients', actions: ['create', 'read', 'update'] },
          { resource: 'service_logs', actions: ['create', 'read', 'update'] }
        ]
      })
    );

    adminToken = generateTestToken({ 
      userId: 'admin-user-000', 
      role: 'admin',
      permissions: [
        { resource: 'patients', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'service_logs', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'users', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'reports', actions: ['create', 'read'] }
      ]
    });

    // Pre-populate with test data
    const patients = PerformanceTestUtils.createLargePatientDataset(100);
    const insertPatient = db.prepare(`
      INSERT INTO patients (id, first_name, last_name, date_of_birth, phone, email, emergency_contact, created_at, updated_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const patient of patients) {
      insertPatient.run(
        patient.id,
        patient.firstName,
        patient.lastName,
        patient.dateOfBirth,
        patient.phone,
        patient.email,
        patient.emergencyContact,
        patient.createdAt,
        patient.updatedAt,
        'admin-user-000'
      );
      testPatientIds.push(patient.id);
    }
  });

  beforeEach(() => {
    PerformanceTestUtils.cleanup();
  });

  afterAll(() => {
    db.close();
  });

  describe('Concurrent Read Operations', () => {
    test('should handle 50 concurrent patient list requests within target time', async () => {
      const requestFunction = () => {
        const randomToken = authTokens[Math.floor(Math.random() * authTokens.length)];
        return request(app)
          .get('/api/patients')
          .set('Authorization', `Bearer ${randomToken}`)
          .query({ page: 1, limit: 20 })
          .then(response => {
            expect(response.status).toBe(200);
            return response.body;
          });
      };

      PerformanceTestUtils.startMeasurement('concurrent_patient_list');

      const results = await PerformanceTestUtils.simulateConcurrentRequests(
        requestFunction,
        CONCURRENT_USERS,
        LOAD_TEST_REQUESTS
      );

      const benchmark = PerformanceTestUtils.assertPerformance(
        'concurrent_patient_list',
        CONCURRENT_TARGET_MS,
        'Concurrent patient list requests'
      );

      expect(benchmark.passed).toBe(true);
      expect(results.successRate).toBeGreaterThanOrEqual(SUCCESS_RATE_TARGET);
      expect(results.averageResponseTime).toBeLessThanOrEqual(AVERAGE_RESPONSE_TARGET_MS);

      console.log(`Concurrent Patient List Results:
        - Total Requests: ${LOAD_TEST_REQUESTS}
        - Success Rate: ${results.successRate.toFixed(2)}%
        - Average Response Time: ${results.averageResponseTime.toFixed(2)}ms
        - Total Time: ${results.totalTime.toFixed(2)}ms`);
    });

    test('should handle concurrent patient search requests efficiently', async () => {
      const searchTerms = ['John', 'Smith', 'Doe', '555', 'test'];
      
      const requestFunction = () => {
        const randomToken = authTokens[Math.floor(Math.random() * authTokens.length)];
        const randomSearchTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)];
        
        return request(app)
          .get('/api/patients')
          .set('Authorization', `Bearer ${randomToken}`)
          .query({ 
            search: randomSearchTerm,
            page: 1, 
            limit: 20 
          })
          .then(response => {
            expect(response.status).toBe(200);
            return response.body;
          });
      };

      PerformanceTestUtils.startMeasurement('concurrent_patient_search');

      const results = await PerformanceTestUtils.simulateConcurrentRequests(
        requestFunction,
        CONCURRENT_USERS,
        LOAD_TEST_REQUESTS
      );

      const benchmark = PerformanceTestUtils.assertPerformance(
        'concurrent_patient_search',
        CONCURRENT_TARGET_MS,
        'Concurrent patient search requests'
      );

      expect(benchmark.passed).toBe(true);
      expect(results.successRate).toBeGreaterThanOrEqual(SUCCESS_RATE_TARGET);
      expect(results.averageResponseTime).toBeLessThanOrEqual(AVERAGE_RESPONSE_TARGET_MS);
    });

    test('should handle concurrent service log queries efficiently', async () => {
      const requestFunction = () => {
        const randomToken = authTokens[Math.floor(Math.random() * authTokens.length)];
        const randomPatientId = testPatientIds[Math.floor(Math.random() * testPatientIds.length)];
        
        return request(app)
          .get('/api/service-logs')
          .set('Authorization', `Bearer ${randomToken}`)
          .query({ 
            patientId: randomPatientId,
            page: 1, 
            limit: 20 
          })
          .then(response => {
            expect(response.status).toBe(200);
            return response.body;
          });
      };

      PerformanceTestUtils.startMeasurement('concurrent_service_log_queries');

      const results = await PerformanceTestUtils.simulateConcurrentRequests(
        requestFunction,
        CONCURRENT_USERS,
        100 // Smaller number for service log queries
      );

      const benchmark = PerformanceTestUtils.assertPerformance(
        'concurrent_service_log_queries',
        CONCURRENT_TARGET_MS,
        'Concurrent service log queries'
      );

      expect(benchmark.passed).toBe(true);
      expect(results.successRate).toBeGreaterThanOrEqual(SUCCESS_RATE_TARGET);
    });
  });

  describe('Concurrent Write Operations', () => {
    test('should handle concurrent patient creation requests', async () => {
      let patientCounter = 0;
      
      const requestFunction = () => {
        const randomToken = authTokens[Math.floor(Math.random() * authTokens.length)];
        const uniqueId = ++patientCounter;
        
        const patientData = {
          firstName: `ConcurrentTest${uniqueId}`,
          lastName: `Patient${uniqueId}`,
          dateOfBirth: '1985-01-15',
          phone: `555${uniqueId.toString().padStart(7, '0')}`,
          email: `concurrent${uniqueId}@example.com`,
          emergencyContact: {
            name: `Emergency${uniqueId}`,
            phone: `666${uniqueId.toString().padStart(7, '0')}`,
            relationship: 'spouse',
          },
        };

        return request(app)
          .post('/api/patients')
          .set('Authorization', `Bearer ${randomToken}`)
          .send(patientData)
          .then(response => {
            if (response.status === 201) {
              return response.body;
            } else {
              throw new Error(`Patient creation failed: ${response.status}`);
            }
          });
      };

      PerformanceTestUtils.startMeasurement('concurrent_patient_creation');

      const results = await PerformanceTestUtils.simulateConcurrentRequests(
        requestFunction,
        25, // Reduce concurrent writes to avoid database locks
        50  // Smaller number for write operations
      );

      const benchmark = PerformanceTestUtils.assertPerformance(
        'concurrent_patient_creation',
        CONCURRENT_TARGET_MS * 2, // Allow more time for write operations
        'Concurrent patient creation requests'
      );

      expect(benchmark.passed).toBe(true);
      expect(results.successRate).toBeGreaterThanOrEqual(90); // Slightly lower threshold for writes
      
      console.log(`Concurrent Patient Creation Results:
        - Success Rate: ${results.successRate.toFixed(2)}%
        - Average Response Time: ${results.averageResponseTime.toFixed(2)}ms`);
    });

    test('should handle concurrent service log creation', async () => {
      let serviceLogCounter = 0;
      
      const requestFunction = () => {
        const randomToken = authTokens[Math.floor(Math.random() * authTokens.length)];
        const randomPatientId = testPatientIds[Math.floor(Math.random() * testPatientIds.length)];
        const uniqueId = ++serviceLogCounter;
        
        const serviceLogData = {
          patientId: randomPatientId,
          serviceType: 'consultation',
          providerId: `provider-${uniqueId}`,
          scheduledDate: new Date(Date.now() + uniqueId * 3600000).toISOString(), // Unique dates
          duration: 30,
          status: 'scheduled',
          priority: 'routine',
          notes: `Concurrent test service log ${uniqueId}`,
          customFields: {
            testId: uniqueId,
            concurrentTest: true,
          },
        };

        return request(app)
          .post('/api/service-logs')
          .set('Authorization', `Bearer ${randomToken}`)
          .send(serviceLogData)
          .then(response => {
            if (response.status === 201) {
              return response.body;
            } else {
              throw new Error(`Service log creation failed: ${response.status}`);
            }
          });
      };

      PerformanceTestUtils.startMeasurement('concurrent_service_log_creation');

      const results = await PerformanceTestUtils.simulateConcurrentRequests(
        requestFunction,
        20, // Even fewer concurrent writes for service logs
        40  // Smaller batch for complex writes
      );

      const benchmark = PerformanceTestUtils.assertPerformance(
        'concurrent_service_log_creation',
        CONCURRENT_TARGET_MS * 2,
        'Concurrent service log creation requests'
      );

      expect(benchmark.passed).toBe(true);
      expect(results.successRate).toBeGreaterThanOrEqual(85); // Lower threshold for complex writes
    });
  });

  describe('Mixed Load Testing', () => {
    test('should handle mixed read/write operations under load', async () => {
      let operationCounter = 0;
      
      const requestFunction = () => {
        const randomToken = authTokens[Math.floor(Math.random() * authTokens.length)];
        const isReadOperation = Math.random() < 0.7; // 70% read, 30% write
        const uniqueId = ++operationCounter;

        if (isReadOperation) {
          // Random read operation
          const operations = [
            () => request(app)
              .get('/api/patients')
              .set('Authorization', `Bearer ${randomToken}`)
              .query({ page: Math.ceil(Math.random() * 5), limit: 20 }),
            
            () => request(app)
              .get('/api/service-logs')
              .set('Authorization', `Bearer ${randomToken}`)
              .query({ page: 1, limit: 10 }),
              
            () => {
              const randomPatientId = testPatientIds[Math.floor(Math.random() * testPatientIds.length)];
              return request(app)
                .get(`/api/patients/${randomPatientId}`)
                .set('Authorization', `Bearer ${randomToken}`);
            }
          ];
          
          const randomOperation = operations[Math.floor(Math.random() * operations.length)];
          return randomOperation().then(response => {
            expect(response.status).toBe(200);
            return { type: 'read', status: response.status };
          });
        } else {
          // Write operation - create patient
          const patientData = {
            firstName: `MixedLoad${uniqueId}`,
            lastName: `Test${uniqueId}`,
            dateOfBirth: '1980-01-01',
            phone: `777${uniqueId.toString().padStart(7, '0')}`,
            emergencyContact: {
              name: `Emergency${uniqueId}`,
              phone: `888${uniqueId.toString().padStart(7, '0')}`,
              relationship: 'parent',
            },
          };

          return request(app)
            .post('/api/patients')
            .set('Authorization', `Bearer ${randomToken}`)
            .send(patientData)
            .then(response => {
              expect([200, 201]).toContain(response.status);
              return { type: 'write', status: response.status };
            });
        }
      };

      PerformanceTestUtils.startMeasurement('mixed_load_testing');

      const results = await PerformanceTestUtils.simulateConcurrentRequests(
        requestFunction,
        30, // Moderate concurrency for mixed operations
        100 // Moderate total requests
      );

      const benchmark = PerformanceTestUtils.assertPerformance(
        'mixed_load_testing',
        CONCURRENT_TARGET_MS * 1.5,
        'Mixed read/write operations under load'
      );

      expect(benchmark.passed).toBe(true);
      expect(results.successRate).toBeGreaterThanOrEqual(90);
      
      console.log(`Mixed Load Testing Results:
        - Success Rate: ${results.successRate.toFixed(2)}%
        - Average Response Time: ${results.averageResponseTime.toFixed(2)}ms
        - Total Duration: ${results.totalTime.toFixed(2)}ms`);
    });
  });

  describe('Authentication Load Testing', () => {
    test('should handle concurrent login requests efficiently', async () => {
      const requestFunction = () => {
        const randomUserIndex = Math.floor(Math.random() * CONCURRENT_USERS);
        
        return request(app)
          .post('/api/auth/login')
          .send({
            username: `testuser${randomUserIndex}`,
            password: 'password123'
          })
          .then(response => {
            if (response.status === 200) {
              return response.body;
            } else {
              throw new Error(`Login failed: ${response.status}`);
            }
          });
      };

      PerformanceTestUtils.startMeasurement('concurrent_auth_requests');

      const results = await PerformanceTestUtils.simulateConcurrentRequests(
        requestFunction,
        CONCURRENT_USERS,
        100 // Test 100 concurrent login attempts
      );

      const benchmark = PerformanceTestUtils.assertPerformance(
        'concurrent_auth_requests',
        CONCURRENT_TARGET_MS,
        'Concurrent authentication requests'
      );

      expect(benchmark.passed).toBe(true);
      expect(results.successRate).toBeGreaterThanOrEqual(SUCCESS_RATE_TARGET);
    });
  });

  describe('Memory Usage Under Load', () => {
    test('should maintain stable memory usage during concurrent operations', async () => {
      const beforeMemory = PerformanceTestUtils.measureMemoryUsage();
      
      const requestFunction = () => {
        const randomToken = authTokens[Math.floor(Math.random() * authTokens.length)];
        
        return request(app)
          .get('/api/patients')
          .set('Authorization', `Bearer ${randomToken}`)
          .query({ page: 1, limit: 50 })
          .then(response => response.body);
      };

      PerformanceTestUtils.startMeasurement('memory_usage_concurrent');

      await PerformanceTestUtils.simulateConcurrentRequests(
        requestFunction,
        CONCURRENT_USERS,
        LOAD_TEST_REQUESTS
      );

      const afterMemory = PerformanceTestUtils.measureMemoryUsage();
      const benchmark = PerformanceTestUtils.assertPerformance(
        'memory_usage_concurrent',
        CONCURRENT_TARGET_MS,
        'Memory usage during concurrent operations'
      );

      const memoryIncrease = afterMemory.heapUsed - beforeMemory.heapUsed;
      const memoryIncreaseInMB = memoryIncrease / (1024 * 1024);

      expect(benchmark.passed).toBe(true);
      expect(memoryIncreaseInMB).toBeLessThan(100); // Should not increase by more than 100MB

      console.log(`Memory Usage Results:
        - Before: ${(beforeMemory.heapUsed / 1024 / 1024).toFixed(2)}MB
        - After: ${(afterMemory.heapUsed / 1024 / 1024).toFixed(2)}MB
        - Increase: ${memoryIncreaseInMB.toFixed(2)}MB`);
    });
  });
});