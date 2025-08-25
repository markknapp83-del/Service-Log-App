/**
 * Database Query Optimization Performance Tests
 * Following documented patterns from devdocs/jest.md and devdocs/sqlite-better-sqlite3.md
 * Tests database operations with large datasets (1000+ records)
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import Database from 'better-sqlite3';
import { PerformanceTestUtils } from '../utils/PerformanceTestUtils';
import { PatientRepository } from '../../../models/PatientRepository';
import { ServiceLogRepository } from '../../../models/ServiceLogRepository';

describe('Database Query Optimization Performance Tests', () => {
  let db: Database.Database;
  let patientRepository: PatientRepository;
  let serviceLogRepository: ServiceLogRepository;
  
  const LARGE_DATASET_SIZE = 1000;
  const SERVICE_LOGS_SIZE = 5000;
  const QUERY_TARGET_MS = 100; // Stricter than API target for database operations
  const BULK_OPERATION_TARGET_MS = 2000;
  const COMPLEX_QUERY_TARGET_MS = 500;

  beforeAll(async () => {
    // Create test database with optimized schema
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('temp_store = MEMORY');
    db.pragma('mmap_size = 268435456'); // 256MB

    // Create optimized healthcare schema with proper indexes
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

      -- Performance-optimized indexes
      CREATE INDEX idx_patients_phone ON patients(phone);
      CREATE INDEX idx_patients_name ON patients(last_name, first_name);
      CREATE INDEX idx_patients_search ON patients(first_name, last_name, phone);
      CREATE INDEX idx_patients_active ON patients(deleted_at) WHERE deleted_at IS NULL;
      
      CREATE INDEX idx_service_logs_patient ON service_logs(patient_id);
      CREATE INDEX idx_service_logs_date ON service_logs(scheduled_date);
      CREATE INDEX idx_service_logs_status ON service_logs(status);
      CREATE INDEX idx_service_logs_provider ON service_logs(provider_id);
      CREATE INDEX idx_service_logs_type ON service_logs(service_type);
      CREATE INDEX idx_service_logs_composite ON service_logs(patient_id, scheduled_date, status);
      
      -- Full-text search indexes
      CREATE VIRTUAL TABLE patients_fts USING fts5(
        id, first_name, last_name, phone, email,
        content='patients',
        content_rowid='rowid'
      );
      
      CREATE TRIGGER patients_fts_insert AFTER INSERT ON patients BEGIN
        INSERT INTO patients_fts(rowid, id, first_name, last_name, phone, email)
        VALUES (new.rowid, new.id, new.first_name, new.last_name, new.phone, new.email);
      END;
      
      CREATE TRIGGER patients_fts_delete AFTER DELETE ON patients BEGIN
        INSERT INTO patients_fts(patients_fts, rowid, id, first_name, last_name, phone, email)
        VALUES ('delete', old.rowid, old.id, old.first_name, old.last_name, old.phone, old.email);
      END;
    `);

    // Create test user
    db.prepare(`
      INSERT INTO users (id, username, password, first_name, last_name, role)
      VALUES ('test-user-123', 'testuser', 'hash', 'Test', 'User', 'admin')
    `).run();

    // Initialize repositories
    patientRepository = new PatientRepository();
    serviceLogRepository = new ServiceLogRepository();
    
    // Override database connections for testing
    patientRepository.db = db;
    serviceLogRepository.db = db;
  });

  beforeEach(() => {
    PerformanceTestUtils.cleanup();
  });

  afterAll(() => {
    db.close();
  });

  describe('Bulk Data Operations', () => {
    test('should insert 1000 patients within 2 seconds using transaction', async () => {
      const patients = PerformanceTestUtils.createLargePatientDataset(LARGE_DATASET_SIZE);
      
      PerformanceTestUtils.startMeasurement('bulk_patient_insert');

      // Use transaction for bulk insert performance
      const insertPatients = db.transaction((patientList: any[]) => {
        const insert = db.prepare(`
          INSERT INTO patients (id, first_name, last_name, date_of_birth, phone, email, emergency_contact, created_at, updated_at, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const patient of patientList) {
          insert.run(
            patient.id,
            patient.firstName,
            patient.lastName,
            patient.dateOfBirth,
            patient.phone,
            patient.email,
            patient.emergencyContact,
            patient.createdAt,
            patient.updatedAt,
            'test-user-123'
          );
        }
      });

      insertPatients(patients);

      const benchmark = PerformanceTestUtils.assertPerformance(
        'bulk_patient_insert',
        BULK_OPERATION_TARGET_MS,
        'Bulk patient insertion with transaction'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(BULK_OPERATION_TARGET_MS);

      // Verify all patients were inserted
      const count = db.prepare('SELECT COUNT(*) as count FROM patients').get() as { count: number };
      expect(count.count).toBe(LARGE_DATASET_SIZE);
    });

    test('should insert 5000 service logs within 2 seconds using prepared statements', async () => {
      // First, ensure we have patients
      const patients = PerformanceTestUtils.createLargePatientDataset(100);
      const patientIds = patients.map(p => p.id);
      
      // Insert patients first
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
          'test-user-123'
        );
      }

      const serviceLogs = PerformanceTestUtils.createLargeServiceLogDataset(SERVICE_LOGS_SIZE, patientIds);

      PerformanceTestUtils.startMeasurement('bulk_service_log_insert');

      // Use transaction with prepared statement for optimal performance
      const insertServiceLogs = db.transaction((serviceLogList: any[]) => {
        const insert = db.prepare(`
          INSERT INTO service_logs (id, patient_id, service_type, provider_id, scheduled_date, duration, status, priority, notes, custom_fields, created_at, updated_at, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const serviceLog of serviceLogList) {
          insert.run(
            serviceLog.id,
            serviceLog.patientId,
            serviceLog.serviceType,
            serviceLog.providerId,
            serviceLog.scheduledDate,
            serviceLog.duration,
            serviceLog.status,
            serviceLog.priority,
            serviceLog.notes,
            serviceLog.customFields,
            serviceLog.createdAt,
            serviceLog.updatedAt,
            'test-user-123'
          );
        }
      });

      insertServiceLogs(serviceLogs);

      const benchmark = PerformanceTestUtils.assertPerformance(
        'bulk_service_log_insert',
        BULK_OPERATION_TARGET_MS,
        'Bulk service log insertion with transaction'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(BULK_OPERATION_TARGET_MS);

      // Verify all service logs were inserted
      const count = db.prepare('SELECT COUNT(*) as count FROM service_logs').get() as { count: number };
      expect(count.count).toBe(SERVICE_LOGS_SIZE);
    });
  });

  describe('Query Optimization Tests', () => {
    beforeAll(async () => {
      // Populate database with test data for query optimization tests
      const patients = PerformanceTestUtils.createLargePatientDataset(LARGE_DATASET_SIZE);
      const patientIds = patients.map(p => p.id);

      // Insert patients
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
          'test-user-123'
        );
      }

      // Insert service logs
      const serviceLogs = PerformanceTestUtils.createLargeServiceLogDataset(SERVICE_LOGS_SIZE, patientIds);
      const insertServiceLog = db.prepare(`
        INSERT INTO service_logs (id, patient_id, service_type, provider_id, scheduled_date, duration, status, priority, notes, custom_fields, created_at, updated_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      for (const serviceLog of serviceLogs) {
        insertServiceLog.run(
          serviceLog.id,
          serviceLog.patientId,
          serviceLog.serviceType,
          serviceLog.providerId,
          serviceLog.scheduledDate,
          serviceLog.duration,
          serviceLog.status,
          serviceLog.priority,
          serviceLog.notes,
          serviceLog.customFields,
          serviceLog.createdAt,
          serviceLog.updatedAt,
          'test-user-123'
        );
      }
    });

    test('patient search by name should complete within 100ms', async () => {
      PerformanceTestUtils.startMeasurement('patient_name_search');

      const results = db.prepare(`
        SELECT * FROM patients 
        WHERE (first_name LIKE ? OR last_name LIKE ?) 
        AND deleted_at IS NULL
        ORDER BY last_name, first_name
        LIMIT 20
      `).all('%John%', '%John%');

      const benchmark = PerformanceTestUtils.assertPerformance(
        'patient_name_search',
        QUERY_TARGET_MS,
        'Patient name search with LIKE operator'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(QUERY_TARGET_MS);
      expect(Array.isArray(results)).toBe(true);
    });

    test('patient search by phone should complete within 100ms', async () => {
      PerformanceTestUtils.startMeasurement('patient_phone_search');

      const results = db.prepare(`
        SELECT * FROM patients 
        WHERE phone LIKE ?
        AND deleted_at IS NULL
        LIMIT 20
      `).all('%555%');

      const benchmark = PerformanceTestUtils.assertPerformance(
        'patient_phone_search',
        QUERY_TARGET_MS,
        'Patient phone number search with index'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(QUERY_TARGET_MS);
      expect(Array.isArray(results)).toBe(true);
    });

    test('service logs filtered by date range should complete within 100ms', async () => {
      const startDate = '2023-01-01';
      const endDate = '2024-12-31';

      PerformanceTestUtils.startMeasurement('service_logs_date_filter');

      const results = db.prepare(`
        SELECT * FROM service_logs 
        WHERE scheduled_date >= ? AND scheduled_date <= ?
        ORDER BY scheduled_date DESC
        LIMIT 50
      `).all(startDate, endDate);

      const benchmark = PerformanceTestUtils.assertPerformance(
        'service_logs_date_filter',
        QUERY_TARGET_MS,
        'Service logs date range filtering with index'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(QUERY_TARGET_MS);
      expect(Array.isArray(results)).toBe(true);
    });

    test('service logs by patient with pagination should complete within 100ms', async () => {
      // Get a random patient ID from our dataset
      const patient = db.prepare(`
        SELECT id FROM patients 
        WHERE deleted_at IS NULL 
        LIMIT 1
      `).get() as { id: string };

      PerformanceTestUtils.startMeasurement('service_logs_by_patient');

      const results = db.prepare(`
        SELECT sl.*, p.first_name, p.last_name
        FROM service_logs sl
        JOIN patients p ON p.id = sl.patient_id
        WHERE sl.patient_id = ?
        ORDER BY sl.scheduled_date DESC
        LIMIT 20 OFFSET 0
      `).all(patient.id);

      const benchmark = PerformanceTestUtils.assertPerformance(
        'service_logs_by_patient',
        QUERY_TARGET_MS,
        'Service logs by patient with JOIN and pagination'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(QUERY_TARGET_MS);
      expect(Array.isArray(results)).toBe(true);
    });

    test('complex reporting query should complete within 500ms', async () => {
      PerformanceTestUtils.startMeasurement('complex_reporting_query');

      const results = db.prepare(`
        SELECT 
          p.id,
          p.first_name,
          p.last_name,
          COUNT(sl.id) as total_services,
          COUNT(CASE WHEN sl.status = 'completed' THEN 1 END) as completed_services,
          COUNT(CASE WHEN sl.status = 'cancelled' THEN 1 END) as cancelled_services,
          AVG(sl.duration) as avg_duration,
          MAX(sl.scheduled_date) as last_service_date,
          MIN(sl.scheduled_date) as first_service_date
        FROM patients p
        LEFT JOIN service_logs sl ON p.id = sl.patient_id
        WHERE p.deleted_at IS NULL
        GROUP BY p.id, p.first_name, p.last_name
        HAVING total_services > 0
        ORDER BY total_services DESC
        LIMIT 100
      `).all();

      const benchmark = PerformanceTestUtils.assertPerformance(
        'complex_reporting_query',
        COMPLEX_QUERY_TARGET_MS,
        'Complex reporting query with aggregations and joins'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(COMPLEX_QUERY_TARGET_MS);
      expect(Array.isArray(results)).toBe(true);
    });

    test('full-text search should complete within 100ms', async () => {
      PerformanceTestUtils.startMeasurement('full_text_search');

      const results = db.prepare(`
        SELECT p.* FROM patients p
        JOIN patients_fts fts ON p.rowid = fts.rowid
        WHERE patients_fts MATCH ?
        AND p.deleted_at IS NULL
        ORDER BY rank
        LIMIT 20
      `).all('John OR Smith');

      const benchmark = PerformanceTestUtils.assertPerformance(
        'full_text_search',
        QUERY_TARGET_MS,
        'Full-text search using FTS5'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(QUERY_TARGET_MS);
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Index Effectiveness Tests', () => {
    test('should verify index usage for patient searches', async () => {
      PerformanceTestUtils.startMeasurement('explain_patient_search');

      // Check query plan to ensure index is being used
      const queryPlan = db.prepare(`
        EXPLAIN QUERY PLAN
        SELECT * FROM patients 
        WHERE phone = ?
        AND deleted_at IS NULL
      `).all('5551234567');

      PerformanceTestUtils.endMeasurement('explain_patient_search');

      // Verify that the query uses the phone index
      const planText = queryPlan.map((step: any) => step.detail).join(' ');
      expect(planText.toLowerCase()).toContain('idx_patients_phone');
    });

    test('should verify composite index usage for service logs', async () => {
      PerformanceTestUtils.startMeasurement('explain_service_log_composite');

      const queryPlan = db.prepare(`
        EXPLAIN QUERY PLAN
        SELECT * FROM service_logs 
        WHERE patient_id = ? 
        AND scheduled_date >= ? 
        AND status = ?
        ORDER BY scheduled_date
      `).all('test-patient-123', '2023-01-01', 'scheduled');

      PerformanceTestUtils.endMeasurement('explain_service_log_composite');

      // Verify that the query uses the composite index
      const planText = queryPlan.map((step: any) => step.detail).join(' ');
      expect(planText.toLowerCase()).toContain('idx_service_logs_composite');
    });
  });

  describe('Memory Usage Optimization', () => {
    test('should handle large result sets without excessive memory usage', async () => {
      const beforeMemory = PerformanceTestUtils.measureMemoryUsage();
      
      PerformanceTestUtils.startMeasurement('large_result_set_memory');

      // Query that returns many results
      const results = db.prepare(`
        SELECT * FROM service_logs 
        WHERE status IN ('completed', 'scheduled')
        ORDER BY scheduled_date DESC
        LIMIT 1000
      `).all();

      const afterMemory = PerformanceTestUtils.measureMemoryUsage();
      const benchmark = PerformanceTestUtils.assertPerformance(
        'large_result_set_memory',
        QUERY_TARGET_MS,
        'Large result set memory efficiency'
      );

      expect(benchmark.passed).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      // Memory usage should not increase dramatically
      const memoryIncrease = afterMemory.heapUsed - beforeMemory.heapUsed;
      const memoryIncreaseInMB = memoryIncrease / (1024 * 1024);
      expect(memoryIncreaseInMB).toBeLessThan(50); // Should use less than 50MB for 1000 records
    });
  });

  describe('Connection Pool Performance', () => {
    test('should handle multiple concurrent queries efficiently', async () => {
      const concurrentQueries = 10;
      
      PerformanceTestUtils.startMeasurement('concurrent_queries');

      const queryPromises = Array.from({ length: concurrentQueries }, (_, i) => {
        return new Promise((resolve) => {
          const results = db.prepare(`
            SELECT COUNT(*) as count FROM patients 
            WHERE first_name LIKE ?
          `).get(`%${i}%`);
          resolve(results);
        });
      });

      await Promise.all(queryPromises);

      const benchmark = PerformanceTestUtils.assertPerformance(
        'concurrent_queries',
        COMPLEX_QUERY_TARGET_MS,
        'Multiple concurrent database queries'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(COMPLEX_QUERY_TARGET_MS);
    });
  });
});