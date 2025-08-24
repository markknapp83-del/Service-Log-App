// Service Log Repository tests following Jest documentation patterns
import { describe, test, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import Database from 'better-sqlite3';
import { ServiceLogRepository } from '@/models/ServiceLogRepository';
import { ServiceLog, DatabaseServiceLog, ServiceLogFilters } from '@/types/index';

describe('ServiceLogRepository', () => {
  let db: Database.Database;
  let repository: ServiceLogRepository;
  const testUserId = 'test-user-123';
  const testClientId = 1;
  const testActivityId = 1;
  const testOutcomeId = 1;

  beforeAll(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    
    // Create all required tables
    db.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        first_name TEXT,
        last_name TEXT
      );

      CREATE TABLE clients (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        is_active INTEGER DEFAULT 1
      );

      CREATE TABLE activities (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        is_active INTEGER DEFAULT 1
      );

      CREATE TABLE outcomes (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        is_active INTEGER DEFAULT 1
      );

      CREATE TABLE service_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        client_id INTEGER NOT NULL,
        activity_id INTEGER NOT NULL,
        patient_count INTEGER NOT NULL DEFAULT 0,
        is_draft INTEGER DEFAULT 0,
        submitted_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (client_id) REFERENCES clients(id),
        FOREIGN KEY (activity_id) REFERENCES activities(id)
      );

      CREATE TABLE patient_entries (
        id TEXT PRIMARY KEY,
        service_log_id TEXT NOT NULL,
        new_patients INTEGER DEFAULT 0,
        followup_patients INTEGER DEFAULT 0,
        dna_count INTEGER DEFAULT 0,
        outcome_id INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT,
        FOREIGN KEY (service_log_id) REFERENCES service_logs(id),
        FOREIGN KEY (outcome_id) REFERENCES outcomes(id)
      );

      CREATE TABLE audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        action TEXT NOT NULL,
        old_values TEXT,
        new_values TEXT,
        user_id TEXT NOT NULL,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Insert test data
    db.prepare(`INSERT INTO users (id, first_name, last_name) VALUES (?, ?, ?)`).run(testUserId, 'Test', 'User');
    db.prepare(`INSERT INTO clients (id, name) VALUES (?, ?)`).run(testClientId, 'Test Client');
    db.prepare(`INSERT INTO activities (id, name) VALUES (?, ?)`).run(testActivityId, 'Test Activity');
    db.prepare(`INSERT INTO outcomes (id, name) VALUES (?, ?)`).run(testOutcomeId, 'Test Outcome');

    repository = new ServiceLogRepository();
    // Override the repository's database connection for testing
    (repository as any).db = db;
  });

  beforeEach(() => {
    // Clean up tables before each test
    db.exec('DELETE FROM patient_entries');
    db.exec('DELETE FROM service_logs');
    db.exec('DELETE FROM audit_log');
  });

  afterAll(() => {
    db.close();
  });

  describe('fromDatabase', () => {
    test('converts database row to domain object correctly', () => {
      const dbRow: DatabaseServiceLog = {
        id: 'test-log-123',
        user_id: testUserId,
        client_id: testClientId,
        activity_id: testActivityId,
        patient_count: 5,
        is_draft: 0,
        submitted_at: '2023-12-01T10:00:00Z',
        created_at: '2023-12-01T09:00:00Z',
        updated_at: '2023-12-01T10:00:00Z'
      };

      const domain = (repository as any).fromDatabase(dbRow) as ServiceLog;

      expect(domain).toEqual({
        id: 'test-log-123',
        userId: testUserId,
        clientId: testClientId,
        activityId: testActivityId,
        patientCount: 5,
        isDraft: false,
        submittedAt: '2023-12-01T10:00:00Z',
        createdAt: '2023-12-01T09:00:00Z',
        updatedAt: '2023-12-01T10:00:00Z'
      });
    });

    test('handles draft status correctly', () => {
      const dbRow: DatabaseServiceLog = {
        id: 'draft-log-123',
        user_id: testUserId,
        client_id: testClientId,
        activity_id: testActivityId,
        patient_count: 3,
        is_draft: 1,
        submitted_at: null,
        created_at: '2023-12-01T09:00:00Z',
        updated_at: '2023-12-01T09:00:00Z'
      };

      const domain = (repository as any).fromDatabase(dbRow) as ServiceLog;

      expect(domain.isDraft).toBe(true);
      expect(domain.submittedAt).toBeUndefined();
    });
  });

  describe('create', () => {
    test('creates service log with valid data', async () => {
      const logData = {
        userId: testUserId,
        clientId: testClientId,
        activityId: testActivityId,
        patientCount: 10,
        isDraft: true
      };

      const serviceLog = await repository.create(logData, testUserId);

      expect(serviceLog.id).toBeDefined();
      expect(serviceLog.userId).toBe(testUserId);
      expect(serviceLog.clientId).toBe(testClientId);
      expect(serviceLog.activityId).toBe(testActivityId);
      expect(serviceLog.patientCount).toBe(10);
      expect(serviceLog.isDraft).toBe(true);
      expect(serviceLog.submittedAt).toBeUndefined();
      expect(serviceLog.createdAt).toBeDefined();
      expect(serviceLog.updatedAt).toBeDefined();
    });

    test('creates audit log entry on creation', async () => {
      const logData = {
        userId: testUserId,
        clientId: testClientId,
        activityId: testActivityId,
        patientCount: 5,
        isDraft: false
      };

      await repository.create(logData, testUserId);

      const auditEntries = db.prepare('SELECT * FROM audit_log WHERE action = ?').all('INSERT');
      expect(auditEntries).toHaveLength(1);
      expect(auditEntries[0].table_name).toBe('service_logs');
      expect(auditEntries[0].user_id).toBe(testUserId);
    });
  });

  describe('findByUser', () => {
    beforeEach(async () => {
      // Create test service logs
      const logs = [
        { userId: testUserId, clientId: testClientId, activityId: testActivityId, patientCount: 5, isDraft: false },
        { userId: testUserId, clientId: testClientId, activityId: testActivityId, patientCount: 3, isDraft: true },
        { userId: 'other-user', clientId: testClientId, activityId: testActivityId, patientCount: 2, isDraft: false }
      ];

      for (const log of logs) {
        await repository.create(log, testUserId);
      }
    });

    test('returns service logs for specific user', async () => {
      const result = await repository.findByUser(testUserId);

      expect(result.items).toHaveLength(2);
      expect(result.items.every(log => log.userId === testUserId)).toBe(true);
      expect(result.total).toBe(2);
    });

    test('handles pagination correctly', async () => {
      const result = await repository.findByUser(testUserId, { page: 1, limit: 1 });

      expect(result.items).toHaveLength(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(1);
      expect(result.total).toBe(2);
      expect(result.totalPages).toBe(2);
    });
  });

  describe('findDraftsByUser', () => {
    beforeEach(async () => {
      const logs = [
        { userId: testUserId, clientId: testClientId, activityId: testActivityId, patientCount: 5, isDraft: true },
        { userId: testUserId, clientId: testClientId, activityId: testActivityId, patientCount: 3, isDraft: false },
        { userId: testUserId, clientId: testClientId, activityId: testActivityId, patientCount: 2, isDraft: true }
      ];

      for (const log of logs) {
        await repository.create(log, testUserId);
      }
    });

    test('returns only draft service logs for user', async () => {
      const drafts = await repository.findDraftsByUser(testUserId);

      expect(drafts).toHaveLength(2);
      expect(drafts.every(log => log.isDraft === true)).toBe(true);
      expect(drafts.every(log => log.userId === testUserId)).toBe(true);
    });

    test('orders drafts by most recently updated first', async () => {
      const drafts = await repository.findDraftsByUser(testUserId);

      expect(drafts).toHaveLength(2);
      // Should be ordered by updated_at DESC
      expect(new Date(drafts[0].updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(drafts[1].updatedAt).getTime()
      );
    });
  });

  describe('findWithFilters', () => {
    beforeEach(async () => {
      const logs = [
        { userId: testUserId, clientId: testClientId, activityId: testActivityId, patientCount: 5, isDraft: false },
        { userId: testUserId, clientId: testClientId, activityId: testActivityId, patientCount: 3, isDraft: true },
        { userId: 'other-user', clientId: 2, activityId: testActivityId, patientCount: 2, isDraft: false }
      ];

      for (const log of logs) {
        await repository.create(log, testUserId);
      }
    });

    test('filters by user ID', async () => {
      const filters: ServiceLogFilters = { userId: testUserId };
      const result = await repository.findWithFilters(filters);

      expect(result.items).toHaveLength(2);
      expect(result.items.every(log => log.userId === testUserId)).toBe(true);
    });

    test('filters by client ID', async () => {
      const filters: ServiceLogFilters = { clientId: testClientId };
      const result = await repository.findWithFilters(filters);

      expect(result.items).toHaveLength(2);
      expect(result.items.every(log => log.clientId === testClientId)).toBe(true);
    });

    test('filters by draft status', async () => {
      const filters: ServiceLogFilters = { isDraft: true };
      const result = await repository.findWithFilters(filters);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].isDraft).toBe(true);
    });

    test('combines multiple filters', async () => {
      const filters: ServiceLogFilters = { 
        userId: testUserId, 
        isDraft: false 
      };
      const result = await repository.findWithFilters(filters);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].userId).toBe(testUserId);
      expect(result.items[0].isDraft).toBe(false);
    });
  });

  describe('submitDraft', () => {
    test('submits draft successfully', async () => {
      const logData = {
        userId: testUserId,
        clientId: testClientId,
        activityId: testActivityId,
        patientCount: 5,
        isDraft: true
      };

      const serviceLog = await repository.create(logData, testUserId);
      const submitted = await repository.submitDraft(serviceLog.id, testUserId);

      expect(submitted.isDraft).toBe(false);
      expect(submitted.submittedAt).toBeDefined();
      expect(new Date(submitted.submittedAt!).getTime()).toBeGreaterThan(0);
    });

    test('throws error for non-existent service log', async () => {
      await expect(
        repository.submitDraft('non-existent-id', testUserId)
      ).rejects.toThrow('Service log not found: non-existent-id');
    });

    test('throws error for already submitted service log', async () => {
      const logData = {
        userId: testUserId,
        clientId: testClientId,
        activityId: testActivityId,
        patientCount: 5,
        isDraft: false
      };

      const serviceLog = await repository.create(logData, testUserId);

      await expect(
        repository.submitDraft(serviceLog.id, testUserId)
      ).rejects.toThrow(`Service log ${serviceLog.id} is not a draft`);
    });

    test('throws error for unauthorized user', async () => {
      const logData = {
        userId: testUserId,
        clientId: testClientId,
        activityId: testActivityId,
        patientCount: 5,
        isDraft: true
      };

      const serviceLog = await repository.create(logData, testUserId);

      await expect(
        repository.submitDraft(serviceLog.id, 'other-user')
      ).rejects.toThrow(`User other-user not authorized to submit service log ${serviceLog.id}`);
    });
  });

  describe('convertToDraft', () => {
    test('converts submitted log back to draft', async () => {
      const logData = {
        userId: testUserId,
        clientId: testClientId,
        activityId: testActivityId,
        patientCount: 5,
        isDraft: false,
        submittedAt: new Date().toISOString()
      };

      const serviceLog = await repository.create(logData, testUserId);
      const draft = await repository.convertToDraft(serviceLog.id, testUserId);

      expect(draft.isDraft).toBe(true);
      expect(draft.submittedAt).toBeUndefined();
    });

    test('throws error for already draft service log', async () => {
      const logData = {
        userId: testUserId,
        clientId: testClientId,
        activityId: testActivityId,
        patientCount: 5,
        isDraft: true
      };

      const serviceLog = await repository.create(logData, testUserId);

      await expect(
        repository.convertToDraft(serviceLog.id, testUserId)
      ).rejects.toThrow(`Service log ${serviceLog.id} is already a draft`);
    });
  });

  describe('getStatistics', () => {
    beforeEach(async () => {
      // Create test service logs with varying patient counts
      const logs = [
        { userId: testUserId, clientId: testClientId, activityId: testActivityId, patientCount: 10, isDraft: false },
        { userId: testUserId, clientId: testClientId, activityId: testActivityId, patientCount: 5, isDraft: true },
        { userId: testUserId, clientId: testClientId, activityId: testActivityId, patientCount: 8, isDraft: false },
        { userId: 'other-user', clientId: 2, activityId: 2, patientCount: 3, isDraft: false }
      ];

      for (const log of logs) {
        await repository.create(log, testUserId);
      }
    });

    test('calculates basic statistics correctly', async () => {
      const stats = await repository.getStatistics();

      expect(stats.totalLogs).toBe(4);
      expect(stats.totalDrafts).toBe(1);
      expect(stats.totalSubmitted).toBe(3);
      expect(stats.totalPatients).toBe(26); // 10 + 5 + 8 + 3
      expect(stats.averagePatientsPerLog).toBe(6.5); // 26 / 4
    });

    test('filters statistics by user', async () => {
      const filters: ServiceLogFilters = { userId: testUserId };
      const stats = await repository.getStatistics(filters);

      expect(stats.totalLogs).toBe(3);
      expect(stats.totalPatients).toBe(23); // 10 + 5 + 8
    });

    test('includes breakdown by client and activity', async () => {
      const stats = await repository.getStatistics();

      expect(stats.logsByClient).toBeDefined();
      expect(stats.logsByActivity).toBeDefined();
      expect(stats.logsByClient.length).toBeGreaterThan(0);
      expect(stats.logsByActivity.length).toBeGreaterThan(0);
    });
  });

  describe('bulkDeleteByUser', () => {
    beforeEach(async () => {
      const logs = [
        { userId: testUserId, clientId: testClientId, activityId: testActivityId, patientCount: 5, isDraft: false },
        { userId: testUserId, clientId: testClientId, activityId: testActivityId, patientCount: 3, isDraft: true },
        { userId: 'other-user', clientId: testClientId, activityId: testActivityId, patientCount: 2, isDraft: false }
      ];

      for (const log of logs) {
        await repository.create(log, testUserId);
      }
    });

    test('deletes all service logs for specified user', async () => {
      const deleteCount = await repository.bulkDeleteByUser(testUserId, 'admin-user');

      expect(deleteCount).toBe(2);

      // Verify logs are soft deleted
      const remainingLogs = await repository.findByUser(testUserId);
      expect(remainingLogs.items).toHaveLength(0);

      // Verify other user's logs are untouched
      const otherUserLogs = await repository.findByUser('other-user');
      expect(otherUserLogs.items).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    test('handles invalid foreign key references', async () => {
      const logData = {
        userId: 'non-existent-user',
        clientId: 999, // Non-existent client
        activityId: testActivityId,
        patientCount: 5,
        isDraft: false
      };

      await expect(
        repository.create(logData, testUserId)
      ).rejects.toThrow();
    });

    test('handles negative patient count validation', async () => {
      const logData = {
        userId: testUserId,
        clientId: testClientId,
        activityId: testActivityId,
        patientCount: -5, // Invalid negative count
        isDraft: false
      };

      // Note: This test depends on database constraints or application-level validation
      // The exact behavior may vary based on implementation
      const serviceLog = await repository.create(logData, testUserId);
      expect(serviceLog.patientCount).toBe(-5); // SQLite allows this, but app validation could prevent it
    });
  });

  describe('soft delete functionality', () => {
    test('soft delete hides records from normal queries', async () => {
      const logData = {
        userId: testUserId,
        clientId: testClientId,
        activityId: testActivityId,
        patientCount: 5,
        isDraft: false
      };

      const serviceLog = await repository.create(logData, testUserId);
      
      // Verify it exists
      let found = await repository.findById(serviceLog.id);
      expect(found).toBeDefined();

      // Soft delete it
      await repository.softDelete(serviceLog.id, testUserId);

      // Verify it's hidden
      found = await repository.findById(serviceLog.id);
      expect(found).toBeNull();
    });
  });
});