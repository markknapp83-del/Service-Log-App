// Service Log Controller following Express.js documentation patterns
import { Request, Response, NextFunction } from 'express';
import { ServiceLogRepository } from '../models/ServiceLogRepository';
import { ClientRepository } from '../models/ClientRepository';
import { ActivityRepository } from '../models/ActivityRepository';
import { OutcomeRepository } from '../models/OutcomeRepository';
import { PatientEntryRepository } from '../models/PatientEntryRepository';
import { AuthenticatedRequest } from '../types';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export class ServiceLogController {
  private serviceLogRepo: ServiceLogRepository;
  private clientRepo: ClientRepository;
  private activityRepo: ActivityRepository;
  private outcomeRepo: OutcomeRepository;
  private patientEntryRepo: PatientEntryRepository;

  constructor() {
    this.serviceLogRepo = new ServiceLogRepository();
    this.clientRepo = new ClientRepository();
    this.activityRepo = new ActivityRepository();
    this.outcomeRepo = new OutcomeRepository();
    this.patientEntryRepo = new PatientEntryRepository();
  }

  // GET /api/service-logs - List service logs with filtering and pagination
  public getServiceLogs = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return next(new AppError('User not authenticated', 401));
      }

      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
      const isDraft = req.query.isDraft === 'true' ? true : req.query.isDraft === 'false' ? false : undefined;
      const clientId = req.query.clientId as string;
      const activityId = req.query.activityId as string;

      const filters = {
        userId,
        isDraft,
        clientId,
        activityId,
      };

      const serviceLogs = await this.serviceLogRepo.findMany({
        ...filters,
        page,
        limit,
      });

      const total = await this.serviceLogRepo.count(filters);

      logger.info(`Service logs retrieved for user ${userId}`, {
        userId,
        page,
        limit,
        total,
        filters,
      });

      res.json({
        success: true,
        data: {
          serviceLogs,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/service-logs/:id - Get single service log with patient entries
  public getServiceLog = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return next(new AppError('User not authenticated', 401));
      }

      const serviceLogId = req.params.id;
      const serviceLog = await this.serviceLogRepo.findById(serviceLogId);

      if (!serviceLog) {
        return next(new AppError('Service log not found', 404));
      }

      // Check if user owns this service log or is admin
      if (serviceLog.userId !== userId && req.user?.role !== 'admin') {
        return next(new AppError('Access denied', 403));
      }

      // Get patient entries for this service log
      const patientEntries = await this.patientEntryRepo.findByServiceLogId(serviceLogId);

      logger.info(`Service log retrieved`, {
        serviceLogId,
        userId,
        requestedBy: req.user?.role,
      });

      res.json({
        success: true,
        data: {
          ...serviceLog,
          patientEntries,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/service-logs - Create new service log
  public createServiceLog = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return next(new AppError('User not authenticated', 401));
      }

      const { clientId, activityId, patientCount, patientEntries, isDraft = false } = req.body;

      // Validate that client, activity exist and are active
      const [client, activity] = await Promise.all([
        this.clientRepo.findById(clientId),
        this.activityRepo.findById(activityId),
      ]);

      if (!client || !client.isActive) {
        return next(new AppError('Invalid or inactive client', 400));
      }

      if (!activity || !activity.isActive) {
        return next(new AppError('Invalid or inactive activity', 400));
      }

      // Validate patient entries
      if (!patientEntries || !Array.isArray(patientEntries) || patientEntries.length === 0) {
        return next(new AppError('At least one patient entry is required', 400));
      }

      // Validate outcomes exist
      for (const entry of patientEntries) {
        const outcome = await this.outcomeRepo.findById(entry.outcomeId);
        if (!outcome || !outcome.isActive) {
          return next(new AppError(`Invalid outcome ID: ${entry.outcomeId}`, 400));
        }
      }

      // Start transaction
      const serviceLog = await this.serviceLogRepo.create({
        userId,
        clientId,
        activityId,
        patientCount,
        isDraft,
        submittedAt: isDraft ? undefined : new Date().toISOString(),
      });

      // Create patient entries
      const createdEntries = await Promise.all(
        patientEntries.map(entry =>
          this.patientEntryRepo.create({
            ...entry,
            serviceLogId: serviceLog.id,
          })
        )
      );

      logger.info(`Service log created`, {
        serviceLogId: serviceLog.id,
        userId,
        clientId,
        activityId,
        patientCount,
        isDraft,
        entriesCount: createdEntries.length,
      });

      res.status(201).json({
        success: true,
        data: {
          ...serviceLog,
          patientEntries: createdEntries,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  // PUT /api/service-logs/:id - Update service log
  public updateServiceLog = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return next(new AppError('User not authenticated', 401));
      }

      const serviceLogId = req.params.id;
      const existingServiceLog = await this.serviceLogRepo.findById(serviceLogId);

      if (!existingServiceLog) {
        return next(new AppError('Service log not found', 404));
      }

      // Check ownership and edit permissions
      if (existingServiceLog.userId !== userId && req.user?.role !== 'admin') {
        return next(new AppError('Access denied', 403));
      }

      // Cannot edit submitted logs (unless admin)
      if (!existingServiceLog.isDraft && req.user?.role !== 'admin') {
        return next(new AppError('Cannot edit submitted service logs', 400));
      }

      const { clientId, activityId, patientCount, patientEntries, isDraft } = req.body;

      // Validate entities if they're being changed
      if (clientId && clientId !== existingServiceLog.clientId) {
        const client = await this.clientRepo.findById(clientId);
        if (!client || !client.isActive) {
          return next(new AppError('Invalid or inactive client', 400));
        }
      }

      if (activityId && activityId !== existingServiceLog.activityId) {
        const activity = await this.activityRepo.findById(activityId);
        if (!activity || !activity.isActive) {
          return next(new AppError('Invalid or inactive activity', 400));
        }
      }

      // Update service log
      const updatedServiceLog = await this.serviceLogRepo.update(serviceLogId, {
        clientId: clientId || existingServiceLog.clientId,
        activityId: activityId || existingServiceLog.activityId,
        patientCount: patientCount || existingServiceLog.patientCount,
        isDraft: isDraft !== undefined ? isDraft : existingServiceLog.isDraft,
        submittedAt: isDraft === false && existingServiceLog.isDraft 
          ? new Date().toISOString() 
          : existingServiceLog.submittedAt,
      });

      // Update patient entries if provided
      let updatedEntries = [];
      if (patientEntries && Array.isArray(patientEntries)) {
        // Delete existing entries
        await this.patientEntryRepo.deleteByServiceLogId(serviceLogId);
        
        // Create new entries
        updatedEntries = await Promise.all(
          patientEntries.map(entry =>
            this.patientEntryRepo.create({
              ...entry,
              serviceLogId,
            })
          )
        );
      } else {
        // Keep existing entries
        updatedEntries = await this.patientEntryRepo.findByServiceLogId(serviceLogId);
      }

      logger.info(`Service log updated`, {
        serviceLogId,
        userId,
        updatedBy: req.user?.role,
        changes: { clientId, activityId, patientCount, isDraft },
      });

      res.json({
        success: true,
        data: {
          ...updatedServiceLog,
          patientEntries: updatedEntries,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  // DELETE /api/service-logs/:id - Soft delete service log
  public deleteServiceLog = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return next(new AppError('User not authenticated', 401));
      }

      const serviceLogId = req.params.id;
      const serviceLog = await this.serviceLogRepo.findById(serviceLogId);

      if (!serviceLog) {
        return next(new AppError('Service log not found', 404));
      }

      // Check ownership and delete permissions
      if (serviceLog.userId !== userId && req.user?.role !== 'admin') {
        return next(new AppError('Access denied', 403));
      }

      // Can only delete drafts (unless admin)
      if (!serviceLog.isDraft && req.user?.role !== 'admin') {
        return next(new AppError('Can only delete draft service logs', 400));
      }

      // Soft delete the service log (patient entries cascade)
      await this.serviceLogRepo.softDelete(serviceLogId);

      logger.info(`Service log deleted`, {
        serviceLogId,
        userId,
        deletedBy: req.user?.role,
        wasDraft: serviceLog.isDraft,
      });

      res.json({
        success: true,
        data: {
          message: 'Service log deleted successfully',
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/service-logs/options - Get dropdown options for form
  public getFormOptions = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const [clients, activities, outcomes] = await Promise.all([
        this.clientRepo.findActive(),
        this.activityRepo.findActive(),
        this.outcomeRepo.findActive(),
      ]);

      res.json({
        success: true,
        data: {
          clients,
          activities,
          outcomes,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };
}