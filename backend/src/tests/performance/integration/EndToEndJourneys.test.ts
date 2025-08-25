/**
 * End-to-End Performance Journey Tests
 * Following documented patterns from devdocs/jest.md
 * Tests complete user journeys from frontend to backend
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import Database from 'better-sqlite3';
import app from '../../../app';
import { PerformanceTestUtils } from '../utils/PerformanceTestUtils';
import { generateTestToken } from '../../../utils/testHelpers';

describe('End-to-End Performance Journey Tests', () => {
  let db: Database.Database;
  let authToken: string;
  let adminToken: string;
  
  const E2E_JOURNEY_TARGET_MS = 3000; // 3 seconds for complete journeys
  const REGISTRATION_JOURNEY_TARGET_MS = 2000; // 2 seconds for patient registration
  const SERVICE_CREATION_JOURNEY_TARGET_MS = 2500; // 2.5 seconds for service log creation
  const REPORTING_JOURNEY_TARGET_MS = 5000; // 5 seconds for report generation

  beforeAll(async () => {
    // Create optimized test database
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = -64000'); // 64MB cache

    // Create comprehensive schema for E2E testing
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

      CREATE TABLE custom_fields (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        required INTEGER DEFAULT 0,
        options TEXT,
        client_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT NOT NULL,
        FOREIGN KEY (created_by) REFERENCES users (id)
      );

      CREATE TABLE audit_log (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT,
        old_values TEXT,
        new_values TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      );

      -- Performance optimized indexes
      CREATE INDEX idx_patients_phone ON patients(phone);
      CREATE INDEX idx_patients_name ON patients(last_name, first_name);
      CREATE INDEX idx_service_logs_patient ON service_logs(patient_id);
      CREATE INDEX idx_service_logs_date ON service_logs(scheduled_date);
      CREATE INDEX idx_service_logs_status ON service_logs(status);
      CREATE INDEX idx_custom_fields_client ON custom_fields(client_id);
      CREATE INDEX idx_audit_log_user ON audit_log(user_id, created_at);
    `);

    // Create test users
    const users = [
      {
        id: 'admin-user-123',
        username: 'admin',
        password: '$2b$12$hash',
        first_name: 'Admin',
        last_name: 'User',
        role: 'admin'
      },
      {
        id: 'staff-user-456',
        username: 'staff',
        password: '$2b$12$hash',
        first_name: 'Staff',
        last_name: 'User',
        role: 'staff'
      },
      {
        id: 'provider-user-789',
        username: 'provider',
        password: '$2b$12$hash',
        first_name: 'Dr. Provider',
        last_name: 'Smith',
        role: 'provider'
      }
    ];

    for (const user of users) {
      db.prepare(`
        INSERT INTO users (id, username, password, first_name, last_name, role)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(user.id, user.username, user.password, user.first_name, user.last_name, user.role);
    }

    // Generate tokens
    authToken = generateTestToken({ 
      userId: 'staff-user-456', 
      role: 'staff',
      permissions: [
        { resource: 'patients', actions: ['create', 'read', 'update'] },
        { resource: 'service_logs', actions: ['create', 'read', 'update'] }
      ]
    });

    adminToken = generateTestToken({ 
      userId: 'admin-user-123', 
      role: 'admin',
      permissions: [
        { resource: 'patients', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'service_logs', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'users', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'reports', actions: ['create', 'read', 'export'] }
      ]
    });

    // Pre-populate with some test data for journeys
    const testPatients = PerformanceTestUtils.createLargePatientDataset(50);
    for (const patient of testPatients.slice(0, 20)) {
      db.prepare(`
        INSERT INTO patients (id, first_name, last_name, date_of_birth, phone, email, emergency_contact, created_at, updated_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        patient.id,
        patient.firstName,
        patient.lastName,
        patient.dateOfBirth,
        patient.phone,
        patient.email,
        patient.emergencyContact,
        patient.createdAt,
        patient.updatedAt,
        'admin-user-123'
      );
    }
  });

  beforeEach(() => {
    PerformanceTestUtils.cleanup();
  });

  afterEach(() => {
    if (global.gc) {
      global.gc();
    }
  });

  afterAll(() => {
    db.close();
  });

  describe('Patient Registration Journey Performance', () => {
    test('should complete full patient registration workflow within 2 seconds', async () => {
      PerformanceTestUtils.startMeasurement('patient_registration_journey');

      // Step 1: Authenticate user
      const authResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'staff',
          password: 'password123'
        });

      expect(authResponse.status).toBe(200);
      const token = authResponse.body.data.token;

      // Step 2: Validate patient doesn't exist (search)
      const searchResponse = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${token}`)
        .query({ search: '5551234567' });

      expect(searchResponse.status).toBe(200);

      // Step 3: Create new patient
      const patientData = {
        firstName: 'Journey',
        lastName: 'TestPatient',
        dateOfBirth: '1985-01-15',
        phone: '5551234567',
        email: 'journey@test.com',
        emergencyContact: {
          name: 'Emergency Contact',
          phone: '5551234568',
          relationship: 'spouse',
        },
      };

      const createResponse = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${token}`)
        .send(patientData);

      expect(createResponse.status).toBe(201);
      const patientId = createResponse.body.data.id;

      // Step 4: Verify patient was created (fetch by ID)
      const verifyResponse = await request(app)
        .get(`/api/patients/${patientId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.data.firstName).toBe('Journey');

      // Step 5: Log audit trail (implicit in creation)
      const auditResponse = await request(app)
        .get('/api/admin/audit-log')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ resourceId: patientId });

      const benchmark = PerformanceTestUtils.assertPerformance(
        'patient_registration_journey',
        REGISTRATION_JOURNEY_TARGET_MS,
        'Complete patient registration workflow'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(REGISTRATION_JOURNEY_TARGET_MS);

      console.log(`Patient registration journey completed in ${benchmark.actual.toFixed(2)}ms`);
    });

    test('should handle patient registration with validation errors gracefully', async () => {
      PerformanceTestUtils.startMeasurement('patient_registration_validation_journey');

      // Attempt to create patient with invalid data
      const invalidPatientData = {
        firstName: '', // Invalid: empty
        lastName: 'TestPatient',
        dateOfBirth: 'invalid-date', // Invalid: bad format
        phone: '123', // Invalid: too short
        email: 'invalid-email', // Invalid: bad format
      };

      const createResponse = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidPatientData);

      expect(createResponse.status).toBe(400);
      expect(createResponse.body.success).toBe(false);
      expect(createResponse.body.error.code).toBe('VALIDATION_ERROR');

      // Fix validation errors and retry
      const validPatientData = {
        firstName: 'Fixed',
        lastName: 'ValidationPatient',
        dateOfBirth: '1985-01-15',
        phone: '5559876543',
        email: 'fixed@test.com',
        emergencyContact: {
          name: 'Emergency Contact',
          phone: '5559876544',
          relationship: 'parent',
        },
      };

      const retryResponse = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validPatientData);

      expect(retryResponse.status).toBe(201);

      const benchmark = PerformanceTestUtils.assertPerformance(
        'patient_registration_validation_journey',
        REGISTRATION_JOURNEY_TARGET_MS,
        'Patient registration with validation error handling'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(REGISTRATION_JOURNEY_TARGET_MS);
    });
  });

  describe('Service Log Creation Journey Performance', () => {
    test('should complete full service log creation workflow within 2.5 seconds', async () => {
      PerformanceTestUtils.startMeasurement('service_log_creation_journey');

      // Step 1: Get available patients
      const patientsResponse = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 20 });

      expect(patientsResponse.status).toBe(200);
      const patients = patientsResponse.body.data.patients;
      expect(patients.length).toBeGreaterThan(0);

      const selectedPatient = patients[0];

      // Step 2: Get custom fields configuration
      const fieldsResponse = await request(app)
        .get('/api/custom-fields')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ clientId: null });

      expect(fieldsResponse.status).toBe(200);

      // Step 3: Create service log with custom fields
      const serviceLogData = {
        patientId: selectedPatient.id,
        serviceType: 'consultation',
        providerId: 'provider-user-789',
        scheduledDate: new Date().toISOString(),
        duration: 30,
        status: 'scheduled',
        priority: 'routine',
        notes: 'End-to-end journey test service log with comprehensive data',
        customFields: {
          symptoms: 'Test symptoms for E2E journey',
          vitals: {
            bloodPressure: '120/80',
            heartRate: 72,
            temperature: 98.6,
          },
          medications: ['Aspirin 81mg', 'Lisinopril 10mg'],
          allergies: ['Penicillin'],
          insuranceInfo: {
            provider: 'Blue Cross',
            policyNumber: 'BC123456789',
            groupNumber: 'GRP001',
          },
          visitReason: 'Annual wellness exam',
          followUpRequired: true,
          followUpDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
      };

      const createResponse = await request(app)
        .post('/api/service-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .send(serviceLogData);

      expect(createResponse.status).toBe(201);
      const serviceLogId = createResponse.body.data.id;

      // Step 4: Verify service log creation
      const verifyResponse = await request(app)
        .get(`/api/service-logs/${serviceLogId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.data.patientId).toBe(selectedPatient.id);

      // Step 5: Update patient's last visit date
      const updatePatientResponse = await request(app)
        .put(`/api/patients/${selectedPatient.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          lastVisitDate: serviceLogData.scheduledDate,
        });

      const benchmark = PerformanceTestUtils.assertPerformance(
        'service_log_creation_journey',
        SERVICE_CREATION_JOURNEY_TARGET_MS,
        'Complete service log creation workflow with custom fields'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(SERVICE_CREATION_JOURNEY_TARGET_MS);

      console.log(`Service log creation journey completed in ${benchmark.actual.toFixed(2)}ms`);
    });

    test('should handle service log creation with complex custom fields efficiently', async () => {
      PerformanceTestUtils.startMeasurement('complex_service_log_journey');

      // First create custom fields
      const customFields = [];
      for (let i = 0; i < 10; i++) {
        const fieldResponse = await request(app)
          .post('/api/custom-fields')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: `journeyField${i}`,
            label: `Journey Custom Field ${i}`,
            type: ['text', 'select', 'checkbox', 'textarea', 'date'][i % 5],
            required: i % 3 === 0,
            options: i % 5 === 1 ? ['Option A', 'Option B', 'Option C'] : null,
          });

        if (fieldResponse.status === 201) {
          customFields.push(fieldResponse.body.data);
        }
      }

      // Get a patient
      const patientsResponse = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 1 });

      const patientId = patientsResponse.body.data.patients[0].id;

      // Create service log with all custom fields
      const complexCustomFieldsData: any = {};
      customFields.forEach((field, index) => {
        switch (field.type) {
          case 'text':
            complexCustomFieldsData[field.name] = `Text value for field ${index}`;
            break;
          case 'select':
            complexCustomFieldsData[field.name] = 'Option A';
            break;
          case 'checkbox':
            complexCustomFieldsData[field.name] = index % 2 === 0;
            break;
          case 'textarea':
            complexCustomFieldsData[field.name] = `Long text value for textarea field ${index}. This contains multiple sentences to test the performance of handling large text values.`;
            break;
          case 'date':
            complexCustomFieldsData[field.name] = new Date().toISOString().split('T')[0];
            break;
        }
      });

      const serviceLogData = {
        patientId,
        serviceType: 'comprehensive-exam',
        providerId: 'provider-user-789',
        scheduledDate: new Date().toISOString(),
        duration: 90,
        status: 'scheduled',
        priority: 'routine',
        notes: 'Complex service log with extensive custom field data for performance testing',
        customFields: complexCustomFieldsData,
      };

      const createResponse = await request(app)
        .post('/api/service-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .send(serviceLogData);

      expect(createResponse.status).toBe(201);

      const benchmark = PerformanceTestUtils.assertPerformance(
        'complex_service_log_journey',
        SERVICE_CREATION_JOURNEY_TARGET_MS * 1.5, // Allow more time for complex data
        'Service log creation with complex custom fields'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(SERVICE_CREATION_JOURNEY_TARGET_MS * 1.5);
    });
  });

  describe('Healthcare Reporting Journey Performance', () => {
    test('should generate comprehensive patient report within 5 seconds', async () => {
      PerformanceTestUtils.startMeasurement('patient_report_journey');

      // Step 1: Get patient list for report
      const patientsResponse = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ 
          page: 1, 
          limit: 50,
          includeStats: true
        });

      expect(patientsResponse.status).toBe(200);

      // Step 2: Get service logs for reporting period
      const serviceLogsResponse = await request(app)
        .get('/api/service-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          startDate: '2023-01-01',
          endDate: '2024-12-31',
          includePatientDetails: true,
          page: 1,
          limit: 100
        });

      expect(serviceLogsResponse.status).toBe(200);

      // Step 3: Generate summary statistics
      const summaryResponse = await request(app)
        .get('/api/admin/reports/summary')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          startDate: '2023-01-01',
          endDate: '2024-12-31',
          includeCharts: true
        });

      expect(summaryResponse.status).toBe(200);

      // Step 4: Generate patient outcomes report
      const outcomesResponse = await request(app)
        .get('/api/admin/reports/patient-outcomes')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          startDate: '2023-01-01',
          endDate: '2024-12-31',
          groupBy: 'month'
        });

      expect(outcomesResponse.status).toBe(200);

      // Step 5: Export report as CSV
      const exportResponse = await request(app)
        .get('/api/admin/reports/comprehensive/export')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          format: 'csv',
          startDate: '2023-01-01',
          endDate: '2024-12-31'
        });

      expect(exportResponse.status).toBe(200);
      expect(exportResponse.headers['content-type']).toContain('text/csv');

      const benchmark = PerformanceTestUtils.assertPerformance(
        'patient_report_journey',
        REPORTING_JOURNEY_TARGET_MS,
        'Comprehensive patient reporting workflow'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(REPORTING_JOURNEY_TARGET_MS);

      console.log(`Patient reporting journey completed in ${benchmark.actual.toFixed(2)}ms`);
    });

    test('should handle concurrent report requests efficiently', async () => {
      PerformanceTestUtils.startMeasurement('concurrent_reports_journey');

      // Create multiple concurrent report requests
      const reportRequests = [
        request(app)
          .get('/api/admin/reports/summary')
          .set('Authorization', `Bearer ${adminToken}`)
          .query({ startDate: '2023-01-01', endDate: '2023-03-31' }),
        
        request(app)
          .get('/api/admin/reports/summary')
          .set('Authorization', `Bearer ${adminToken}`)
          .query({ startDate: '2023-04-01', endDate: '2023-06-30' }),
        
        request(app)
          .get('/api/admin/reports/summary')
          .set('Authorization', `Bearer ${adminToken}`)
          .query({ startDate: '2023-07-01', endDate: '2023-09-30' }),
        
        request(app)
          .get('/api/admin/reports/patient-outcomes')
          .set('Authorization', `Bearer ${adminToken}`)
          .query({ startDate: '2023-01-01', endDate: '2023-12-31' }),

        request(app)
          .get('/api/admin/reports/providers/performance')
          .set('Authorization', `Bearer ${adminToken}`)
          .query({ startDate: '2023-01-01', endDate: '2023-12-31' }),
      ];

      const results = await Promise.allSettled(reportRequests);

      // All requests should succeed
      const successfulRequests = results.filter(result => 
        result.status === 'fulfilled' && result.value.status === 200
      ).length;

      expect(successfulRequests).toBeGreaterThanOrEqual(4); // At least 4 of 5 should succeed

      const benchmark = PerformanceTestUtils.assertPerformance(
        'concurrent_reports_journey',
        REPORTING_JOURNEY_TARGET_MS,
        'Concurrent healthcare report generation'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(REPORTING_JOURNEY_TARGET_MS);
    });
  });

  describe('Admin User Management Journey Performance', () => {
    test('should complete user management workflow efficiently', async () => {
      PerformanceTestUtils.startMeasurement('user_management_journey');

      // Step 1: List existing users
      const usersListResponse = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ page: 1, limit: 20 });

      expect(usersListResponse.status).toBe(200);

      // Step 2: Create new user
      const newUserData = {
        username: 'journey-user',
        password: 'SecurePassword123!',
        firstName: 'Journey',
        lastName: 'User',
        role: 'staff',
        email: 'journey-user@test.com',
        permissions: [
          { resource: 'patients', actions: ['read', 'create', 'update'] },
          { resource: 'service_logs', actions: ['read', 'create'] }
        ],
      };

      const createUserResponse = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newUserData);

      expect(createUserResponse.status).toBe(201);
      const userId = createUserResponse.body.data.id;

      // Step 3: Update user permissions
      const updateUserResponse = await request(app)
        .put(`/api/admin/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          permissions: [
            { resource: 'patients', actions: ['read', 'create', 'update', 'delete'] },
            { resource: 'service_logs', actions: ['read', 'create', 'update'] }
          ],
        });

      expect(updateUserResponse.status).toBe(200);

      // Step 4: Get user activity audit
      const auditResponse = await request(app)
        .get('/api/admin/users/audit')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ userId, limit: 10 });

      // Step 5: Deactivate user
      const deactivateResponse = await request(app)
        .put(`/api/admin/users/${userId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(deactivateResponse.status).toBe(200);

      const benchmark = PerformanceTestUtils.assertPerformance(
        'user_management_journey',
        E2E_JOURNEY_TARGET_MS,
        'Complete user management workflow'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(E2E_JOURNEY_TARGET_MS);

      console.log(`User management journey completed in ${benchmark.actual.toFixed(2)}ms`);
    });
  });

  describe('Healthcare Compliance Journey Performance', () => {
    test('should handle HIPAA audit trail generation efficiently', async () => {
      PerformanceTestUtils.startMeasurement('hipaa_audit_journey');

      // Create some auditable activities
      const patientData = {
        firstName: 'HIPAA',
        lastName: 'TestPatient',
        dateOfBirth: '1980-01-01',
        phone: '5555555555',
        emergencyContact: {
          name: 'Emergency',
          phone: '5555555556',
          relationship: 'spouse',
        },
      };

      const patientResponse = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(patientData);

      const patientId = patientResponse.body.data.id;

      // View patient (auditable)
      await request(app)
        .get(`/api/patients/${patientId}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Update patient (auditable)
      await request(app)
        .put(`/api/patients/${patientId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: 'hipaa-updated@test.com' });

      // Create service log (auditable)
      const serviceLogResponse = await request(app)
        .post('/api/service-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          patientId,
          serviceType: 'consultation',
          providerId: 'provider-user-789',
          scheduledDate: new Date().toISOString(),
          duration: 30,
          status: 'completed',
          priority: 'routine',
          notes: 'HIPAA compliance audit test',
        });

      // Generate comprehensive audit report
      const auditReportResponse = await request(app)
        .get('/api/admin/audit-log')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          resourceId: patientId,
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Last 24 hours
          endDate: new Date().toISOString(),
          includeUserDetails: true,
          export: true
        });

      expect(auditReportResponse.status).toBe(200);

      const benchmark = PerformanceTestUtils.assertPerformance(
        'hipaa_audit_journey',
        E2E_JOURNEY_TARGET_MS,
        'HIPAA compliance audit trail generation'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(E2E_JOURNEY_TARGET_MS);

      console.log(`HIPAA audit journey completed in ${benchmark.actual.toFixed(2)}ms`);
    });
  });

  describe('System Performance Under Load', () => {
    test('should maintain performance during high-volume healthcare operations', async () => {
      PerformanceTestUtils.startMeasurement('high_volume_operations');

      // Simulate busy healthcare environment with concurrent operations
      const operationPromises = [];

      // Patient registrations
      for (let i = 0; i < 10; i++) {
        operationPromises.push(
          request(app)
            .post('/api/patients')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              firstName: `BulkPatient${i}`,
              lastName: 'Test',
              dateOfBirth: '1985-01-01',
              phone: `555000${i.toString().padStart(4, '0')}`,
              emergencyContact: {
                name: 'Emergency',
                phone: `666000${i.toString().padStart(4, '0')}`,
                relationship: 'parent',
              },
            })
        );
      }

      // Service log queries
      for (let i = 0; i < 15; i++) {
        operationPromises.push(
          request(app)
            .get('/api/service-logs')
            .set('Authorization', `Bearer ${authToken}`)
            .query({ page: Math.floor(i / 5) + 1, limit: 20 })
        );
      }

      // Patient searches
      for (let i = 0; i < 20; i++) {
        operationPromises.push(
          request(app)
            .get('/api/patients')
            .set('Authorization', `Bearer ${authToken}`)
            .query({ search: `Patient${i % 10}` })
        );
      }

      // Dashboard data requests
      for (let i = 0; i < 5; i++) {
        operationPromises.push(
          request(app)
            .get('/api/dashboard')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const results = await Promise.allSettled(operationPromises);
      
      const successfulOperations = results.filter(result => 
        result.status === 'fulfilled' && 
        result.value.status >= 200 && 
        result.value.status < 300
      ).length;

      // Should handle most operations successfully
      const successRate = (successfulOperations / operationPromises.length) * 100;
      expect(successRate).toBeGreaterThan(90); // 90% success rate

      const benchmark = PerformanceTestUtils.assertPerformance(
        'high_volume_operations',
        E2E_JOURNEY_TARGET_MS * 2, // Allow more time for concurrent operations
        `High-volume healthcare operations (${operationPromises.length} concurrent requests)`
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(E2E_JOURNEY_TARGET_MS * 2);

      console.log(`High-volume operations completed in ${benchmark.actual.toFixed(2)}ms with ${successRate.toFixed(1)}% success rate`);
    });
  });
});