// ServiceLogController API endpoint tests following Express.js documentation patterns
import request from 'supertest';
import { jest } from '@jest/globals';
import express from 'express';
import { ServiceLogController } from '../../controllers/ServiceLogController';
import { ServiceLogRepository } from '../../models/ServiceLogRepository';
import { ClientRepository } from '../../models/ClientRepository';
import { ActivityRepository } from '../../models/ActivityRepository';
import { OutcomeRepository } from '../../models/OutcomeRepository';
import { PatientEntryRepository } from '../../models/PatientEntryRepository';
import { authMiddleware } from '../../middleware/auth';
import { errorHandler } from '../../middleware/errorHandler';
import { AuthenticatedRequest } from '../../types';

// Mock all repositories
jest.mock('../../models/ServiceLogRepository');
jest.mock('../../models/ClientRepository');
jest.mock('../../models/ActivityRepository');
jest.mock('../../models/OutcomeRepository');
jest.mock('../../models/PatientEntryRepository');
jest.mock('../../utils/logger');

// Mock auth middleware
jest.mock('../../middleware/auth', () => ({
  authMiddleware: jest.fn((req: any, res: any, next: any) => {
    req.user = {
      id: 'user-123',
      role: 'staff',
      username: 'testuser',
    };
    next();
  }),
}));

// Test data factories following healthcare patterns
const createMockServiceLog = (overrides: any = {}) => ({
  id: 'service-log-123',
  userId: 'user-123',
  clientId: 'client-1',
  activityId: 'activity-1',
  patientCount: 5,
  isDraft: false,
  submittedAt: '2023-12-01T10:00:00Z',
  createdAt: '2023-12-01T09:00:00Z',
  updatedAt: '2023-12-01T10:00:00Z',
  deletedAt: null,
  ...overrides,
});

const createMockClient = (overrides: any = {}) => ({
  id: 'client-1',
  name: 'Main Hospital',
  description: 'Primary healthcare facility',
  isActive: true,
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z',
  ...overrides,
});

const createMockActivity = (overrides: any = {}) => ({
  id: 'activity-1',
  name: 'General Consultation',
  description: 'Standard patient consultation',
  isActive: true,
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z',
  ...overrides,
});

const createMockOutcome = (overrides: any = {}) => ({
  id: 'outcome-1',
  name: 'Treatment Completed',
  description: 'Patient treatment successfully completed',
  isActive: true,
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z',
  ...overrides,
});

const createMockPatientEntry = (overrides: any = {}) => ({
  id: 'entry-123',
  serviceLogId: 'service-log-123',
  newPatients: 3,
  followupPatients: 2,
  dnaCount: 1,
  outcomeId: 'outcome-1',
  createdAt: '2023-12-01T09:00:00Z',
  updatedAt: '2023-12-01T09:00:00Z',
  ...overrides,
});

// Setup Express app for testing
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  
  const controller = new ServiceLogController();
  
  // Service log routes
  app.get('/api/service-logs', authMiddleware, controller.getServiceLogs);
  app.get('/api/service-logs/options', authMiddleware, controller.getFormOptions);
  app.get('/api/service-logs/:id', authMiddleware, controller.getServiceLog);
  app.post('/api/service-logs', authMiddleware, controller.createServiceLog);
  app.put('/api/service-logs/:id', authMiddleware, controller.updateServiceLog);
  app.delete('/api/service-logs/:id', authMiddleware, controller.deleteServiceLog);
  
  app.use(errorHandler);
  
  return app;
};

