/**
 * Export Functionality Performance Tests
 * Following documented patterns from devdocs/jest.md
 * Tests export performance with large datasets
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import Database from 'better-sqlite3';
import fs from 'fs/promises';
import path from 'path';
import app from '../../../app';
import { PerformanceTestUtils } from '../utils/PerformanceTestUtils';
import { generateTestToken } from '../../../utils/testHelpers';

describe('Export Performance Tests', () => {
  let db: Database.Database;
  let adminToken: string;
  let testPatientIds: string[] = [];
  
  const EXPORT_TARGET_MS = 5000; // 5 seconds for large exports
  const CSV_GENERATION_TARGET_MS = 2000; // 2 seconds for CSV generation
  const LARGE_DATASET_SIZE = 1000;
  const EXPORT_TEMP_DIR = path.join(process.cwd(), 'temp', 'test-exports');

  beforeAll(async () => {
    // Create temporary export directory
    await fs.mkdir(EXPORT_TEMP_DIR, { recursive: true });

    // Create optimized test database
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = -64000'); // 64MB cache
    db.pragma('temp_store = MEMORY');

    // Create schema with export-optimized indexes
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

      -- Export-optimized indexes
      CREATE INDEX idx_patients_export ON patients(created_at, last_name, first_name);
      CREATE INDEX idx_service_logs_export ON service_logs(scheduled_date, patient_id, status);
      CREATE INDEX idx_service_logs_patient_date ON service_logs(patient_id, scheduled_date);
      CREATE INDEX idx_service_logs_provider ON service_logs(provider_id, scheduled_date);
    `);

    // Create admin user
    db.prepare(`
      INSERT INTO users (id, username, password, first_name, last_name, role)
      VALUES ('admin-user-123', 'admin', '$2b$12$hash', 'Admin', 'User', 'admin')
    `).run();

    adminToken = generateTestToken({ 
      userId: 'admin-user-123', 
      role: 'admin',
      permissions: [
        { resource: 'patients', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'service_logs', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'reports', actions: ['create', 'read', 'export'] }
      ]
    });

    // Populate with large test dataset
    const patients = PerformanceTestUtils.createLargePatientDataset(LARGE_DATASET_SIZE);
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
        'admin-user-123'
      );
      testPatientIds.push(patient.id);
    }

    // Create service logs for export testing
    const serviceLogs = PerformanceTestUtils.createLargeServiceLogDataset(LARGE_DATASET_SIZE * 3, testPatientIds);
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
        'admin-user-123'
      );
    }
  });

  beforeEach(() => {
    PerformanceTestUtils.cleanup();
  });

  afterAll(async () => {
    db.close();
    // Clean up temporary export files
    try {
      const files = await fs.readdir(EXPORT_TEMP_DIR);
      for (const file of files) {
        await fs.unlink(path.join(EXPORT_TEMP_DIR, file));
      }
      await fs.rmdir(EXPORT_TEMP_DIR);
    } catch (error) {
      // Directory might not exist or already be cleaned up
    }
  });

  describe('Patient Data Export Performance', () => {
    test('should export 1000+ patients to CSV within 5 seconds', async () => {
      PerformanceTestUtils.startMeasurement('patient_csv_export');

      const response = await request(app)
        .get('/api/admin/reports/patients/export')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          format: 'csv',
          startDate: '2023-01-01',
          endDate: '2024-12-31',
          includeDeleted: false
        })
        .expect(200);

      const benchmark = PerformanceTestUtils.assertPerformance(
        'patient_csv_export',
        EXPORT_TARGET_MS,
        'Patient CSV export with large dataset'
      );

      expect(benchmark.passed).toBe(true);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.text.length).toBeGreaterThan(1000); // Should have substantial CSV content
      
      // Verify CSV structure
      const lines = response.text.split('\n');
      expect(lines[0]).toContain('id,first_name,last_name'); // Header row
      expect(lines.length).toBeGreaterThan(LARGE_DATASET_SIZE); // Data rows + header
    });

    test('should export patient data to JSON within target time', async () => {
      PerformanceTestUtils.startMeasurement('patient_json_export');

      const response = await request(app)
        .get('/api/admin/reports/patients/export')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          format: 'json',
          limit: 500 // Smaller limit for JSON due to size
        })
        .expect(200);

      const benchmark = PerformanceTestUtils.assertPerformance(
        'patient_json_export',
        CSV_GENERATION_TARGET_MS,
        'Patient JSON export'
      );

      expect(benchmark.passed).toBe(true);
      expect(response.headers['content-type']).toContain('application/json');
      
      const jsonData = JSON.parse(response.text);
      expect(Array.isArray(jsonData.data)).toBe(true);
      expect(jsonData.data.length).toBeGreaterThan(0);
    });
  });

  describe('Service Log Export Performance', () => {
    test('should export service logs with patient data within target time', async () => {
      PerformanceTestUtils.startMeasurement('service_logs_export');

      const response = await request(app)
        .get('/api/admin/reports/service-logs/export')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          format: 'csv',
          startDate: '2023-01-01',
          endDate: '2024-12-31',
          includePatientDetails: true
        })
        .expect(200);

      const benchmark = PerformanceTestUtils.assertPerformance(
        'service_logs_export',
        EXPORT_TARGET_MS,
        'Service logs export with patient JOIN'
      );

      expect(benchmark.passed).toBe(true);
      expect(response.headers['content-type']).toContain('text/csv');
      
      const lines = response.text.split('\n');
      expect(lines[0]).toContain('service_type,patient_name'); // Should include joined patient data
      expect(lines.length).toBeGreaterThan(1000); // Should have many service logs
    });

    test('should handle filtered service log exports efficiently', async () => {
      PerformanceTestUtils.startMeasurement('filtered_service_logs_export');

      const response = await request(app)
        .get('/api/admin/reports/service-logs/export')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          format: 'csv',
          status: 'completed',
          serviceType: 'consultation',
          startDate: '2023-01-01',
          endDate: '2023-12-31'
        })
        .expect(200);

      const benchmark = PerformanceTestUtils.assertPerformance(
        'filtered_service_logs_export',
        CSV_GENERATION_TARGET_MS,
        'Filtered service logs export'
      );

      expect(benchmark.passed).toBe(true);
      expect(response.headers['content-type']).toContain('text/csv');
    });
  });

  describe('Complex Report Export Performance', () => {
    test('should generate comprehensive patient summary report within target time', async () => {
      PerformanceTestUtils.startMeasurement('comprehensive_patient_report');

      const response = await request(app)
        .get('/api/admin/reports/comprehensive')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          format: 'csv',
          includeServiceStats: true,
          includeCustomFields: true,
          startDate: '2023-01-01',
          endDate: '2023-12-31'
        })
        .expect(200);

      const benchmark = PerformanceTestUtils.assertPerformance(
        'comprehensive_patient_report',
        EXPORT_TARGET_MS,
        'Comprehensive patient report with statistics'
      );

      expect(benchmark.passed).toBe(true);
      expect(response.headers['content-type']).toContain('text/csv');
      
      const lines = response.text.split('\n');
      expect(lines[0]).toContain('patient_id,total_services,avg_duration'); // Should include calculated fields
    });

    test('should generate provider performance report efficiently', async () => {
      PerformanceTestUtils.startMeasurement('provider_performance_report');

      const response = await request(app)
        .get('/api/admin/reports/providers/performance')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          format: 'csv',
          startDate: '2023-01-01',
          endDate: '2023-12-31',
          includePatientOutcomes: true
        })
        .expect(200);

      const benchmark = PerformanceTestUtils.assertPerformance(
        'provider_performance_report',
        CSV_GENERATION_TARGET_MS,
        'Provider performance report with aggregations'
      );

      expect(benchmark.passed).toBe(true);
      expect(response.headers['content-type']).toContain('text/csv');
    });
  });

  describe('Memory Efficiency During Exports', () => {
    test('should maintain reasonable memory usage during large CSV export', async () => {
      const beforeMemory = PerformanceTestUtils.measureMemoryUsage();
      
      PerformanceTestUtils.startMeasurement('large_export_memory');

      await request(app)
        .get('/api/admin/reports/service-logs/export')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          format: 'csv',
          startDate: '2020-01-01',
          endDate: '2024-12-31',
          includePatientDetails: true,
          includeCustomFields: true
        })
        .expect(200);

      const afterMemory = PerformanceTestUtils.measureMemoryUsage();
      const benchmark = PerformanceTestUtils.assertPerformance(
        'large_export_memory',
        EXPORT_TARGET_MS,
        'Memory efficiency during large export'
      );

      const memoryIncrease = afterMemory.heapUsed - beforeMemory.heapUsed;
      const memoryIncreaseInMB = memoryIncrease / (1024 * 1024);

      expect(benchmark.passed).toBe(true);
      expect(memoryIncreaseInMB).toBeLessThan(100); // Should not use more than 100MB additional memory

      console.log(`Export Memory Usage:
        - Before: ${(beforeMemory.heapUsed / 1024 / 1024).toFixed(2)}MB
        - After: ${(afterMemory.heapUsed / 1024 / 1024).toFixed(2)}MB
        - Increase: ${memoryIncreaseInMB.toFixed(2)}MB`);
    });
  });

  describe('Export Data Integrity', () => {
    test('should maintain data accuracy in large exports', async () => {
      // First, get the count of records we expect
      const patientCount = db.prepare('SELECT COUNT(*) as count FROM patients WHERE deleted_at IS NULL').get() as { count: number };
      
      PerformanceTestUtils.startMeasurement('export_data_integrity');

      const response = await request(app)
        .get('/api/admin/reports/patients/export')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          format: 'csv',
          includeDeleted: false
        })
        .expect(200);

      const benchmark = PerformanceTestUtils.assertPerformance(
        'export_data_integrity',
        EXPORT_TARGET_MS,
        'Export data integrity verification'
      );

      expect(benchmark.passed).toBe(true);
      
      const lines = response.text.split('\n').filter(line => line.trim()); // Remove empty lines
      const dataRows = lines.slice(1); // Exclude header
      
      expect(dataRows.length).toBe(patientCount.count);
      
      // Verify data format consistency
      const sampleRows = dataRows.slice(0, 10);
      for (const row of sampleRows) {
        const fields = row.split(',');
        expect(fields.length).toBeGreaterThanOrEqual(8); // Should have all required fields
        expect(fields[0]).toMatch(/^[0-9a-f-]+$/); // UUID format for ID
      }
    });

    test('should handle special characters in export data correctly', async () => {
      // Create test patient with special characters
      const specialPatient = {
        id: 'special-test-123',
        firstName: 'John "Johnny" O\'Connor',
        lastName: 'Smith, Jr.',
        dateOfBirth: '1985-01-15',
        phone: '5551234567',
        email: 'john+test@example.com',
        emergencyContact: JSON.stringify({
          name: 'Mary O\'Connor-Smith',
          phone: '5551234568',
          relationship: 'spouse',
        }),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      db.prepare(`
        INSERT INTO patients (id, first_name, last_name, date_of_birth, phone, email, emergency_contact, created_at, updated_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        specialPatient.id,
        specialPatient.firstName,
        specialPatient.lastName,
        specialPatient.dateOfBirth,
        specialPatient.phone,
        specialPatient.email,
        specialPatient.emergencyContact,
        specialPatient.createdAt,
        specialPatient.updatedAt,
        'admin-user-123'
      );

      PerformanceTestUtils.startMeasurement('special_characters_export');

      const response = await request(app)
        .get('/api/admin/reports/patients/export')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          format: 'csv',
          search: 'Johnny'
        })
        .expect(200);

      const benchmark = PerformanceTestUtils.assertPerformance(
        'special_characters_export',
        CSV_GENERATION_TARGET_MS,
        'Export handling of special characters'
      );

      expect(benchmark.passed).toBe(true);
      expect(response.text).toContain('John "Johnny" O\'Connor');
      expect(response.text).toContain('Smith, Jr.');
    });
  });

  describe('Concurrent Export Requests', () => {
    test('should handle multiple concurrent export requests', async () => {
      const concurrentExports = 5;
      
      const exportFunction = () => {
        return request(app)
          .get('/api/admin/reports/patients/export')
          .set('Authorization', `Bearer ${adminToken}`)
          .query({
            format: 'csv',
            limit: 100 // Smaller limit for concurrent tests
          })
          .then(response => {
            expect(response.status).toBe(200);
            return response.text;
          });
      };

      PerformanceTestUtils.startMeasurement('concurrent_exports');

      const results = await PerformanceTestUtils.simulateConcurrentRequests(
        exportFunction,
        concurrentExports,
        concurrentExports // Same number of total requests as concurrent
      );

      const benchmark = PerformanceTestUtils.assertPerformance(
        'concurrent_exports',
        EXPORT_TARGET_MS,
        'Multiple concurrent export requests'
      );

      expect(benchmark.passed).toBe(true);
      expect(results.successRate).toBeGreaterThanOrEqual(90); // Allow for some failures under heavy load
      
      // Verify all exports returned valid CSV data
      const successfulResults = results.results.filter(result => !(result instanceof Error));
      successfulResults.forEach(result => {
        expect(typeof result).toBe('string');
        expect((result as string).includes('id,first_name')).toBe(true); // Should contain CSV header
      });
    });
  });

  describe('Streaming Export Performance', () => {
    test('should support streaming large exports without timeouts', async () => {
      PerformanceTestUtils.startMeasurement('streaming_export');

      const response = await request(app)
        .get('/api/admin/reports/service-logs/stream')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          format: 'csv',
          startDate: '2023-01-01',
          endDate: '2023-12-31'
        })
        .timeout(30000) // 30 second timeout for streaming
        .expect(200);

      const benchmark = PerformanceTestUtils.assertPerformance(
        'streaming_export',
        EXPORT_TARGET_MS * 2, // Allow more time for streaming
        'Streaming export for large datasets'
      );

      expect(benchmark.passed).toBe(true);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['transfer-encoding']).toBe('chunked'); // Should be streaming
    });
  });
});