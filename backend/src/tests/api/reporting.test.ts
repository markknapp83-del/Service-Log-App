// Backend API Tests for Phase 7 Enhanced Service Logs API
// Following Jest documentation patterns for healthcare data testing

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import { app } from '../../app';
import { Database } from 'better-sqlite3';
import { getDatabase } from '../../database/connection';
import { AuthService } from '../../services/AuthService';
import { ServiceLogRepository } from '../../models/ServiceLogRepository';
import { ClientRepository } from '../../models/ClientRepository';
import { ActivityRepository } from '../../models/ActivityRepository';
import { OutcomeRepository } from '../../models/OutcomeRepository';
import { PatientEntryRepository } from '../../models/PatientEntryRepository';

describe('Phase 7 - Enhanced Service Logs API', () => {
  let db: Database;
  let adminToken: string;
  let candidateToken: string;
  let serviceLogRepo: ServiceLogRepository;
  let clientRepo: ClientRepository;
  let activityRepo: ActivityRepository;
  let outcomeRepo: OutcomeRepository;
  let patientEntryRepo: PatientEntryRepository;

  // Test data IDs
  let testClientId: string;
  let testActivityId: string;
  let testOutcomeId: string;
  let testServiceLogId: string;
  let testCandidateId: string;

  beforeAll(async () => {
    // Initialize database and repositories
    db = getDatabase();
    serviceLogRepo = new ServiceLogRepository();
    clientRepo = new ClientRepository();
    activityRepo = new ActivityRepository();
    outcomeRepo = new OutcomeRepository();
    patientEntryRepo = new PatientEntryRepository();

    // Create test users
    const authService = new AuthService();
    
    // Create admin user
    const adminUser = await authService.registerUser({
      email: 'admin@test.com',
      password: 'Admin123!',
      role: 'admin',
      firstName: 'Test',
      lastName: 'Admin'
    });
    adminToken = authService.generateToken(adminUser.id, adminUser.role);

    // Create candidate user
    const candidateUser = await authService.registerUser({
      email: 'candidate@test.com',
      password: 'Candidate123!',
      role: 'candidate',
      firstName: 'Test',
      lastName: 'Candidate'
    });
    candidateToken = authService.generateToken(candidateUser.id, candidateUser.role);
    testCandidateId = candidateUser.id;
  });

  beforeEach(async () => {
    // Create test reference data
    const testClient = await clientRepo.create({
      name: 'Test Healthcare Clinic',
      isActive: true
    });
    testClientId = testClient.id;

    const testActivity = await activityRepo.create({
      name: 'General Consultation',
      isActive: true
    });
    testActivityId = testActivity.id;

    const testOutcome = await outcomeRepo.create({
      name: 'Treatment Completed',
      isActive: true
    });
    testOutcomeId = testOutcome.id;

    // Create test service log
    const testServiceLog = await serviceLogRepo.create({
      userId: testCandidateId,
      clientId: testClientId,
      activityId: testActivityId,
      serviceDate: '2023-12-01',
      patientCount: 3,
      isDraft: false,
      submittedAt: new Date().toISOString()
    });
    testServiceLogId = testServiceLog.id;

    // Create test patient entries
    await patientEntryRepo.create({
      serviceLogId: testServiceLogId,
      appointmentType: 'new',
      outcomeId: testOutcomeId
    });
    await patientEntryRepo.create({
      serviceLogId: testServiceLogId,
      appointmentType: 'followup',
      outcomeId: testOutcomeId
    });
    await patientEntryRepo.create({
      serviceLogId: testServiceLogId,
      appointmentType: 'dna',
      outcomeId: testOutcomeId
    });
  });

  afterEach(async () => {
    // Clean up test data in proper order
    const serviceLogs = await serviceLogRepo.findAll({ limit: 1000 });
    for (const log of serviceLogs.items) {
      await serviceLogRepo.delete(log.id);
    }

    const clients = await clientRepo.findAll({ limit: 1000 });
    for (const client of clients.items) {
      await clientRepo.delete(client.id);
    }

    const activities = await activityRepo.findAll({ limit: 1000 });
    for (const activity of activities.items) {
      await activityRepo.delete(activity.id);
    }

    const outcomes = await outcomeRepo.findAll({ limit: 1000 });
    for (const outcome of outcomes.items) {
      await outcomeRepo.delete(outcome.id);
    }
  });

  describe('GET /api/service-logs - Enhanced filtering and pagination', () => {
    test('should return service logs for admin with all data', async () => {
      const response = await request(app)
        .get('/api/service-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.serviceLogs).toHaveLength(1);
      expect(response.body.data.pagination).toMatchObject({
        page: 1,
        limit: 20,
        total: 1,
        pages: 1
      });

      const serviceLog = response.body.data.serviceLogs[0];
      expect(serviceLog).toMatchObject({
        id: testServiceLogId,
        userId: testCandidateId,
        clientId: testClientId,
        activityId: testActivityId,
        serviceDate: '2023-12-01',
        patientCount: 3,
        isDraft: false
      });
    });

    test('should return only candidate own service logs for candidate user', async () => {
      // Create another candidate with their own service log
      const authService = new AuthService();
      const otherCandidate = await authService.registerUser({
        email: 'other@test.com',
        password: 'Other123!',
        role: 'candidate',
        firstName: 'Other',
        lastName: 'Candidate'
      });
      const otherToken = authService.generateToken(otherCandidate.id, otherCandidate.role);

      // Create service log for other candidate
      await serviceLogRepo.create({
        userId: otherCandidate.id,
        clientId: testClientId,
        activityId: testActivityId,
        serviceDate: '2023-12-02',
        patientCount: 2,
        isDraft: false,
        submittedAt: new Date().toISOString()
      });

      // Candidate should only see their own logs
      const response = await request(app)
        .get('/api/service-logs')
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(200);

      expect(response.body.data.serviceLogs).toHaveLength(1);
      expect(response.body.data.serviceLogs[0].userId).toBe(testCandidateId);
    });

    test('should filter by date range correctly', async () => {
      // Create additional service logs with different dates
      await serviceLogRepo.create({
        userId: testCandidateId,
        clientId: testClientId,
        activityId: testActivityId,
        serviceDate: '2023-11-15',
        patientCount: 1,
        isDraft: false,
        submittedAt: new Date().toISOString()
      });

      await serviceLogRepo.create({
        userId: testCandidateId,
        clientId: testClientId,
        activityId: testActivityId,
        serviceDate: '2023-12-15',
        patientCount: 2,
        isDraft: false,
        submittedAt: new Date().toISOString()
      });

      // Test date range filtering
      const response = await request(app)
        .get('/api/service-logs?dateFrom=2023-12-01&dateTo=2023-12-10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.serviceLogs).toHaveLength(1);
      expect(response.body.data.serviceLogs[0].serviceDate).toBe('2023-12-01');
    });

    test('should filter by clientId correctly', async () => {
      // Create another client and service log
      const anotherClient = await clientRepo.create({
        name: 'Another Clinic',
        isActive: true
      });

      await serviceLogRepo.create({
        userId: testCandidateId,
        clientId: anotherClient.id,
        activityId: testActivityId,
        serviceDate: '2023-12-02',
        patientCount: 1,
        isDraft: false,
        submittedAt: new Date().toISOString()
      });

      // Filter by specific client
      const response = await request(app)
        .get(`/api/service-logs?clientId=${testClientId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.serviceLogs).toHaveLength(1);
      expect(response.body.data.serviceLogs[0].clientId).toBe(testClientId);
    });

    test('should filter by activityId correctly', async () => {
      // Create another activity and service log
      const anotherActivity = await activityRepo.create({
        name: 'Physical Therapy',
        isActive: true
      });

      await serviceLogRepo.create({
        userId: testCandidateId,
        clientId: testClientId,
        activityId: anotherActivity.id,
        serviceDate: '2023-12-02',
        patientCount: 1,
        isDraft: false,
        submittedAt: new Date().toISOString()
      });

      // Filter by specific activity
      const response = await request(app)
        .get(`/api/service-logs?activityId=${testActivityId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.serviceLogs).toHaveLength(1);
      expect(response.body.data.serviceLogs[0].activityId).toBe(testActivityId);
    });

    test('should filter by userId for admin users', async () => {
      // Create another candidate and their service log
      const authService = new AuthService();
      const otherCandidate = await authService.registerUser({
        email: 'other2@test.com',
        password: 'Other123!',
        role: 'candidate',
        firstName: 'Other2',
        lastName: 'Candidate'
      });

      await serviceLogRepo.create({
        userId: otherCandidate.id,
        clientId: testClientId,
        activityId: testActivityId,
        serviceDate: '2023-12-02',
        patientCount: 1,
        isDraft: false,
        submittedAt: new Date().toISOString()
      });

      // Admin can filter by specific user
      const response = await request(app)
        .get(`/api/service-logs?userId=${testCandidateId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.serviceLogs).toHaveLength(1);
      expect(response.body.data.serviceLogs[0].userId).toBe(testCandidateId);
    });

    test('should filter by isDraft correctly', async () => {
      // Create a draft service log
      await serviceLogRepo.create({
        userId: testCandidateId,
        clientId: testClientId,
        activityId: testActivityId,
        serviceDate: '2023-12-02',
        patientCount: 1,
        isDraft: true,
        submittedAt: undefined
      });

      // Filter for drafts only
      const draftResponse = await request(app)
        .get('/api/service-logs?isDraft=true')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(draftResponse.body.data.serviceLogs).toHaveLength(1);
      expect(draftResponse.body.data.serviceLogs[0].isDraft).toBe(true);

      // Filter for submitted only
      const submittedResponse = await request(app)
        .get('/api/service-logs?isDraft=false')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(submittedResponse.body.data.serviceLogs).toHaveLength(1);
      expect(submittedResponse.body.data.serviceLogs[0].isDraft).toBe(false);
    });

    test('should handle pagination correctly', async () => {
      // Create multiple service logs
      for (let i = 0; i < 25; i++) {
        await serviceLogRepo.create({
          userId: testCandidateId,
          clientId: testClientId,
          activityId: testActivityId,
          serviceDate: `2023-12-${String(i + 1).padStart(2, '0')}`,
          patientCount: 1,
          isDraft: false,
          submittedAt: new Date().toISOString()
        });
      }

      // Test first page
      const page1Response = await request(app)
        .get('/api/service-logs?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(page1Response.body.data.serviceLogs).toHaveLength(10);
      expect(page1Response.body.data.pagination.page).toBe(1);
      expect(page1Response.body.data.pagination.pages).toBeGreaterThan(2);

      // Test second page
      const page2Response = await request(app)
        .get('/api/service-logs?page=2&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(page2Response.body.data.serviceLogs).toHaveLength(10);
      expect(page2Response.body.data.pagination.page).toBe(2);
    });

    test('should require authentication', async () => {
      await request(app)
        .get('/api/service-logs')
        .expect(401);
    });

    test('should reject invalid tokens', async () => {
      await request(app)
        .get('/api/service-logs')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    test('should handle combined filters correctly', async () => {
      // Create service logs with different combinations
      const anotherClient = await clientRepo.create({ name: 'Other Clinic', isActive: true });
      
      await serviceLogRepo.create({
        userId: testCandidateId,
        clientId: anotherClient.id,
        activityId: testActivityId,
        serviceDate: '2023-12-05',
        patientCount: 2,
        isDraft: true
      });

      // Test multiple filters
      const response = await request(app)
        .get(`/api/service-logs?clientId=${testClientId}&isDraft=false&dateFrom=2023-11-01&dateTo=2023-12-31`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.serviceLogs).toHaveLength(1);
      const log = response.body.data.serviceLogs[0];
      expect(log.clientId).toBe(testClientId);
      expect(log.isDraft).toBe(false);
    });

    test('should handle performance with large datasets', async () => {
      const startTime = Date.now();

      // Create a moderate number of test records
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          serviceLogRepo.create({
            userId: testCandidateId,
            clientId: testClientId,
            activityId: testActivityId,
            serviceDate: `2023-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 30) + 1).padStart(2, '0')}`,
            patientCount: i % 5 + 1,
            isDraft: i % 4 === 0,
            submittedAt: i % 4 !== 0 ? new Date().toISOString() : undefined
          })
        );
      }
      await Promise.all(promises);

      // Test API response time
      const response = await request(app)
        .get('/api/service-logs?page=1&limit=50')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      
      // API should respond within 200ms as per documented targets
      expect(responseTime).toBeLessThan(200);
      expect(response.body.data.serviceLogs).toHaveLength(50);
      expect(response.body.data.pagination.total).toBeGreaterThan(100);
    });
  });

  describe('GET /api/service-logs/:id - Single service log with details', () => {
    test('should return complete service log with patient entries', async () => {
      const response = await request(app)
        .get(`/api/service-logs/${testServiceLogId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: testServiceLogId,
        userId: testCandidateId,
        clientId: testClientId,
        activityId: testActivityId,
        serviceDate: '2023-12-01',
        patientCount: 3,
        isDraft: false
      });

      // Should include patient entries
      expect(response.body.data.patientEntries).toHaveLength(3);
      expect(response.body.data.patientEntries[0]).toHaveProperty('appointmentType');
      expect(response.body.data.patientEntries[0]).toHaveProperty('outcomeId');
    });

    test('should allow candidate to access their own service log', async () => {
      const response = await request(app)
        .get(`/api/service-logs/${testServiceLogId}`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testServiceLogId);
    });

    test('should deny candidate access to other users service logs', async () => {
      // Create another candidate and their service log
      const authService = new AuthService();
      const otherCandidate = await authService.registerUser({
        email: 'other3@test.com',
        password: 'Other123!',
        role: 'candidate',
        firstName: 'Other3',
        lastName: 'Candidate'
      });
      const otherToken = authService.generateToken(otherCandidate.id, otherCandidate.role);

      const otherServiceLog = await serviceLogRepo.create({
        userId: otherCandidate.id,
        clientId: testClientId,
        activityId: testActivityId,
        serviceDate: '2023-12-03',
        patientCount: 1,
        isDraft: false,
        submittedAt: new Date().toISOString()
      });

      // Original candidate should not access other's log
      await request(app)
        .get(`/api/service-logs/${otherServiceLog.id}`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(403);
    });

    test('should return 404 for non-existent service log', async () => {
      await request(app)
        .get('/api/service-logs/non-existent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    test('should require authentication', async () => {
      await request(app)
        .get(`/api/service-logs/${testServiceLogId}`)
        .expect(401);
    });
  });

  describe('Access Control and Security', () => {
    test('should enforce admin-only filters for userId parameter', async () => {
      // Candidate trying to use userId filter should be ignored
      const response = await request(app)
        .get(`/api/service-logs?userId=some-other-user`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(200);

      // Should return only candidate's own logs, ignoring userId filter
      expect(response.body.data.serviceLogs).toHaveLength(1);
      expect(response.body.data.serviceLogs[0].userId).toBe(testCandidateId);
    });

    test('should validate pagination parameters', async () => {
      // Test invalid page number
      const response1 = await request(app)
        .get('/api/service-logs?page=-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response1.body.data.pagination.page).toBe(1); // Should default to 1

      // Test invalid limit
      const response2 = await request(app)
        .get('/api/service-logs?limit=999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response2.body.data.pagination.limit).toBeLessThanOrEqual(100); // Should cap at 100
    });

    test('should sanitize date filters', async () => {
      // Test malformed date - should handle gracefully
      const response = await request(app)
        .get('/api/service-logs?dateFrom=invalid-date')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Should return results (ignoring invalid date filter)
      expect(response.body.success).toBe(true);
    });
  });
});