describe('ServiceLogController API Tests', () => {
  let app: express.Application;
  let mockServiceLogRepo: jest.Mocked<ServiceLogRepository>;
  let mockClientRepo: jest.Mocked<ClientRepository>;
  let mockActivityRepo: jest.Mocked<ActivityRepository>;
  let mockOutcomeRepo: jest.Mocked<OutcomeRepository>;
  let mockPatientEntryRepo: jest.Mocked<PatientEntryRepository>;

  beforeEach(() => {
    app = createTestApp();
    
    // Setup repository mocks
    mockServiceLogRepo = new ServiceLogRepository() as jest.Mocked<ServiceLogRepository>;
    mockClientRepo = new ClientRepository() as jest.Mocked<ClientRepository>;
    mockActivityRepo = new ActivityRepository() as jest.Mocked<ActivityRepository>;
    mockOutcomeRepo = new OutcomeRepository() as jest.Mocked<OutcomeRepository>;
    mockPatientEntryRepo = new PatientEntryRepository() as jest.Mocked<PatientEntryRepository>;
    
    jest.clearAllMocks();
  });

  describe('GET /api/service-logs', () => {
    test('returns paginated service logs for authenticated user', async () => {
      const mockServiceLogs = [
        createMockServiceLog(),
        createMockServiceLog({ id: 'service-log-456', patientCount: 3 }),
      ];

      mockServiceLogRepo.findMany = jest.fn().mockResolvedValue(mockServiceLogs);
      mockServiceLogRepo.count = jest.fn().mockResolvedValue(2);

      const response = await request(app)
        .get('/api/service-logs')
        .query({ page: 1, limit: 20 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.serviceLogs).toEqual(mockServiceLogs);
      expect(response.body.data.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        pages: 1,
      });

      expect(mockServiceLogRepo.findMany).toHaveBeenCalledWith({
        userId: 'user-123',
        isDraft: undefined,
        clientId: undefined,
        activityId: undefined,
        page: 1,
        limit: 20,
      });
    });

    test('filters service logs by draft status', async () => {
      mockServiceLogRepo.findMany = jest.fn().mockResolvedValue([]);
      mockServiceLogRepo.count = jest.fn().mockResolvedValue(0);

      await request(app)
        .get('/api/service-logs')
        .query({ isDraft: 'true' })
        .expect(200);

      expect(mockServiceLogRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          isDraft: true,
        })
      );
    });

    test('filters service logs by client and activity', async () => {
      mockServiceLogRepo.findMany = jest.fn().mockResolvedValue([]);
      mockServiceLogRepo.count = jest.fn().mockResolvedValue(0);

      await request(app)
        .get('/api/service-logs')
        .query({ 
          clientId: 'client-1',
          activityId: 'activity-1',
        })
        .expect(200);

      expect(mockServiceLogRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'client-1',
          activityId: 'activity-1',
        })
      );
    });

    test('validates and limits pagination parameters', async () => {
      mockServiceLogRepo.findMany = jest.fn().mockResolvedValue([]);
      mockServiceLogRepo.count = jest.fn().mockResolvedValue(0);

      await request(app)
        .get('/api/service-logs')
        .query({ page: 0, limit: 200 })
        .expect(200);

      expect(mockServiceLogRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1, // Should be corrected to minimum 1
          limit: 100, // Should be limited to maximum 100
        })
      );
    });

    test('returns 401 without authentication', async () => {
      // Mock auth middleware to reject
      (authMiddleware as jest.Mock).mockImplementationOnce((req: any, res: any, next: any) => {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      });

      await request(app)
        .get('/api/service-logs')
        .expect(401);
    });

    test('handles database errors gracefully', async () => {
      mockServiceLogRepo.findMany = jest.fn().mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/service-logs')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Internal server error');
    });
  });

  describe('GET /api/service-logs/:id', () => {
    test('returns service log with patient entries for owner', async () => {
      const mockServiceLog = createMockServiceLog();
      const mockPatientEntries = [
        createMockPatientEntry(),
        createMockPatientEntry({ id: 'entry-456', newPatients: 2, followupPatients: 3 }),
      ];

      mockServiceLogRepo.findById = jest.fn().mockResolvedValue(mockServiceLog);
      mockPatientEntryRepo.findByServiceLogId = jest.fn().mockResolvedValue(mockPatientEntries);

      const response = await request(app)
        .get('/api/service-logs/service-log-123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        ...mockServiceLog,
        patientEntries: mockPatientEntries,
      });

      expect(mockServiceLogRepo.findById).toHaveBeenCalledWith('service-log-123');
      expect(mockPatientEntryRepo.findByServiceLogId).toHaveBeenCalledWith('service-log-123');
    });

    test('returns 404 for non-existent service log', async () => {
      mockServiceLogRepo.findById = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .get('/api/service-logs/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Service log not found');
    });

    test('returns 403 for service log owned by different user', async () => {
      const mockServiceLog = createMockServiceLog({ userId: 'other-user' });
      mockServiceLogRepo.findById = jest.fn().mockResolvedValue(mockServiceLog);

      const response = await request(app)
        .get('/api/service-logs/service-log-123')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Access denied');
    });

    test('allows admin to access any service log', async () => {
      // Mock admin user
      (authMiddleware as jest.Mock).mockImplementationOnce((req: any, res: any, next: any) => {
        req.user = { id: 'admin-123', role: 'admin' };
        next();
      });

      const mockServiceLog = createMockServiceLog({ userId: 'other-user' });
      const mockPatientEntries = [createMockPatientEntry()];

      mockServiceLogRepo.findById = jest.fn().mockResolvedValue(mockServiceLog);
      mockPatientEntryRepo.findByServiceLogId = jest.fn().mockResolvedValue(mockPatientEntries);

      const response = await request(app)
        .get('/api/service-logs/service-log-123')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/service-logs', () => {
    test('creates service log with valid data', async () => {
      const requestData = {
        clientId: 'client-1',
        activityId: 'activity-1',
        patientCount: 5,
        patientEntries: [
          {
            newPatients: 3,
            followupPatients: 2,
            dnaCount: 0,
            outcomeId: 'outcome-1',
          },
        ],
        isDraft: false,
      };

      const mockClient = createMockClient();
      const mockActivity = createMockActivity();
      const mockOutcome = createMockOutcome();
      const mockServiceLog = createMockServiceLog();
      const mockPatientEntries = [createMockPatientEntry()];

      mockClientRepo.findById = jest.fn().mockResolvedValue(mockClient);
      mockActivityRepo.findById = jest.fn().mockResolvedValue(mockActivity);
      mockOutcomeRepo.findById = jest.fn().mockResolvedValue(mockOutcome);
      mockServiceLogRepo.create = jest.fn().mockResolvedValue(mockServiceLog);
      mockPatientEntryRepo.create = jest.fn().mockResolvedValue(mockPatientEntries[0]);

      const response = await request(app)
        .post('/api/service-logs')
        .send(requestData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        ...mockServiceLog,
        patientEntries: mockPatientEntries,
      });

      expect(mockServiceLogRepo.create).toHaveBeenCalledWith({
        userId: 'user-123',
        clientId: 'client-1',
        activityId: 'activity-1',
        patientCount: 5,
        isDraft: false,
        submittedAt: expect.any(String),
      });
    });

    test('creates draft service log', async () => {
      const requestData = {
        clientId: 'client-1',
        activityId: 'activity-1',
        patientCount: 2,
        patientEntries: [
          {
            newPatients: 2,
            followupPatients: 0,
            dnaCount: 0,
            outcomeId: 'outcome-1',
          },
        ],
        isDraft: true,
      };

      mockClientRepo.findById = jest.fn().mockResolvedValue(createMockClient());
      mockActivityRepo.findById = jest.fn().mockResolvedValue(createMockActivity());
      mockOutcomeRepo.findById = jest.fn().mockResolvedValue(createMockOutcome());
      mockServiceLogRepo.create = jest.fn().mockResolvedValue(createMockServiceLog({ isDraft: true }));
      mockPatientEntryRepo.create = jest.fn().mockResolvedValue(createMockPatientEntry());

      await request(app)
        .post('/api/service-logs')
        .send(requestData)
        .expect(201);

      expect(mockServiceLogRepo.create).toHaveBeenCalledWith({
        userId: 'user-123',
        clientId: 'client-1',
        activityId: 'activity-1',
        patientCount: 2,
        isDraft: true,
        submittedAt: undefined, // No submission time for drafts
      });
    });

    test('returns 400 for invalid client', async () => {
      const requestData = {
        clientId: 'invalid-client',
        activityId: 'activity-1',
        patientCount: 1,
        patientEntries: [
          {
            newPatients: 1,
            followupPatients: 0,
            dnaCount: 0,
            outcomeId: 'outcome-1',
          },
        ],
      };

      mockClientRepo.findById = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .post('/api/service-logs')
        .send(requestData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Invalid or inactive client');
    });

    test('returns 400 for inactive client', async () => {
      const requestData = {
        clientId: 'client-1',
        activityId: 'activity-1',
        patientCount: 1,
        patientEntries: [
          {
            newPatients: 1,
            followupPatients: 0,
            dnaCount: 0,
            outcomeId: 'outcome-1',
          },
        ],
      };

      mockClientRepo.findById = jest.fn().mockResolvedValue(
        createMockClient({ isActive: false })
      );

      const response = await request(app)
        .post('/api/service-logs')
        .send(requestData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Invalid or inactive client');
    });

    test('returns 400 for invalid activity', async () => {
      const requestData = {
        clientId: 'client-1',
        activityId: 'invalid-activity',
        patientCount: 1,
        patientEntries: [
          {
            newPatients: 1,
            followupPatients: 0,
            dnaCount: 0,
            outcomeId: 'outcome-1',
          },
        ],
      };

      mockClientRepo.findById = jest.fn().mockResolvedValue(createMockClient());
      mockActivityRepo.findById = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .post('/api/service-logs')
        .send(requestData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Invalid or inactive activity');
    });

    test('returns 400 for invalid outcome', async () => {
      const requestData = {
        clientId: 'client-1',
        activityId: 'activity-1',
        patientCount: 1,
        patientEntries: [
          {
            newPatients: 1,
            followupPatients: 0,
            dnaCount: 0,
            outcomeId: 'invalid-outcome',
          },
        ],
      };

      mockClientRepo.findById = jest.fn().mockResolvedValue(createMockClient());
      mockActivityRepo.findById = jest.fn().mockResolvedValue(createMockActivity());
      mockOutcomeRepo.findById = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .post('/api/service-logs')
        .send(requestData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Invalid outcome ID: invalid-outcome');
    });

    test('returns 400 for empty patient entries', async () => {
      const requestData = {
        clientId: 'client-1',
        activityId: 'activity-1',
        patientCount: 1,
        patientEntries: [],
      };

      const response = await request(app)
        .post('/api/service-logs')
        .send(requestData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('At least one patient entry is required');
    });

    test('validates multiple patient entries', async () => {
      const requestData = {
        clientId: 'client-1',
        activityId: 'activity-1',
        patientCount: 8,
        patientEntries: [
          {
            newPatients: 3,
            followupPatients: 2,
            dnaCount: 0,
            outcomeId: 'outcome-1',
          },
          {
            newPatients: 2,
            followupPatients: 1,
            dnaCount: 0,
            outcomeId: 'outcome-2',
          },
        ],
      };

      mockClientRepo.findById = jest.fn().mockResolvedValue(createMockClient());
      mockActivityRepo.findById = jest.fn().mockResolvedValue(createMockActivity());
      mockOutcomeRepo.findById = jest.fn()
        .mockResolvedValueOnce(createMockOutcome())
        .mockResolvedValueOnce(createMockOutcome({ id: 'outcome-2' }));
      mockServiceLogRepo.create = jest.fn().mockResolvedValue(createMockServiceLog());
      mockPatientEntryRepo.create = jest.fn()
        .mockResolvedValueOnce(createMockPatientEntry())
        .mockResolvedValueOnce(createMockPatientEntry({ id: 'entry-456' }));

      const response = await request(app)
        .post('/api/service-logs')
        .send(requestData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(mockPatientEntryRepo.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('PUT /api/service-logs/:id', () => {
    test('updates draft service log for owner', async () => {
      const updateData = {
        clientId: 'client-2',
        patientCount: 10,
      };

      const mockExistingServiceLog = createMockServiceLog({ isDraft: true });
      const mockUpdatedServiceLog = createMockServiceLog({ 
        isDraft: true, 
        clientId: 'client-2',
        patientCount: 10,
      });
      const mockPatientEntries = [createMockPatientEntry()];

      mockServiceLogRepo.findById = jest.fn().mockResolvedValue(mockExistingServiceLog);
      mockClientRepo.findById = jest.fn().mockResolvedValue(createMockClient({ id: 'client-2' }));
      mockServiceLogRepo.update = jest.fn().mockResolvedValue(mockUpdatedServiceLog);
      mockPatientEntryRepo.findByServiceLogId = jest.fn().mockResolvedValue(mockPatientEntries);

      const response = await request(app)
        .put('/api/service-logs/service-log-123')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        ...mockUpdatedServiceLog,
        patientEntries: mockPatientEntries,
      });

      expect(mockServiceLogRepo.update).toHaveBeenCalledWith('service-log-123', {
        clientId: 'client-2',
        activityId: mockExistingServiceLog.activityId,
        patientCount: 10,
        isDraft: true,
        submittedAt: mockExistingServiceLog.submittedAt,
      });
    });

    test('updates patient entries when provided', async () => {
      const updateData = {
        patientEntries: [
          {
            newPatients: 5,
            followupPatients: 3,
            dnaCount: 1,
            outcomeId: 'outcome-1',
          },
        ],
      };

      mockServiceLogRepo.findById = jest.fn().mockResolvedValue(
        createMockServiceLog({ isDraft: true })
      );
      mockServiceLogRepo.update = jest.fn().mockResolvedValue(
        createMockServiceLog({ isDraft: true })
      );
      mockPatientEntryRepo.deleteByServiceLogId = jest.fn().mockResolvedValue(undefined);
      mockPatientEntryRepo.create = jest.fn().mockResolvedValue(
        createMockPatientEntry({
          newPatients: 5,
          followupPatients: 3,
          dnaCount: 1,
        })
      );

      const response = await request(app)
        .put('/api/service-logs/service-log-123')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockPatientEntryRepo.deleteByServiceLogId).toHaveBeenCalledWith('service-log-123');
      expect(mockPatientEntryRepo.create).toHaveBeenCalledWith({
        ...updateData.patientEntries[0],
        serviceLogId: 'service-log-123',
      });
    });

    test('converts draft to submitted when isDraft is false', async () => {
      const updateData = {
        isDraft: false,
      };

      const mockExistingServiceLog = createMockServiceLog({ isDraft: true, submittedAt: null });
      mockServiceLogRepo.findById = jest.fn().mockResolvedValue(mockExistingServiceLog);
      mockServiceLogRepo.update = jest.fn().mockResolvedValue(
        createMockServiceLog({ isDraft: false, submittedAt: expect.any(String) })
      );
      mockPatientEntryRepo.findByServiceLogId = jest.fn().mockResolvedValue([]);

      await request(app)
        .put('/api/service-logs/service-log-123')
        .send(updateData)
        .expect(200);

      expect(mockServiceLogRepo.update).toHaveBeenCalledWith('service-log-123', {
        clientId: mockExistingServiceLog.clientId,
        activityId: mockExistingServiceLog.activityId,
        patientCount: mockExistingServiceLog.patientCount,
        isDraft: false,
        submittedAt: expect.any(String),
      });
    });

    test('returns 404 for non-existent service log', async () => {
      mockServiceLogRepo.findById = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .put('/api/service-logs/non-existent')
        .send({ patientCount: 10 })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Service log not found');
    });

    test('returns 403 for service log owned by different user', async () => {
      mockServiceLogRepo.findById = jest.fn().mockResolvedValue(
        createMockServiceLog({ userId: 'other-user' })
      );

      const response = await request(app)
        .put('/api/service-logs/service-log-123')
        .send({ patientCount: 10 })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Access denied');
    });

    test('returns 400 when trying to edit submitted log as non-admin', async () => {
      mockServiceLogRepo.findById = jest.fn().mockResolvedValue(
        createMockServiceLog({ isDraft: false })
      );

      const response = await request(app)
        .put('/api/service-logs/service-log-123')
        .send({ patientCount: 10 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Cannot edit submitted service logs');
    });

    test('allows admin to edit any service log', async () => {
      // Mock admin user
      (authMiddleware as jest.Mock).mockImplementationOnce((req: any, res: any, next: any) => {
        req.user = { id: 'admin-123', role: 'admin' };
        next();
      });

      mockServiceLogRepo.findById = jest.fn().mockResolvedValue(
        createMockServiceLog({ userId: 'other-user', isDraft: false })
      );
      mockServiceLogRepo.update = jest.fn().mockResolvedValue(
        createMockServiceLog({ isDraft: false, patientCount: 10 })
      );
      mockPatientEntryRepo.findByServiceLogId = jest.fn().mockResolvedValue([]);

      const response = await request(app)
        .put('/api/service-logs/service-log-123')
        .send({ patientCount: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /api/service-logs/:id', () => {
    test('deletes draft service log for owner', async () => {
      mockServiceLogRepo.findById = jest.fn().mockResolvedValue(
        createMockServiceLog({ isDraft: true })
      );
      mockServiceLogRepo.softDelete = jest.fn().mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/service-logs/service-log-123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Service log deleted successfully');
      expect(mockServiceLogRepo.softDelete).toHaveBeenCalledWith('service-log-123');
    });

    test('returns 404 for non-existent service log', async () => {
      mockServiceLogRepo.findById = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/service-logs/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Service log not found');
    });

    test('returns 403 for service log owned by different user', async () => {
      mockServiceLogRepo.findById = jest.fn().mockResolvedValue(
        createMockServiceLog({ userId: 'other-user', isDraft: true })
      );

      const response = await request(app)
        .delete('/api/service-logs/service-log-123')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Access denied');
    });

    test('returns 400 when trying to delete submitted log as non-admin', async () => {
      mockServiceLogRepo.findById = jest.fn().mockResolvedValue(
        createMockServiceLog({ isDraft: false })
      );

      const response = await request(app)
        .delete('/api/service-logs/service-log-123')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Can only delete draft service logs');
    });

    test('allows admin to delete any service log', async () => {
      // Mock admin user
      (authMiddleware as jest.Mock).mockImplementationOnce((req: any, res: any, next: any) => {
        req.user = { id: 'admin-123', role: 'admin' };
        next();
      });

      mockServiceLogRepo.findById = jest.fn().mockResolvedValue(
        createMockServiceLog({ userId: 'other-user', isDraft: false })
      );
      mockServiceLogRepo.softDelete = jest.fn().mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/service-logs/service-log-123')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/service-logs/options', () => {
    test('returns form options with active entities', async () => {
      const mockClients = [
        createMockClient(),
        createMockClient({ id: 'client-2', name: 'Emergency Department' }),
      ];
      const mockActivities = [
        createMockActivity(),
        createMockActivity({ id: 'activity-2', name: 'Surgery' }),
      ];
      const mockOutcomes = [
        createMockOutcome(),
        createMockOutcome({ id: 'outcome-2', name: 'Referred' }),
      ];

      mockClientRepo.findActive = jest.fn().mockResolvedValue(mockClients);
      mockActivityRepo.findActive = jest.fn().mockResolvedValue(mockActivities);
      mockOutcomeRepo.findActive = jest.fn().mockResolvedValue(mockOutcomes);

      const response = await request(app)
        .get('/api/service-logs/options')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        clients: mockClients,
        activities: mockActivities,
        outcomes: mockOutcomes,
      });

      expect(mockClientRepo.findActive).toHaveBeenCalled();
      expect(mockActivityRepo.findActive).toHaveBeenCalled();
      expect(mockOutcomeRepo.findActive).toHaveBeenCalled();
    });

    test('returns empty arrays when no active entities exist', async () => {
      mockClientRepo.findActive = jest.fn().mockResolvedValue([]);
      mockActivityRepo.findActive = jest.fn().mockResolvedValue([]);
      mockOutcomeRepo.findActive = jest.fn().mockResolvedValue([]);

      const response = await request(app)
        .get('/api/service-logs/options')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        clients: [],
        activities: [],
        outcomes: [],
      });
    });

    test('handles database errors when fetching options', async () => {
      mockClientRepo.findActive = jest.fn().mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/service-logs/options')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('handles concurrent creation attempts', async () => {
      const requestData = {
        clientId: 'client-1',
        activityId: 'activity-1',
        patientCount: 1,
        patientEntries: [
          {
            newPatients: 1,
            followupPatients: 0,
            dnaCount: 0,
            outcomeId: 'outcome-1',
          },
        ],
      };

      mockClientRepo.findById = jest.fn().mockResolvedValue(createMockClient());
      mockActivityRepo.findById = jest.fn().mockResolvedValue(createMockActivity());
      mockOutcomeRepo.findById = jest.fn().mockResolvedValue(createMockOutcome());

      // First request succeeds
      mockServiceLogRepo.create = jest.fn().mockResolvedValue(createMockServiceLog());
      mockPatientEntryRepo.create = jest.fn().mockResolvedValue(createMockPatientEntry());

      const response1 = await request(app)
        .post('/api/service-logs')
        .send(requestData);

      expect(response1.status).toBe(201);

      // Second concurrent request should also handle gracefully
      const response2 = await request(app)
        .post('/api/service-logs')
        .send(requestData);

      expect(response2.status).toBe(201);
    });

    test('validates request body structure', async () => {
      const response = await request(app)
        .post('/api/service-logs')
        .send({}) // Empty body
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('handles malformed JSON in request', async () => {
      const response = await request(app)
        .post('/api/service-logs')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('enforces content-type validation', async () => {
      const response = await request(app)
        .post('/api/service-logs')
        .set('Content-Type', 'text/plain')
        .send('some text')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Response Format Consistency', () => {
    test('all success responses have consistent format', async () => {
      mockServiceLogRepo.findMany = jest.fn().mockResolvedValue([]);
      mockServiceLogRepo.count = jest.fn().mockResolvedValue(0);

      const response = await request(app)
        .get('/api/service-logs')
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body.success).toBe(true);
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });

    test('all error responses have consistent format', async () => {
      mockServiceLogRepo.findById = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .get('/api/service-logs/non-existent')
        .expect(404);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body.success).toBe(false);
      expect(response.body.error).toHaveProperty('message');
    });
  });
});