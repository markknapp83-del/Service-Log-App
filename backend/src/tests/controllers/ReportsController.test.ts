// Integration Tests for ReportsController - Phase 7
// Following Jest documentation patterns for healthcare controller testing

import { describe, test, expect, beforeEach, afterEach, beforeAll, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { ReportsController } from '../../controllers/ReportsController';
import { Database } from 'better-sqlite3';
import { getDatabase } from '../../database/connection';
import { ServiceLogRepository } from '../../models/ServiceLogRepository';
import { ClientRepository } from '../../models/ClientRepository';
import { ActivityRepository } from '../../models/ActivityRepository';
import { OutcomeRepository } from '../../models/OutcomeRepository';
import { PatientEntryRepository } from '../../models/PatientEntryRepository';
import { AuthenticatedRequest } from '../../types';

describe('ReportsController Integration Tests', () => {
  let reportsController: ReportsController;
  let db: Database;
  let serviceLogRepo: ServiceLogRepository;
  let clientRepo: ClientRepository;
  let activityRepo: ActivityRepository;
  let outcomeRepo: OutcomeRepository;
  let patientEntryRepo: PatientEntryRepository;

  // Test data IDs
  let testClientId: string;
  let testActivityId: string;
  let testOutcomeId: string;
  let testUserId: string;
  let testServiceLogIds: string[] = [];

  // Mock request and response objects
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeAll(async () => {
    // Initialize database and repositories
    db = getDatabase();
    reportsController = new ReportsController();
    serviceLogRepo = new ServiceLogRepository();
    clientRepo = new ClientRepository();
    activityRepo = new ActivityRepository();
    outcomeRepo = new OutcomeRepository();
    patientEntryRepo = new PatientEntryRepository();
    
    testUserId = 'test-user-controller-123';
  });

  beforeEach(async () => {
    // Create test reference data
    const testClient = await clientRepo.create({
      name: 'Controller Test Clinic',
      isActive: true
    });
    testClientId = testClient.id;

    const testActivity = await activityRepo.create({
      name: 'Controller Test Activity',
      isActive: true
    });
    testActivityId = testActivity.id;

    const testOutcome = await outcomeRepo.create({
      name: 'Controller Test Outcome',
      isActive: true
    });
    testOutcomeId = testOutcome.id;

    // Create comprehensive test dataset
    const serviceLogData = [
      {
        serviceDate: '2023-11-01',
        patientCount: 2,
        isDraft: false,
        appointments: [
          { type: 'new', outcome: testOutcomeId },
          { type: 'followup', outcome: testOutcomeId }
        ]
      },
      {
        serviceDate: '2023-11-15',
        patientCount: 3,
        isDraft: false,
        appointments: [
          { type: 'new', outcome: testOutcomeId },
          { type: 'new', outcome: testOutcomeId },
          { type: 'dna', outcome: testOutcomeId }
        ]
      },
      {
        serviceDate: '2023-12-01',
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
        serviceDate: '2023-12-15',
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
        userId: testUserId,
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

    // Setup mock request and response objects
    mockReq = {
      user: { id: testUserId, role: 'admin' },
      query: {},
      params: {}
    };

    mockRes = {
      json: jest.fn(),
      send: jest.fn(),
      status: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      setHeader: jest.fn()
    };

    mockNext = jest.fn() as jest.MockedFunction<NextFunction>;
  });

  afterEach(async () => {
    // Clean up test data
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

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('exportServiceLogs Method', () => {
    test('should export CSV with correct structure and healthcare data', async () => {
      mockReq.query = { format: 'csv' };

      await reportsController.exportServiceLogs(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.send).toHaveBeenCalledTimes(1);
      
      const csvContent = (mockRes.send as jest.Mock).mock.calls[0][0] as string;
      
      // Verify CSV headers
      expect(csvContent).toContain('Service Log ID,User ID,Client Name,Activity Name,Service Date');
      expect(csvContent).toContain('Total Patient Count,New Patients,Followup Patients,DNA Count');
      expect(csvContent).toContain('Primary Outcome,Is Draft,Submitted At,Created At,Updated At');
      
      // Verify healthcare data content
      expect(csvContent).toContain('Controller Test Clinic');
      expect(csvContent).toContain('Controller Test Activity');
      expect(csvContent).toContain('Controller Test Outcome');
      expect(csvContent).toContain(testUserId);
      
      // Verify appointment type data is present
      expect(csvContent).toContain(',1,'); // New patients count
      expect(csvContent).toContain(',0,'); // Followup patients count
      expect(csvContent).toContain(',0,'); // DNA count
    });

    test('should apply date range filters correctly', async () => {
      mockReq.query = {
        format: 'csv',
        dateFrom: '2023-12-01',
        dateTo: '2023-12-31'
      };

      await reportsController.exportServiceLogs(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).not.toHaveBeenCalled();
      const csvContent = (mockRes.send as jest.Mock).mock.calls[0][0] as string;
      
      // Should contain December dates
      expect(csvContent).toContain('2023-12-01');
      expect(csvContent).toContain('2023-12-15');
      
      // Should NOT contain November dates
      expect(csvContent).not.toContain('2023-11-01');
      expect(csvContent).not.toContain('2023-11-15');
    });

    test('should filter by client ID correctly', async () => {
      // Create another client and service log
      const anotherClient = await clientRepo.create({
        name: 'Another Controller Clinic',
        isActive: true
      });

      await serviceLogRepo.create({
        userId: testUserId,
        clientId: anotherClient.id,
        activityId: testActivityId,
        serviceDate: '2023-12-20',
        patientCount: 1,
        isDraft: false,
        submittedAt: new Date().toISOString()
      });

      mockReq.query = {
        format: 'csv',
        clientId: testClientId
      };

      await reportsController.exportServiceLogs(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      const csvContent = (mockRes.send as jest.Mock).mock.calls[0][0] as string;
      
      // Should contain original client
      expect(csvContent).toContain('Controller Test Clinic');
      // Should NOT contain the other client
      expect(csvContent).not.toContain('Another Controller Clinic');
    });

    test('should filter by activity ID correctly', async () => {
      const anotherActivity = await activityRepo.create({
        name: 'Another Controller Activity',
        isActive: true
      });

      await serviceLogRepo.create({
        userId: testUserId,
        clientId: testClientId,
        activityId: anotherActivity.id,
        serviceDate: '2023-12-20',
        patientCount: 1,
        isDraft: false,
        submittedAt: new Date().toISOString()
      });

      mockReq.query = {
        format: 'csv',
        activityId: testActivityId
      };

      await reportsController.exportServiceLogs(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      const csvContent = (mockRes.send as jest.Mock).mock.calls[0][0] as string;
      
      expect(csvContent).toContain('Controller Test Activity');
      expect(csvContent).not.toContain('Another Controller Activity');
    });

    test('should filter by draft status correctly', async () => {
      mockReq.query = {
        format: 'csv',
        isDraft: 'true'
      };

      await reportsController.exportServiceLogs(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      const csvContent = (mockRes.send as jest.Mock).mock.calls[0][0] as string;
      const dataRows = csvContent.split('\n').filter(line => 
        line.trim() && !line.startsWith('Service Log ID')
      );
      
      // Should only contain draft entries (1 in our test data)
      expect(dataRows.length).toBe(1);
      expect(csvContent).toContain('true'); // isDraft column
    });

    test('should handle admin user ID filtering', async () => {
      const anotherUserId = 'another-user-123';
      
      await serviceLogRepo.create({
        userId: anotherUserId,
        clientId: testClientId,
        activityId: testActivityId,
        serviceDate: '2023-12-20',
        patientCount: 1,
        isDraft: false,
        submittedAt: new Date().toISOString()
      });

      mockReq.query = {
        format: 'csv',
        userId: testUserId
      };

      await reportsController.exportServiceLogs(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      const csvContent = (mockRes.send as jest.Mock).mock.calls[0][0] as string;
      
      // Should contain only the filtered user's data
      expect(csvContent).toContain(testUserId);
      expect(csvContent).not.toContain(anotherUserId);
    });

    test('should restrict candidate access to their own data', async () => {
      mockReq.user!.role = 'candidate';
      const anotherUserId = 'another-user-456';

      await serviceLogRepo.create({
        userId: anotherUserId,
        clientId: testClientId,
        activityId: testActivityId,
        serviceDate: '2023-12-20',
        patientCount: 1,
        isDraft: false,
        submittedAt: new Date().toISOString()
      });

      mockReq.query = { format: 'csv' };

      await reportsController.exportServiceLogs(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      const csvContent = (mockRes.send as jest.Mock).mock.calls[0][0] as string;
      
      // Should contain only candidate's own data
      expect(csvContent).toContain(testUserId);
      expect(csvContent).not.toContain(anotherUserId);
    });

    test('should set correct CSV headers', async () => {
      mockReq.query = { format: 'csv' };

      await reportsController.exportServiceLogs(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      // Verify CSV headers were set
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('attachment; filename="service-logs-export')
      );
    });

    test('should handle Excel format request', async () => {
      mockReq.query = { format: 'excel' };

      await reportsController.exportServiceLogs(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      // Verify Excel headers were set
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('.xlsx')
      );
    });

    test('should handle unsupported format', async () => {
      mockReq.query = { format: 'pdf' };

      await reportsController.exportServiceLogs(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'Unsupported export format. Use csv or excel.'
        })
      );
    });

    test('should handle missing authentication', async () => {
      mockReq.user = undefined;

      await reportsController.exportServiceLogs(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'User not authenticated'
        })
      );
    });

    test('should handle batch processing for large datasets', async () => {
      // Create additional test data to test batch processing
      const promises = [];
      for (let i = 0; i < 50; i++) {
        const promise = serviceLogRepo.create({
          userId: testUserId,
          clientId: testClientId,
          activityId: testActivityId,
          serviceDate: `2023-12-${String((i % 28) + 1).padStart(2, '0')}`,
          patientCount: (i % 3) + 1,
          isDraft: false,
          submittedAt: new Date().toISOString()
        }).then(async (log) => {
          // Add patient entries for each
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

      mockReq.query = { format: 'csv' };

      const startTime = Date.now();
      await reportsController.exportServiceLogs(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );
      const processingTime = Date.now() - startTime;

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.send).toHaveBeenCalledTimes(1);
      
      const csvContent = (mockRes.send as jest.Mock).mock.calls[0][0] as string;
      const dataRows = csvContent.split('\n').filter(line => 
        line.trim() && !line.startsWith('Service Log ID')
      );
      
      // Should contain data from all service logs
      expect(dataRows.length).toBeGreaterThan(50);
      
      // Should complete within reasonable time (5 seconds as per documented targets)
      expect(processingTime).toBeLessThan(5000);
    });
  });

  describe('getSummaryReport Method', () => {
    test('should generate comprehensive summary statistics', async () => {
      await reportsController.getSummaryReport(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledTimes(1);

      const response = (mockRes.json as jest.Mock).mock.calls[0][0];
      
      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('overview');
      expect(response.data).toHaveProperty('appointmentTypes');
      expect(response.data).toHaveProperty('breakdowns');
      expect(response.data).toHaveProperty('period');
      expect(response.data).toHaveProperty('appliedFilters');

      // Verify overview statistics match test data
      const overview = response.data.overview;
      expect(overview.totalServiceLogs).toBe(4);
      expect(overview.totalDrafts).toBe(1);
      expect(overview.totalSubmitted).toBe(3);
      expect(overview.completionRate).toBe(75); // 3/4 * 100
    });

    test('should calculate appointment type statistics correctly', async () => {
      await reportsController.getSummaryReport(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      const response = (mockRes.json as jest.Mock).mock.calls[0][0];
      const appointmentTypes = response.data.appointmentTypes;

      // Based on test data: 5 new, 3 followup, 2 dna
      expect(appointmentTypes.newPatients).toBe(5);
      expect(appointmentTypes.followupPatients).toBe(3);
      expect(appointmentTypes.dnaCount).toBe(2);
      expect(appointmentTypes.totalAppointments).toBe(10);
      
      // DNA rate should be 2/10 = 20%
      expect(appointmentTypes.dnaRate).toBe(20);
    });

    test('should provide breakdowns by client, activity, and outcome', async () => {
      await reportsController.getSummaryReport(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      const response = (mockRes.json as jest.Mock).mock.calls[0][0];
      const breakdowns = response.data.breakdowns;

      expect(breakdowns.byClient).toHaveLength(1);
      expect(breakdowns.byClient[0].clientName).toBe('Controller Test Clinic');
      expect(breakdowns.byClient[0].count).toBe(4);

      expect(breakdowns.byActivity).toHaveLength(1);
      expect(breakdowns.byActivity[0].activityName).toBe('Controller Test Activity');
      expect(breakdowns.byActivity[0].count).toBe(4);

      expect(breakdowns.byOutcome).toHaveLength(1);
      expect(breakdowns.byOutcome[0].outcomeName).toBe('Controller Test Outcome');
      expect(breakdowns.byOutcome[0].count).toBe(10); // Total appointments
    });

    test('should apply date range filters to summary', async () => {
      mockReq.query = {
        dateFrom: '2023-12-01',
        dateTo: '2023-12-31'
      };

      await reportsController.getSummaryReport(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      const response = (mockRes.json as jest.Mock).mock.calls[0][0];
      const overview = response.data.overview;

      // Should only include December service logs (2 in test data)
      expect(overview.totalServiceLogs).toBe(2);
      
      const period = response.data.period;
      expect(period.dateRange.from).toBe('2023-12-01');
      expect(period.dateRange.to).toBe('2023-12-31');
    });

    test('should calculate period information correctly', async () => {
      mockReq.query = {
        dateFrom: '2023-12-01',
        dateTo: '2023-12-15'
      };

      await reportsController.getSummaryReport(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      const response = (mockRes.json as jest.Mock).mock.calls[0][0];
      const period = response.data.period;

      expect(period.totalDays).toBe(15); // Dec 1 to Dec 15 = 15 days
      expect(typeof period.weekdays).toBe('number');
      expect(period.weekdays).toBeGreaterThan(0);
      expect(period.weekdays).toBeLessThanOrEqual(15);
    });

    test('should restrict candidate access to their own data in summary', async () => {
      mockReq.user!.role = 'candidate';
      
      // Create data for another user
      const anotherUserId = 'another-summary-user';
      await serviceLogRepo.create({
        userId: anotherUserId,
        clientId: testClientId,
        activityId: testActivityId,
        serviceDate: '2023-12-25',
        patientCount: 10,
        isDraft: false,
        submittedAt: new Date().toISOString()
      });

      await reportsController.getSummaryReport(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      const response = (mockRes.json as jest.Mock).mock.calls[0][0];
      const overview = response.data.overview;

      // Should still be 4 service logs (candidate's own data only)
      expect(overview.totalServiceLogs).toBe(4);
      expect(overview.totalPatients).toBe(10); // Not including other user's 10 patients
    });

    test('should handle admin userId filtering in summary', async () => {
      const anotherUserId = 'another-admin-filter-user';
      
      await serviceLogRepo.create({
        userId: anotherUserId,
        clientId: testClientId,
        activityId: testActivityId,
        serviceDate: '2023-12-25',
        patientCount: 5,
        isDraft: false,
        submittedAt: new Date().toISOString()
      });

      mockReq.query = {
        userId: testUserId
      };

      await reportsController.getSummaryReport(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      const response = (mockRes.json as jest.Mock).mock.calls[0][0];
      const overview = response.data.overview;

      // Should only include original user's data
      expect(overview.totalServiceLogs).toBe(4);
    });

    test('should include applied filters in summary response', async () => {
      mockReq.query = {
        dateFrom: '2023-11-01',
        clientId: testClientId,
        activityId: testActivityId
      };

      await reportsController.getSummaryReport(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      const response = (mockRes.json as jest.Mock).mock.calls[0][0];
      const appliedFilters = response.data.appliedFilters;

      expect(appliedFilters.dateFrom).toBe('2023-11-01');
      expect(appliedFilters.clientId).toBe(testClientId);
      expect(appliedFilters.activityId).toBe(testActivityId);
      expect(appliedFilters.hasFilters).toBe(true);
    });

    test('should handle missing authentication in summary', async () => {
      mockReq.user = undefined;

      await reportsController.getSummaryReport(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'User not authenticated'
        })
      );
    });

    test('should handle performance with large datasets in summary', async () => {
      // Create additional data for performance testing
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          serviceLogRepo.create({
            userId: testUserId,
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

      const startTime = Date.now();
      await reportsController.getSummaryReport(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );
      const processingTime = Date.now() - startTime;

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledTimes(1);

      const response = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(response.data.overview.totalServiceLogs).toBeGreaterThan(100);

      // Should complete within 200ms as per documented targets
      expect(processingTime).toBeLessThan(200);
    });
  });

  describe('Helper Methods', () => {
    test('should calculate weekdays correctly', async () => {
      // Test the private calculateWeekdays method through public interface
      mockReq.query = {
        dateFrom: '2023-12-01', // Friday
        dateTo: '2023-12-10'     // Sunday
      };

      await reportsController.getSummaryReport(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      const response = (mockRes.json as jest.Mock).mock.calls[0][0];
      const weekdays = response.data.period.weekdays;

      // Dec 1-10, 2023: Fri(1), Sat(2), Sun(3), Mon(4), Tue(5), Wed(6), Thu(7), Fri(8), Sat(9), Sun(10)
      // Weekdays: 1, 4, 5, 6, 7, 8 = 6 weekdays
      expect(weekdays).toBe(6);
    });

    test('should handle batch processing correctly', async () => {
      // This tests the processBatchForExport method through the export endpoint
      // Create diverse patient entry data
      const serviceLog1 = await serviceLogRepo.create({
        userId: testUserId,
        clientId: testClientId,
        activityId: testActivityId,
        serviceDate: '2023-12-30',
        patientCount: 0, // Edge case: no patient entries
        isDraft: false,
        submittedAt: new Date().toISOString()
      });

      const serviceLog2 = await serviceLogRepo.create({
        userId: testUserId,
        clientId: testClientId,
        activityId: testActivityId,
        serviceDate: '2023-12-31',
        patientCount: 3,
        isDraft: false,
        submittedAt: new Date().toISOString()
      });

      // Add entries to second log only
      await patientEntryRepo.create({
        serviceLogId: serviceLog2.id,
        appointmentType: 'new',
        outcomeId: testOutcomeId
      });
      await patientEntryRepo.create({
        serviceLogId: serviceLog2.id,
        appointmentType: 'followup',
        outcomeId: testOutcomeId
      });
      await patientEntryRepo.create({
        serviceLogId: serviceLog2.id,
        appointmentType: 'dna',
        outcomeId: testOutcomeId
      });

      mockReq.query = { 
        format: 'csv',
        dateFrom: '2023-12-30',
        dateTo: '2023-12-31'
      };

      await reportsController.exportServiceLogs(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      const csvContent = (mockRes.send as jest.Mock).mock.calls[0][0] as string;
      const dataRows = csvContent.split('\n').filter(line => 
        line.trim() && !line.startsWith('Service Log ID')
      );

      // Should have 4 rows: 1 for empty log + 3 for log with entries
      expect(dataRows.length).toBe(4);

      // First row should show zeros for empty log
      expect(dataRows[0]).toContain(',0,0,0,'); // new, followup, dna counts

      // Other rows should show individual appointment data
      expect(csvContent).toContain(',1,0,0,'); // new appointment
      expect(csvContent).toContain(',0,1,0,'); // followup appointment
      expect(csvContent).toContain(',0,0,1,'); // dna appointment
    });
  });
});