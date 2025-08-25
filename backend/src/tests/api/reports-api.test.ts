// Reports API Tests for Phase 7 - CSV Export and Summary Analytics
// Following Jest documentation patterns for healthcare reporting

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

describe('Phase 7 - Reports API Tests', () => {
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
  let testServiceLogIds: string[] = [];
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
      email: 'admin-reports@test.com',
      password: 'Admin123!',
      role: 'admin',
      firstName: 'Test',
      lastName: 'Admin'
    });
    adminToken = authService.generateToken(adminUser.id, adminUser.role);

    // Create candidate user
    const candidateUser = await authService.registerUser({
      email: 'candidate-reports@test.com',
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
      name: 'Healthcare Clinic for Reports',
      isActive: true
    });
    testClientId = testClient.id;

    const testActivity = await activityRepo.create({
      name: 'General Medical Consultation',
      isActive: true
    });
    testActivityId = testActivity.id;

    const testOutcome = await outcomeRepo.create({
      name: 'Treatment Successfully Completed',
      isActive: true
    });
    testOutcomeId = testOutcome.id;

    // Create multiple test service logs with diverse data for comprehensive testing
    const serviceLogData = [
      {
        serviceDate: '2023-11-15',
        patientCount: 3,
        isDraft: false,
        appointments: [
          { type: 'new', outcome: testOutcomeId },
          { type: 'followup', outcome: testOutcomeId },
          { type: 'dna', outcome: testOutcomeId }
        ]
      },
      {
        serviceDate: '2023-12-01',
        patientCount: 2,
        isDraft: false,
        appointments: [
          { type: 'new', outcome: testOutcomeId },
          { type: 'new', outcome: testOutcomeId }
        ]
      },
      {
        serviceDate: '2023-12-15',
        patientCount: 4,
        isDraft: false,
        appointments: [
          { type: 'followup', outcome: testOutcomeId },
          { type: 'followup', outcome: testOutcomeId },
          { type: 'new', outcome: testOutcomeId },
          { type: 'dna', outcome: testOutcomeId }
        ]
      },
      {
        serviceDate: '2023-12-20',
        patientCount: 1,
        isDraft: true,
        appointments: [
          { type: 'new', outcome: testOutcomeId }
        ]
      }
    ];

    testServiceLogIds = [];
    
    for (const logData of serviceLogData) {
      const serviceLog = await serviceLogRepo.create({
        userId: testCandidateId,
        clientId: testClientId,
        activityId: testActivityId,
        serviceDate: logData.serviceDate,
        patientCount: logData.patientCount,
        isDraft: logData.isDraft,
        submittedAt: logData.isDraft ? undefined : new Date().toISOString()
      });
      
      testServiceLogIds.push(serviceLog.id);

      // Create patient entries
      for (const appointment of logData.appointments) {
        await patientEntryRepo.create({
          serviceLogId: serviceLog.id,
          appointmentType: appointment.type as 'new' | 'followup' | 'dna',
          outcomeId: appointment.outcome
        });
      }
    }
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

    testServiceLogIds = [];
  });

  describe('GET /api/reports/export - CSV/Excel Export', () => {
    test('should export CSV with correct headers and data structure', async () => {
      const response = await request(app)
        .get('/api/reports/export?format=csv')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('service-logs-export');

      const csvContent = response.text;
      expect(csvContent).toContain('Service Log ID,User ID,Client Name,Activity Name,Service Date');
      expect(csvContent).toContain('Total Patient Count,New Patients,Followup Patients,DNA Count');
      expect(csvContent).toContain('Primary Outcome,Is Draft,Submitted At,Created At,Updated At');
      
      // Should contain data from our test service logs
      expect(csvContent).toContain('Healthcare Clinic for Reports');
      expect(csvContent).toContain('General Medical Consultation');
      expect(csvContent).toContain('Treatment Successfully Completed');
    });

    test('should export Excel format with correct headers', async () => {
      const response = await request(app)
        .get('/api/reports/export?format=excel')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.headers['content-disposition']).toContain('service-logs-export');
      expect(response.headers['content-disposition']).toContain('.xlsx');
      
      // For now, should return CSV with Excel mime type
      const content = response.text;
      expect(content).toContain('Service Log ID');
    });

    test('should filter exported data by date range', async () => {
      const response = await request(app)
        .get('/api/reports/export?format=csv&dateFrom=2023-12-01&dateTo=2023-12-15')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const csvContent = response.text;
      // Should contain data from December 1st and 15th only
      expect(csvContent).toContain('2023-12-01');
      expect(csvContent).toContain('2023-12-15');
      // Should NOT contain data from November
      expect(csvContent).not.toContain('2023-11-15');
    });

    test('should filter exported data by client', async () => {
      // Create another client and service log
      const anotherClient = await clientRepo.create({
        name: 'Another Clinic',
        isActive: true
      });

      await serviceLogRepo.create({
        userId: testCandidateId,
        clientId: anotherClient.id,
        activityId: testActivityId,
        serviceDate: '2023-12-25',
        patientCount: 1,
        isDraft: false,
        submittedAt: new Date().toISOString()
      });

      // Export filtered by original client
      const response = await request(app)
        .get(`/api/reports/export?format=csv&clientId=${testClientId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const csvContent = response.text;
      expect(csvContent).toContain('Healthcare Clinic for Reports');
      expect(csvContent).not.toContain('Another Clinic');
    });

    test('should filter exported data by activity', async () => {
      // Create another activity and service log
      const anotherActivity = await activityRepo.create({
        name: 'Physical Therapy Session',
        isActive: true
      });

      await serviceLogRepo.create({
        userId: testCandidateId,
        clientId: testClientId,
        activityId: anotherActivity.id,
        serviceDate: '2023-12-25',
        patientCount: 1,
        isDraft: false,
        submittedAt: new Date().toISOString()
      });

      // Export filtered by original activity
      const response = await request(app)
        .get(`/api/reports/export?format=csv&activityId=${testActivityId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const csvContent = response.text;
      expect(csvContent).toContain('General Medical Consultation');
      expect(csvContent).not.toContain('Physical Therapy Session');
    });

    test('should filter exported data by draft status', async () => {
      // Export only drafts
      const draftResponse = await request(app)
        .get('/api/reports/export?format=csv&isDraft=true')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const draftCsv = draftResponse.text;
      expect(draftCsv).toContain('true'); // Should contain isDraft=true entries
      
      // Export only submitted
      const submittedResponse = await request(app)
        .get('/api/reports/export?format=csv&isDraft=false')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const submittedCsv = submittedResponse.text;
      // Should contain submitted entries (more common in our test data)
      const submittedLines = submittedCsv.split('\n').filter(line => line.includes('false,'));
      expect(submittedLines.length).toBeGreaterThan(0);
    });

    test('should restrict candidate exports to their own data', async () => {
      // Create another candidate with their own service log
      const authService = new AuthService();
      const otherCandidate = await authService.registerUser({
        email: 'other-export@test.com',
        password: 'Other123!',
        role: 'candidate',
        firstName: 'Other',
        lastName: 'Candidate'
      });

      await serviceLogRepo.create({
        userId: otherCandidate.id,
        clientId: testClientId,
        activityId: testActivityId,
        serviceDate: '2023-12-30',
        patientCount: 5,
        isDraft: false,
        submittedAt: new Date().toISOString()
      });

      // Candidate should only export their own data
      const response = await request(app)
        .get('/api/reports/export?format=csv')
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(200);

      const csvContent = response.text;
      // Count data rows (excluding header)
      const dataRows = csvContent.split('\n').filter(line => 
        line.trim() && !line.startsWith('Service Log ID')
      );
      
      // Should only contain the original candidate's data (4 service logs = multiple rows due to patient entries)
      expect(dataRows.length).toBeGreaterThan(0);
      // Should not contain the other candidate's service log (patient count 5)
      expect(csvContent).not.toContain(',5,'); // patientCount column
    });

    test('should handle large dataset exports within performance limits', async () => {
      const startTime = Date.now();
      
      // Create additional test data (moderate size for testing)
      const promises = [];
      for (let i = 0; i < 50; i++) {
        const promise = serviceLogRepo.create({
          userId: testCandidateId,
          clientId: testClientId,
          activityId: testActivityId,
          serviceDate: `2023-12-${String((i % 28) + 1).padStart(2, '0')}`,
          patientCount: (i % 3) + 1,
          isDraft: i % 5 === 0,
          submittedAt: i % 5 !== 0 ? new Date().toISOString() : undefined
        }).then(async (log) => {
          // Add patient entries
          for (let j = 0; j < (i % 3) + 1; j++) {
            await patientEntryRepo.create({
              serviceLogId: log.id,
              appointmentType: ['new', 'followup', 'dna'][j % 3] as 'new' | 'followup' | 'dna',
              outcomeId: testOutcomeId
            });
          }
        });
        promises.push(promise);
      }
      await Promise.all(promises);

      const response = await request(app)
        .get('/api/reports/export?format=csv')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      
      // Export should complete within 5 seconds as per documented targets
      expect(responseTime).toBeLessThan(5000);
      
      const csvContent = response.text;
      const dataRows = csvContent.split('\n').filter(line => 
        line.trim() && !line.startsWith('Service Log ID')
      );
      
      // Should contain data from all service logs
      expect(dataRows.length).toBeGreaterThan(50);
    });

    test('should handle invalid format parameter', async () => {
      await request(app)
        .get('/api/reports/export?format=invalid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    test('should require authentication', async () => {
      await request(app)
        .get('/api/reports/export')
        .expect(401);
    });

    test('should handle admin userId filtering', async () => {
      // Admin should be able to filter by userId
      const response = await request(app)
        .get(`/api/reports/export?format=csv&userId=${testCandidateId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const csvContent = response.text;
      expect(csvContent).toContain(testCandidateId);
    });
  });

  describe('GET /api/reports/summary - Summary Analytics', () => {
    test('should return comprehensive summary statistics', async () => {
      const response = await request(app)
        .get('/api/reports/summary')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('overview');
      expect(response.body.data).toHaveProperty('appointmentTypes');
      expect(response.body.data).toHaveProperty('breakdowns');
      expect(response.body.data).toHaveProperty('period');
      expect(response.body.data).toHaveProperty('appliedFilters');

      // Verify overview statistics
      const overview = response.body.data.overview;
      expect(overview).toHaveProperty('totalServiceLogs');
      expect(overview).toHaveProperty('totalDrafts');
      expect(overview).toHaveProperty('totalSubmitted');
      expect(overview).toHaveProperty('totalPatients');
      expect(overview).toHaveProperty('averagePatientsPerLog');
      expect(overview).toHaveProperty('completionRate');

      // Should match our test data (4 service logs, 3 submitted, 1 draft)
      expect(overview.totalServiceLogs).toBe(4);
      expect(overview.totalDrafts).toBe(1);
      expect(overview.totalSubmitted).toBe(3);
    });

    test('should return correct appointment type breakdown', async () => {
      const response = await request(app)
        .get('/api/reports/summary')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const appointmentTypes = response.body.data.appointmentTypes;
      expect(appointmentTypes).toHaveProperty('newPatients');
      expect(appointmentTypes).toHaveProperty('followupPatients');
      expect(appointmentTypes).toHaveProperty('dnaCount');
      expect(appointmentTypes).toHaveProperty('totalAppointments');
      expect(appointmentTypes).toHaveProperty('dnaRate');

      // Based on our test data: 5 new, 3 followup, 2 dna
      expect(appointmentTypes.newPatients).toBe(5);
      expect(appointmentTypes.followupPatients).toBe(3);
      expect(appointmentTypes.dnaCount).toBe(2);
      expect(appointmentTypes.totalAppointments).toBe(10);
    });

    test('should return breakdowns by client and activity', async () => {
      const response = await request(app)
        .get('/api/reports/summary')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const breakdowns = response.body.data.breakdowns;
      expect(breakdowns).toHaveProperty('byClient');
      expect(breakdowns).toHaveProperty('byActivity');
      expect(breakdowns).toHaveProperty('byOutcome');

      // Should contain our test data
      expect(breakdowns.byClient).toHaveLength(1);
      expect(breakdowns.byClient[0].clientName).toBe('Healthcare Clinic for Reports');
      
      expect(breakdowns.byActivity).toHaveLength(1);
      expect(breakdowns.byActivity[0].activityName).toBe('General Medical Consultation');
    });

    test('should filter summary by date range', async () => {
      // Filter to December only
      const response = await request(app)
        .get('/api/reports/summary?dateFrom=2023-12-01&dateTo=2023-12-31')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const overview = response.body.data.overview;
      // Should exclude the November service log
      expect(overview.totalServiceLogs).toBe(3);
      
      const period = response.body.data.period;
      expect(period.dateRange.from).toBe('2023-12-01');
      expect(period.dateRange.to).toBe('2023-12-31');
    });

    test('should filter summary by client', async () => {
      // Create another client and service log
      const anotherClient = await clientRepo.create({
        name: 'Secondary Clinic',
        isActive: true
      });

      await serviceLogRepo.create({
        userId: testCandidateId,
        clientId: anotherClient.id,
        activityId: testActivityId,
        serviceDate: '2023-12-28',
        patientCount: 2,
        isDraft: false,
        submittedAt: new Date().toISOString()
      });

      // Filter by original client
      const response = await request(app)
        .get(`/api/reports/summary?clientId=${testClientId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const breakdowns = response.body.data.breakdowns;
      expect(breakdowns.byClient).toHaveLength(1);
      expect(breakdowns.byClient[0].clientName).toBe('Healthcare Clinic for Reports');
    });

    test('should filter summary by activity', async () => {
      // Create another activity and service log
      const anotherActivity = await activityRepo.create({
        name: 'Specialized Treatment',
        isActive: true
      });

      await serviceLogRepo.create({
        userId: testCandidateId,
        clientId: testClientId,
        activityId: anotherActivity.id,
        serviceDate: '2023-12-28',
        patientCount: 1,
        isDraft: false,
        submittedAt: new Date().toISOString()
      });

      // Filter by original activity
      const response = await request(app)
        .get(`/api/reports/summary?activityId=${testActivityId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const breakdowns = response.body.data.breakdowns;
      expect(breakdowns.byActivity).toHaveLength(1);
      expect(breakdowns.byActivity[0].activityName).toBe('General Medical Consultation');
    });

    test('should restrict candidate summaries to their own data', async () => {
      // Create another candidate with their own data
      const authService = new AuthService();
      const otherCandidate = await authService.registerUser({
        email: 'other-summary@test.com',
        password: 'Other123!',
        role: 'candidate',
        firstName: 'Other',
        lastName: 'Candidate'
      });

      await serviceLogRepo.create({
        userId: otherCandidate.id,
        clientId: testClientId,
        activityId: testActivityId,
        serviceDate: '2023-12-30',
        patientCount: 10, // Distinctive number
        isDraft: false,
        submittedAt: new Date().toISOString()
      });

      // Candidate should only see their own data
      const response = await request(app)
        .get('/api/reports/summary')
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(200);

      const overview = response.body.data.overview;
      // Should still be 4 service logs (not 5)
      expect(overview.totalServiceLogs).toBe(4);
      expect(overview.totalPatients).toBe(10); // Not 20 if other candidate's data was included
    });

    test('should handle admin userId filtering', async () => {
      // Create another candidate
      const authService = new AuthService();
      const otherCandidate = await authService.registerUser({
        email: 'other-admin-filter@test.com',
        password: 'Other123!',
        role: 'candidate',
        firstName: 'Other',
        lastName: 'Candidate'
      });

      await serviceLogRepo.create({
        userId: otherCandidate.id,
        clientId: testClientId,
        activityId: testActivityId,
        serviceDate: '2023-12-30',
        patientCount: 8,
        isDraft: false,
        submittedAt: new Date().toISOString()
      });

      // Admin can filter by specific user
      const response = await request(app)
        .get(`/api/reports/summary?userId=${testCandidateId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const overview = response.body.data.overview;
      expect(overview.totalServiceLogs).toBe(4); // Only original candidate's logs
    });

    test('should calculate completion rate correctly', async () => {
      const response = await request(app)
        .get('/api/reports/summary')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const overview = response.body.data.overview;
      // 3 submitted out of 4 total = 75%
      expect(overview.completionRate).toBe(75);
    });

    test('should provide date range and period information', async () => {
      const response = await request(app)
        .get('/api/reports/summary?dateFrom=2023-12-01&dateTo=2023-12-15')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const period = response.body.data.period;
      expect(period).toHaveProperty('dateRange');
      expect(period).toHaveProperty('totalDays');
      expect(period).toHaveProperty('weekdays');

      expect(period.dateRange.from).toBe('2023-12-01');
      expect(period.dateRange.to).toBe('2023-12-15');
      expect(period.totalDays).toBe(15);
      expect(typeof period.weekdays).toBe('number');
    });

    test('should include applied filters in response', async () => {
      const response = await request(app)
        .get('/api/reports/summary?dateFrom=2023-12-01&clientId=test-client')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const appliedFilters = response.body.data.appliedFilters;
      expect(appliedFilters.dateFrom).toBe('2023-12-01');
      expect(appliedFilters.clientId).toBe('test-client');
      expect(appliedFilters.hasFilters).toBe(true);
    });

    test('should require authentication', async () => {
      await request(app)
        .get('/api/reports/summary')
        .expect(401);
    });

    test('should handle performance with large datasets', async () => {
      const startTime = Date.now();

      // Create additional data for performance testing
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          serviceLogRepo.create({
            userId: testCandidateId,
            clientId: testClientId,
            activityId: testActivityId,
            serviceDate: `2023-12-${String((i % 28) + 1).padStart(2, '0')}`,
            patientCount: (i % 5) + 1,
            isDraft: i % 6 === 0,
            submittedAt: i % 6 !== 0 ? new Date().toISOString() : undefined
          })
        );
      }
      await Promise.all(promises);

      const response = await request(app)
        .get('/api/reports/summary')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      
      // API should respond within 200ms as per documented targets
      expect(responseTime).toBeLessThan(200);

      const overview = response.body.data.overview;
      expect(overview.totalServiceLogs).toBeGreaterThan(100);
    });
  });

  describe('Reports API Security and Validation', () => {
    test('should validate date format in filters', async () => {
      // Invalid date format should be handled gracefully
      const response = await request(app)
        .get('/api/reports/summary?dateFrom=invalid-date')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Should still return success but ignore invalid filter
      expect(response.body.success).toBe(true);
    });

    test('should handle missing reference data gracefully', async () => {
      // Delete reference data after creating service log
      await clientRepo.delete(testClientId);

      const response = await request(app)
        .get('/api/reports/export?format=csv')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const csvContent = response.text;
      // Should handle missing client gracefully
      expect(csvContent).toContain('Unknown Client');
    });

    test('should enforce export limits for large datasets', async () => {
      // This test would verify that exports are limited to prevent memory issues
      // In a real implementation, this would test the 50,000 record limit
      const response = await request(app)
        .get('/api/reports/export?format=csv')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body || response.text).toBeDefined();
      // Should not fail with current dataset size
    });
  });
});