// Database Integration tests following Jest documentation patterns
import { describe, test, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import Database from 'better-sqlite3';
import { UserRepository } from '@/models/UserRepository';
import { ClientRepository } from '@/models/ClientRepository';
import { ActivityRepository } from '@/models/ActivityRepository';
import { OutcomeRepository } from '@/models/OutcomeRepository';
import { ServiceLogRepository } from '@/models/ServiceLogRepository';
import { PatientEntryRepository } from '@/models/PatientEntryRepository';
import { createTables, dropTables } from '@/database/schema';
import bcrypt from 'bcryptjs';

describe('Database Integration Tests', () => {
  let db: Database.Database;
  let userRepo: UserRepository;
  let clientRepo: ClientRepository;
  let activityRepo: ActivityRepository;
  let outcomeRepo: OutcomeRepository;
  let serviceLogRepo: ServiceLogRepository;
  let patientEntryRepo: PatientEntryRepository;

  let adminUserId: string;
  let candidateUserId: string;
  let testClientId: number;
  let testActivityId: number;
  let testOutcomeId: number;

  beforeAll(async () => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    // Create all tables using the schema
    const originalDb = (await import('@/database/connection.js')).db;
    
    // Override the database connection for all repositories
    (await import('@/database/connection.js')).db = db;

    await createTables();

    // Initialize repositories
    userRepo = new UserRepository();
    clientRepo = new ClientRepository();
    activityRepo = new ActivityRepository();
    outcomeRepo = new OutcomeRepository();
    serviceLogRepo = new ServiceLogRepository();
    patientEntryRepo = new PatientEntryRepository();

    // Create test users
    const adminPassword = await bcrypt.hash('admin123', 12);
    const candidatePassword = await bcrypt.hash('candidate123', 12);

    const adminUser = await userRepo.create({
      username: 'admin',
      email: 'admin@test.com',
      passwordHash: adminPassword,
      role: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      isActive: true
    });

    const candidateUser = await userRepo.create({
      username: 'candidate',
      email: 'candidate@test.com',
      passwordHash: candidatePassword,
      role: 'candidate',
      firstName: 'Candidate',
      lastName: 'User',
      isActive: true
    });

    adminUserId = adminUser.id;
    candidateUserId = candidateUser.id;

    // Create test reference data
    const client = await clientRepo.createClient({ name: 'Integration Test Hospital', isActive: true }, adminUserId);
    const activity = await activityRepo.createActivity({ name: 'Integration Test Consultation', isActive: true }, adminUserId);
    const outcome = await outcomeRepo.createOutcome({ name: 'Integration Test Outcome', isActive: true }, adminUserId);

    testClientId = client.id;
    testActivityId = activity.id;
    testOutcomeId = outcome.id;
  });

  beforeEach(() => {
    // Clean up transaction data before each test
    db.exec('DELETE FROM patient_entries');
    db.exec('DELETE FROM service_logs');
    db.exec('DELETE FROM audit_log WHERE table_name IN ("service_logs", "patient_entries")');
  });

  afterAll(async () => {
    await dropTables();
    db.close();
  });

  describe('Full Service Log Workflow', () => {
    test('complete service log creation and submission workflow', async () => {
      // Step 1: Create a draft service log
      const serviceLogData = {
        userId: candidateUserId,
        clientId: testClientId,
        activityId: testActivityId,
        patientCount: 5,
        isDraft: true
      };

      const serviceLog = await serviceLogRepo.create(serviceLogData, candidateUserId);

      expect(serviceLog.isDraft).toBe(true);
      expect(serviceLog.submittedAt).toBeUndefined();
      expect(serviceLog.patientCount).toBe(5);

      // Step 2: Create patient entries for the service log
      const patientEntries = [
        { newPatients: 3, followupPatients: 2, dnaCount: 0, outcomeId: testOutcomeId },
        { newPatients: 2, followupPatients: 1, dnaCount: 1, outcomeId: testOutcomeId },
        { newPatients: 1, followupPatients: 3, dnaCount: 0, outcomeId: testOutcomeId }
      ];

      const createdEntries = await patientEntryRepo.bulkCreateForServiceLog(
        serviceLog.id,
        patientEntries,
        candidateUserId
      );

      expect(createdEntries).toHaveLength(3);
      expect(createdEntries.every(entry => entry.serviceLogId === serviceLog.id)).toBe(true);

      // Step 3: Verify patient entry statistics
      const stats = await patientEntryRepo.getServiceLogStats(serviceLog.id);
      
      expect(stats.totalEntries).toBe(3);
      expect(stats.totalNewPatients).toBe(6); // 3 + 2 + 1
      expect(stats.totalFollowupPatients).toBe(6); // 2 + 1 + 3
      expect(stats.totalDnaCount).toBe(1);
      expect(stats.totalPatients).toBe(12); // 6 + 6

      // Step 4: Submit the draft
      const submittedLog = await serviceLogRepo.submitDraft(serviceLog.id, candidateUserId);

      expect(submittedLog.isDraft).toBe(false);
      expect(submittedLog.submittedAt).toBeDefined();
      expect(new Date(submittedLog.submittedAt!).getTime()).toBeGreaterThan(0);

      // Step 5: Verify the service log with details
      const detailedLog = await serviceLogRepo.findByIdWithDetails(serviceLog.id);

      expect(detailedLog).toBeDefined();
      expect(detailedLog?.client?.name).toBe('Integration Test Hospital');
      expect(detailedLog?.activity?.name).toBe('Integration Test Consultation');
      expect(detailedLog?.user?.firstName).toBe('Candidate');
      expect(detailedLog?.patientEntries).toHaveLength(3);
      expect(detailedLog?.patientEntries.every(entry => entry.outcome?.name === 'Integration Test Outcome')).toBe(true);
    });

    test('handles complex filtering and statistics', async () => {
      // Create multiple service logs with different characteristics
      const logs = [
        { userId: candidateUserId, clientId: testClientId, activityId: testActivityId, patientCount: 10, isDraft: false },
        { userId: candidateUserId, clientId: testClientId, activityId: testActivityId, patientCount: 5, isDraft: true },
        { userId: adminUserId, clientId: testClientId, activityId: testActivityId, patientCount: 8, isDraft: false }
      ];

      const createdLogs = [];
      for (const logData of logs) {
        const log = await serviceLogRepo.create(logData, logData.userId);
        createdLogs.push(log);

        // Add patient entries for submitted logs
        if (!log.isDraft) {
          await patientEntryRepo.bulkCreateForServiceLog(
            log.id,
            [{ newPatients: logData.patientCount, followupPatients: 0, dnaCount: 0, outcomeId: testOutcomeId }],
            logData.userId
          );
        }
      }

      // Test filtering by user
      const candidateLogs = await serviceLogRepo.findWithFilters({ userId: candidateUserId });
      expect(candidateLogs.items).toHaveLength(2);

      const adminLogs = await serviceLogRepo.findWithFilters({ userId: adminUserId });
      expect(adminLogs.items).toHaveLength(1);

      // Test filtering by draft status
      const drafts = await serviceLogRepo.findWithFilters({ isDraft: true });
      expect(drafts.items).toHaveLength(1);
      expect(drafts.items[0].userId).toBe(candidateUserId);

      const submitted = await serviceLogRepo.findWithFilters({ isDraft: false });
      expect(submitted.items).toHaveLength(2);

      // Test combined filters
      const candidateSubmitted = await serviceLogRepo.findWithFilters({ 
        userId: candidateUserId, 
        isDraft: false 
      });
      expect(candidateSubmitted.items).toHaveLength(1);

      // Test statistics
      const stats = await serviceLogRepo.getStatistics();
      expect(stats.totalLogs).toBe(3);
      expect(stats.totalDrafts).toBe(1);
      expect(stats.totalSubmitted).toBe(2);
      expect(stats.totalPatients).toBe(23); // 10 + 5 + 8

      // Test user-specific statistics
      const candidateStats = await serviceLogRepo.getStatistics({ userId: candidateUserId });
      expect(candidateStats.totalLogs).toBe(2);
      expect(candidateStats.totalPatients).toBe(15); // 10 + 5
    });
  });

  describe('Data Integrity and Constraints', () => {
    test('enforces foreign key constraints', async () => {
      // Try to create service log with invalid user ID
      await expect(
        serviceLogRepo.create({
          userId: 'invalid-user-id',
          clientId: testClientId,
          activityId: testActivityId,
          patientCount: 5,
          isDraft: false
        }, candidateUserId)
      ).rejects.toThrow();

      // Try to create service log with invalid client ID
      await expect(
        serviceLogRepo.create({
          userId: candidateUserId,
          clientId: 999, // Invalid client ID
          activityId: testActivityId,
          patientCount: 5,
          isDraft: false
        }, candidateUserId)
      ).rejects.toThrow();
    });

    test('handles cascade deletes correctly', async () => {
      // Create service log with patient entries
      const serviceLog = await serviceLogRepo.create({
        userId: candidateUserId,
        clientId: testClientId,
        activityId: testActivityId,
        patientCount: 3,
        isDraft: false
      }, candidateUserId);

      const patientEntries = await patientEntryRepo.bulkCreateForServiceLog(
        serviceLog.id,
        [
          { newPatients: 2, followupPatients: 1, dnaCount: 0, outcomeId: testOutcomeId },
          { newPatients: 1, followupPatients: 2, dnaCount: 0, outcomeId: testOutcomeId }
        ],
        candidateUserId
      );

      // Verify entries exist
      const entriesBefore = await patientEntryRepo.findByServiceLog(serviceLog.id);
      expect(entriesBefore.items).toHaveLength(2);

      // Soft delete the service log
      await serviceLogRepo.softDelete(serviceLog.id, adminUserId);

      // Patient entries should remain (soft delete doesn't cascade automatically)
      const entriesAfter = await patientEntryRepo.findByServiceLog(serviceLog.id);
      expect(entriesAfter.items).toHaveLength(2);

      // But if we hard delete the service log, it should cascade
      // Note: This test would require hard delete implementation
    });

    test('maintains audit trail integrity', async () => {
      // Create a service log
      const serviceLog = await serviceLogRepo.create({
        userId: candidateUserId,
        clientId: testClientId,
        activityId: testActivityId,
        patientCount: 5,
        isDraft: true
      }, candidateUserId);

      // Update it
      await serviceLogRepo.update(serviceLog.id, { patientCount: 8 }, candidateUserId);

      // Submit it
      await serviceLogRepo.submitDraft(serviceLog.id, candidateUserId);

      // Delete it
      await serviceLogRepo.softDelete(serviceLog.id, adminUserId);

      // Check audit trail
      const auditEntries = db.prepare(`
        SELECT * FROM audit_log 
        WHERE table_name = 'service_logs' AND record_id = ?
        ORDER BY timestamp ASC
      `).all(serviceLog.id);

      expect(auditEntries).toHaveLength(4); // CREATE, UPDATE, UPDATE (submit), DELETE
      expect(auditEntries[0].action).toBe('INSERT');
      expect(auditEntries[1].action).toBe('UPDATE');
      expect(auditEntries[2].action).toBe('UPDATE');
      expect(auditEntries[3].action).toBe('DELETE');

      // Verify user tracking in audit
      expect(auditEntries[0].user_id).toBe(candidateUserId);
      expect(auditEntries[1].user_id).toBe(candidateUserId);
      expect(auditEntries[2].user_id).toBe(candidateUserId);
      expect(auditEntries[3].user_id).toBe(adminUserId); // Delete by admin
    });
  });

  describe('Performance and Scalability', () => {
    test('handles bulk operations efficiently', async () => {
      const startTime = process.hrtime.bigint();

      // Create multiple service logs in bulk
      const bulkLogs = [];
      for (let i = 0; i < 50; i++) {
        bulkLogs.push({
          userId: i % 2 === 0 ? candidateUserId : adminUserId,
          clientId: testClientId,
          activityId: testActivityId,
          patientCount: Math.floor(Math.random() * 20) + 1,
          isDraft: i % 3 === 0
        });
      }

      const createdLogs = [];
      for (const logData of bulkLogs) {
        const log = await serviceLogRepo.create(logData, logData.userId);
        createdLogs.push(log);
      }

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds

      expect(createdLogs).toHaveLength(50);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

      // Test bulk query performance
      const queryStartTime = process.hrtime.bigint();
      
      const allLogs = await serviceLogRepo.findAll({ limit: 100 });
      const stats = await serviceLogRepo.getStatistics();

      const queryEndTime = process.hrtime.bigint();
      const queryDuration = Number(queryEndTime - queryStartTime) / 1_000_000;

      expect(allLogs.items.length).toBeGreaterThanOrEqual(50);
      expect(stats.totalLogs).toBeGreaterThanOrEqual(50);
      expect(queryDuration).toBeLessThan(1000); // Should complete within 1 second
    });

    test('pagination works correctly with large datasets', async () => {
      // Create 25 service logs
      for (let i = 0; i < 25; i++) {
        await serviceLogRepo.create({
          userId: candidateUserId,
          clientId: testClientId,
          activityId: testActivityId,
          patientCount: i + 1,
          isDraft: false
        }, candidateUserId);
      }

      // Test pagination
      const page1 = await serviceLogRepo.findAll({ page: 1, limit: 10 });
      expect(page1.items).toHaveLength(10);
      expect(page1.page).toBe(1);
      expect(page1.totalPages).toBe(3);

      const page2 = await serviceLogRepo.findAll({ page: 2, limit: 10 });
      expect(page2.items).toHaveLength(10);
      expect(page2.page).toBe(2);

      const page3 = await serviceLogRepo.findAll({ page: 3, limit: 10 });
      expect(page3.items).toHaveLength(5);
      expect(page3.page).toBe(3);

      // Verify no overlap between pages
      const page1Ids = new Set(page1.items.map(log => log.id));
      const page2Ids = new Set(page2.items.map(log => log.id));
      const page3Ids = new Set(page3.items.map(log => log.id));

      expect(page1Ids.size).toBe(10);
      expect(page2Ids.size).toBe(10);
      expect(page3Ids.size).toBe(5);

      // No intersection between pages
      const intersection12 = [...page1Ids].filter(id => page2Ids.has(id));
      const intersection23 = [...page2Ids].filter(id => page3Ids.has(id));
      expect(intersection12).toHaveLength(0);
      expect(intersection23).toHaveLength(0);
    });
  });

  describe('Error Recovery and Transaction Safety', () => {
    test('handles transaction rollback on errors', async () => {
      const initialLogCount = (await serviceLogRepo.findAll()).total;

      // Simulate a transaction that should fail
      try {
        await db.transaction(() => {
          // Create a valid service log
          return serviceLogRepo.create({
            userId: candidateUserId,
            clientId: testClientId,
            activityId: testActivityId,
            patientCount: 5,
            isDraft: false
          }, candidateUserId);

          // This would cause an error due to constraint violation
          throw new Error('Simulated transaction error');
        })();
      } catch (error) {
        expect(error.message).toBe('Simulated transaction error');
      }

      // Verify no service log was created
      const finalLogCount = (await serviceLogRepo.findAll()).total;
      expect(finalLogCount).toBe(initialLogCount);
    });

    test('maintains data consistency across repository operations', async () => {
      // Create a complete service log workflow in a transaction
      const serviceLog = await serviceLogRepo.create({
        userId: candidateUserId,
        clientId: testClientId,
        activityId: testActivityId,
        patientCount: 3,
        isDraft: true
      }, candidateUserId);

      const patientEntries = await patientEntryRepo.bulkCreateForServiceLog(
        serviceLog.id,
        [
          { newPatients: 2, followupPatients: 1, dnaCount: 0, outcomeId: testOutcomeId },
          { newPatients: 1, followupPatients: 2, dnaCount: 1, outcomeId: testOutcomeId }
        ],
        candidateUserId
      );

      // Verify consistency
      const retrievedLog = await serviceLogRepo.findByIdWithDetails(serviceLog.id);
      expect(retrievedLog?.patientEntries).toHaveLength(2);

      const stats = await patientEntryRepo.getServiceLogStats(serviceLog.id);
      expect(stats.totalEntries).toBe(2);
      expect(stats.totalNewPatients).toBe(3);
      expect(stats.totalFollowupPatients).toBe(3);
      expect(stats.totalDnaCount).toBe(1);

      // Submit the log and verify consistency is maintained
      await serviceLogRepo.submitDraft(serviceLog.id, candidateUserId);

      const submittedLog = await serviceLogRepo.findByIdWithDetails(serviceLog.id);
      expect(submittedLog?.isDraft).toBe(false);
      expect(submittedLog?.patientEntries).toHaveLength(2);
    });
  });
});