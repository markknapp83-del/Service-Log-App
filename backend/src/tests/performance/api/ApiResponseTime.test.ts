/**
 * API Response Time Performance Tests
 * Following documented patterns from devdocs/jest.md
 * Tests all API endpoints against <200ms target
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import Database from 'better-sqlite3';
import app from '../../../app';
import { PerformanceTestUtils } from '../utils/PerformanceTestUtils';
import { generateTestToken } from '../../../utils/testHelpers';

describe('API Response Time Performance Tests', () => {
  let db: Database.Database;
  let authToken: string;
  let adminToken: string;
  const API_RESPONSE_TARGET_MS = 200;

  beforeAll(async () => {
    // Create in-memory database for performance testing
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    // Create database schema
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

      CREATE INDEX idx_patients_phone ON patients(phone);
      CREATE INDEX idx_patients_name ON patients(last_name, first_name);
      CREATE INDEX idx_service_logs_patient ON service_logs(patient_id);
      CREATE INDEX idx_service_logs_date ON service_logs(scheduled_date);
      CREATE INDEX idx_service_logs_status ON service_logs(status);
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
      }
    ];

    for (const user of users) {
      db.prepare(`
        INSERT INTO users (id, username, password, first_name, last_name, role)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(user.id, user.username, user.password, user.first_name, user.last_name, user.role);
    }

    // Generate auth tokens
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
        { resource: 'reports', actions: ['create', 'read'] }
      ]
    });

    // Pre-populate with test data for realistic performance testing
    const patients = PerformanceTestUtils.createLargePatientDataset(1000);
    for (const patient of patients.slice(0, 100)) { // Insert subset for initial tests
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
    // Clear any previous measurements
    PerformanceTestUtils.cleanup();
  });

  afterEach(() => {
    // Force garbage collection after each test
    if (global.gc) {
      global.gc();
    }
  });

  afterAll(() => {
    db.close();
  });

  describe('Authentication Endpoints', () => {
    test('POST /api/auth/login should respond within 200ms', async () => {
      PerformanceTestUtils.startMeasurement('login_response_time');

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'staff',
          password: 'password123'
        });

      const benchmark = PerformanceTestUtils.assertPerformance(
        'login_response_time',
        API_RESPONSE_TARGET_MS,
        'User login authentication'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(API_RESPONSE_TARGET_MS);
      expect(response.status).toBe(200);
    });

    test('POST /api/auth/refresh should respond within 200ms', async () => {
      PerformanceTestUtils.startMeasurement('refresh_response_time');

      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${authToken}`);

      const benchmark = PerformanceTestUtils.assertPerformance(
        'refresh_response_time',
        API_RESPONSE_TARGET_MS,
        'JWT token refresh'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(API_RESPONSE_TARGET_MS);
    });
  });

  describe('Patient Management Endpoints', () => {
    test('GET /api/patients should respond within 200ms', async () => {
      PerformanceTestUtils.startMeasurement('patients_list_response_time');

      const response = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 20 });

      const benchmark = PerformanceTestUtils.assertPerformance(
        'patients_list_response_time',
        API_RESPONSE_TARGET_MS,
        'Patient list retrieval with pagination'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(API_RESPONSE_TARGET_MS);
      expect(response.status).toBe(200);
    });

    test('GET /api/patients/:id should respond within 200ms', async () => {
      // Create a test patient first
      const patientResponse = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1985-01-15',
          phone: '5551234567',
          emergencyContact: {
            name: 'Jane Doe',
            phone: '5551234568',
            relationship: 'spouse',
          },
        });

      const patientId = patientResponse.body.data.id;

      PerformanceTestUtils.startMeasurement('patient_detail_response_time');

      const response = await request(app)
        .get(`/api/patients/${patientId}`)
        .set('Authorization', `Bearer ${authToken}`);

      const benchmark = PerformanceTestUtils.assertPerformance(
        'patient_detail_response_time',
        API_RESPONSE_TARGET_MS,
        'Individual patient details retrieval'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(API_RESPONSE_TARGET_MS);
      expect(response.status).toBe(200);
    });

    test('POST /api/patients should respond within 200ms', async () => {
      const patientData = {
        firstName: 'Jane',
        lastName: 'Smith',
        dateOfBirth: '1990-05-20',
        phone: '5559876543',
        email: 'jane@example.com',
        emergencyContact: {
          name: 'John Smith',
          phone: '5559876544',
          relationship: 'spouse',
        },
      };

      PerformanceTestUtils.startMeasurement('patient_creation_response_time');

      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(patientData);

      const benchmark = PerformanceTestUtils.assertPerformance(
        'patient_creation_response_time',
        API_RESPONSE_TARGET_MS,
        'New patient creation'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(API_RESPONSE_TARGET_MS);
      expect(response.status).toBe(201);
    });

    test('PUT /api/patients/:id should respond within 200ms', async () => {
      // Create a test patient first
      const patientResponse = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'Update',
          lastName: 'Test',
          dateOfBirth: '1980-03-10',
          phone: '5555551234',
          emergencyContact: {
            name: 'Emergency Contact',
            phone: '5555551235',
            relationship: 'friend',
          },
        });

      const patientId = patientResponse.body.data.id;

      PerformanceTestUtils.startMeasurement('patient_update_response_time');

      const response = await request(app)
        .put(`/api/patients/${patientId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'Updated' });

      const benchmark = PerformanceTestUtils.assertPerformance(
        'patient_update_response_time',
        API_RESPONSE_TARGET_MS,
        'Patient information update'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(API_RESPONSE_TARGET_MS);
      expect(response.status).toBe(200);
    });
  });

  describe('Service Log Endpoints', () => {
    let testPatientId: string;

    beforeAll(async () => {
      // Create a test patient for service logs
      const patientResponse = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'Service',
          lastName: 'Patient',
          dateOfBirth: '1975-08-12',
          phone: '5551112222',
          emergencyContact: {
            name: 'Emergency Contact',
            phone: '5551112223',
            relationship: 'parent',
          },
        });

      testPatientId = patientResponse.body.data.id;
    });

    test('GET /api/service-logs should respond within 200ms', async () => {
      PerformanceTestUtils.startMeasurement('service_logs_list_response_time');

      const response = await request(app)
        .get('/api/service-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 20 });

      const benchmark = PerformanceTestUtils.assertPerformance(
        'service_logs_list_response_time',
        API_RESPONSE_TARGET_MS,
        'Service logs list retrieval with pagination'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(API_RESPONSE_TARGET_MS);
    });

    test('POST /api/service-logs should respond within 200ms', async () => {
      const serviceLogData = {
        patientId: testPatientId,
        serviceType: 'consultation',
        providerId: 'provider-123',
        scheduledDate: new Date().toISOString(),
        duration: 30,
        status: 'scheduled',
        priority: 'routine',
        notes: 'Performance test service log',
        customFields: {
          symptoms: 'Test symptoms for performance',
          vitals: {
            bloodPressure: '120/80',
            heartRate: 72,
          },
        },
      };

      PerformanceTestUtils.startMeasurement('service_log_creation_response_time');

      const response = await request(app)
        .post('/api/service-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .send(serviceLogData);

      const benchmark = PerformanceTestUtils.assertPerformance(
        'service_log_creation_response_time',
        API_RESPONSE_TARGET_MS,
        'New service log creation'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(API_RESPONSE_TARGET_MS);
    });
  });

  describe('Search and Filter Endpoints', () => {
    test('GET /api/patients with search should respond within 200ms', async () => {
      PerformanceTestUtils.startMeasurement('patient_search_response_time');

      const response = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ 
          search: 'John',
          page: 1, 
          limit: 20 
        });

      const benchmark = PerformanceTestUtils.assertPerformance(
        'patient_search_response_time',
        API_RESPONSE_TARGET_MS,
        'Patient search with text filter'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(API_RESPONSE_TARGET_MS);
      expect(response.status).toBe(200);
    });

    test('GET /api/service-logs with filters should respond within 200ms', async () => {
      PerformanceTestUtils.startMeasurement('service_log_filter_response_time');

      const response = await request(app)
        .get('/api/service-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ 
          status: 'scheduled',
          serviceType: 'consultation',
          page: 1, 
          limit: 20 
        });

      const benchmark = PerformanceTestUtils.assertPerformance(
        'service_log_filter_response_time',
        API_RESPONSE_TARGET_MS,
        'Service log filtering by status and type'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(API_RESPONSE_TARGET_MS);
    });
  });

  describe('Admin Endpoints', () => {
    test('GET /api/admin/users should respond within 200ms', async () => {
      PerformanceTestUtils.startMeasurement('admin_users_response_time');

      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ page: 1, limit: 20 });

      const benchmark = PerformanceTestUtils.assertPerformance(
        'admin_users_response_time',
        API_RESPONSE_TARGET_MS,
        'Admin user management list'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(API_RESPONSE_TARGET_MS);
    });

    test('GET /api/admin/reports/summary should respond within 200ms', async () => {
      PerformanceTestUtils.startMeasurement('admin_reports_response_time');

      const response = await request(app)
        .get('/api/admin/reports/summary')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ 
          startDate: '2023-01-01',
          endDate: '2023-12-31'
        });

      const benchmark = PerformanceTestUtils.assertPerformance(
        'admin_reports_response_time',
        API_RESPONSE_TARGET_MS,
        'Admin summary reports generation'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(API_RESPONSE_TARGET_MS);
    });
  });

  describe('Custom Fields Endpoints', () => {
    test('GET /api/custom-fields should respond within 200ms', async () => {
      PerformanceTestUtils.startMeasurement('custom_fields_response_time');

      const response = await request(app)
        .get('/api/custom-fields')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 20 });

      const benchmark = PerformanceTestUtils.assertPerformance(
        'custom_fields_response_time',
        API_RESPONSE_TARGET_MS,
        'Custom fields configuration retrieval'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(API_RESPONSE_TARGET_MS);
    });

    test('POST /api/custom-fields should respond within 200ms', async () => {
      const customFieldData = {
        name: 'Test Field',
        type: 'text',
        required: false,
        options: null,
        clientId: null,
      };

      PerformanceTestUtils.startMeasurement('custom_field_creation_response_time');

      const response = await request(app)
        .post('/api/custom-fields')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(customFieldData);

      const benchmark = PerformanceTestUtils.assertPerformance(
        'custom_field_creation_response_time',
        API_RESPONSE_TARGET_MS,
        'Custom field creation'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(API_RESPONSE_TARGET_MS);
    });
  });
});