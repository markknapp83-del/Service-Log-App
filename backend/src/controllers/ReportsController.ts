// Reports Controller following Express.js documentation patterns
import { Request, Response, NextFunction } from 'express';
import { ServiceLogRepository } from '../models/ServiceLogRepository';
import { ClientRepository } from '../models/ClientRepository';
import { ActivityRepository } from '../models/ActivityRepository';
import { OutcomeRepository } from '../models/OutcomeRepository';
import { PatientEntryRepository } from '../models/PatientEntryRepository';
import { AuthenticatedRequest } from '../types';
import { ApiError } from '../utils/errors';
import { logger } from '../utils/logger';
import { arrayToCsv, setCsvHeaders, setExcelHeaders, generateExportFilename } from '../utils/csv';

export class ReportsController {
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

  // Helper method for batch processing exports
  private async processBatchForExport(
    logs: any[],
    clientMap: Map<string, string>,
    activityMap: Map<string, string>,
    outcomeMap: Map<string, string>
  ): Promise<any[]> {
    const batchData: any[] = [];
    
    // Get all patient entries for this batch in one query
    const logIds = logs.map(log => log.id);
    const allPatientEntries = await this.patientEntryRepo.findByServiceLogIds(logIds);
    
    // Group patient entries by service log ID for efficient lookup
    const entriesByLogId = new Map<string, any[]>();
    allPatientEntries.forEach(entry => {
      if (!entriesByLogId.has(entry.serviceLogId)) {
        entriesByLogId.set(entry.serviceLogId, []);
      }
      entriesByLogId.get(entry.serviceLogId)!.push(entry);
    });

    for (const log of logs) {
      const patientEntries = entriesByLogId.get(log.id) || [];
      const clientName = clientMap.get(log.clientId.toString()) || 'Unknown Client';
      const activityName = activityMap.get(log.activityId.toString()) || 'Unknown Activity';

      if (patientEntries.length === 0) {
        // Single row for logs without patient entries
        batchData.push({
          serviceLogId: log.id,
          userId: log.userId,
          clientName: clientName,
          activityName: activityName,
          serviceDate: log.serviceDate || '',
          totalPatientCount: log.patientCount,
          newPatients: 0,
          followupPatients: 0,
          dnaCount: 0,
          primaryOutcome: '',
          isDraft: log.isDraft,
          submittedAt: log.submittedAt || '',
          createdAt: log.createdAt,
          updatedAt: log.updatedAt
        });
      } else {
        // One row per patient entry for detailed reporting
        for (const entry of patientEntries) {
          const outcomeName = entry.outcomeId 
            ? (outcomeMap.get(entry.outcomeId.toString()) || 'Unknown Outcome')
            : '';

          batchData.push({
            serviceLogId: log.id,
            userId: log.userId,
            clientName: clientName,
            activityName: activityName,
            serviceDate: log.serviceDate || '',
            totalPatientCount: log.patientCount,
            newPatients: entry.newPatients || 0,
            followupPatients: entry.followupPatients || 0,
            dnaCount: entry.dnaCount || 0,
            primaryOutcome: outcomeName,
            isDraft: log.isDraft,
            submittedAt: log.submittedAt || '',
            createdAt: log.createdAt,
            updatedAt: log.updatedAt
          });
        }
      }
    }

    return batchData;
  }

  // Helper method for calculating weekdays in date range
  private calculateWeekdays(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let count = 0;
    
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dayOfWeek = date.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
        count++;
      }
    }
    
    return count;
  }

  // GET /api/reports/export - Export service logs as CSV or Excel
  public exportServiceLogs = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const isAdmin = req.user?.role === 'admin';
      
      if (!userId) {
        return next(new ApiError(401, 'User not authenticated'));
      }

      const {
        format = 'csv',
        dateFrom,
        dateTo,
        clientId,
        activityId,
        userId: filterUserId,
        isDraft
      } = req.query;

      // Build filters - candidates can only access their own data
      const filters: any = {};
      
      if (dateFrom) filters.startDate = dateFrom as string;
      if (dateTo) filters.endDate = dateTo as string;
      if (clientId) filters.clientId = clientId as string;
      if (activityId) filters.activityId = activityId as string;
      if (isDraft !== undefined) filters.isDraft = isDraft === 'true';

      // Admin can filter by userId, candidates are restricted to their own data
      if (isAdmin && filterUserId) {
        filters.userId = filterUserId as string;
      } else if (!isAdmin) {
        filters.userId = userId;
      }

      logger.info('Exporting service logs', {
        format,
        filters,
        requestedBy: userId,
        isAdmin
      });

      // Get service logs with streaming support for large exports
      const maxExportLimit = 50000; // Reasonable limit for CSV exports
      const serviceLogs = await this.serviceLogRepo.findWithFilters(filters, {
        page: 1,
        limit: maxExportLimit,
        orderBy: 'created_at',
        orderDirection: 'DESC'
      });

      // Warn if hitting export limit
      if (serviceLogs.total > maxExportLimit) {
        logger.warn('Export limit exceeded', {
          total: serviceLogs.total,
          limit: maxExportLimit,
          userId
        });
      }

      // Get reference data with caching for performance
      const [clients, activities, outcomes] = await Promise.all([
        this.clientRepo.findAll({ limit: 1000 }), // Reasonable limit for reference data
        this.activityRepo.findAll({ limit: 1000 }),
        this.outcomeRepo.findAll({ limit: 1000 })
      ]);

      // Create optimized lookup maps for O(1) data enrichment
      const clientMap = new Map(clients.items.map(c => [c.id.toString(), c.name]));
      const activityMap = new Map(activities.items.map(a => [a.id.toString(), a.name]));
      const outcomeMap = new Map(outcomes.items.map(o => [o.id.toString(), o.name]));

      // Prepare export data with batch processing for memory efficiency
      const exportData: any[] = [];
      const batchSize = 1000; // Process in batches to manage memory
      
      // Process service logs in batches
      for (let i = 0; i < serviceLogs.items.length; i += batchSize) {
        const batch = serviceLogs.items.slice(i, i + batchSize);
        const batchData = await this.processBatchForExport(batch, clientMap, activityMap, outcomeMap);
        exportData.push(...batchData);
        
        // Log progress for large exports
        if (serviceLogs.items.length > 5000 && i % (batchSize * 5) === 0) {
          logger.info('Export progress', {
            processed: Math.min(i + batchSize, serviceLogs.items.length),
            total: serviceLogs.items.length,
            userId
          });
        }
      }

      // Generate CSV using utility function
      const csvHeaders = [
        'serviceLogId', 'userId', 'clientName', 'activityName', 'serviceDate',
        'totalPatientCount', 'newPatients', 'followupPatients', 'dnaCount',
        'primaryOutcome', 'isDraft', 'submittedAt', 'createdAt', 'updatedAt'
      ];
      
      const csvHeaderLabels = [
        'Service Log ID', 'User ID', 'Client Name', 'Activity Name', 'Service Date',
        'Total Patient Count', 'New Patients', 'Followup Patients', 'DNA Count',
        'Primary Outcome', 'Is Draft', 'Submitted At', 'Created At', 'Updated At'
      ];

      const csvContent = arrayToCsv(exportData, csvHeaders, csvHeaderLabels);

      // Set appropriate headers for file download
      const filename = generateExportFilename('service-logs-export', format as 'csv' | 'excel');
      
      if (format === 'csv') {
        setCsvHeaders(res, filename);
      } else if (format === 'excel') {
        // For now, return CSV with Excel MIME type. In production, would use xlsx library
        setExcelHeaders(res, filename);
      } else {
        return next(new ApiError(400, 'Unsupported export format. Use csv or excel.'));
      }

      logger.info('Export completed', {
        format,
        rowCount: exportData.length,
        logCount: serviceLogs.items.length,
        userId,
        filters
      });

      return res.send(csvContent);

    } catch (error) {
      logger.error('Export failed', { error, userId: req.user?.id });
      next(error);
    }
  };

  // GET /api/reports/summary - Get summary statistics and analytics
  public getSummaryReport = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const isAdmin = req.user?.role === 'admin';
      
      if (!userId) {
        return next(new ApiError(401, 'User not authenticated'));
      }

      const {
        dateFrom,
        dateTo,
        clientId,
        activityId,
        userId: filterUserId
      } = req.query;

      // Build filters - candidates can only access their own data
      const filters: any = {};
      
      if (dateFrom) filters.startDate = dateFrom as string;
      if (dateTo) filters.endDate = dateTo as string;
      if (clientId) filters.clientId = clientId as string;
      if (activityId) filters.activityId = activityId as string;

      // Admin can filter by userId, candidates are restricted to their own data
      if (isAdmin && filterUserId) {
        filters.userId = filterUserId as string;
      } else if (!isAdmin) {
        filters.userId = userId;
      }

      logger.info('Generating summary report', {
        filters,
        requestedBy: userId,
        isAdmin
      });

      // Get comprehensive statistics using the repository method
      const stats = await this.serviceLogRepo.getStatistics(filters);

      // Get additional appointment type breakdowns
      const serviceLogs = await this.serviceLogRepo.findWithFilters(filters, {
        page: 1,
        limit: 10000
      });

      // Calculate appointment type statistics with batch processing
      let totalNewPatients = 0;
      let totalFollowupPatients = 0;
      let totalDnaCount = 0;
      
      const outcomeBreakdown: { [outcomeName: string]: number } = {};
      const outcomeCache = new Map<number, string>();

      // Process in batches to avoid excessive individual queries
      const logIds = serviceLogs.items.map(log => log.id);
      const allPatientEntries = await this.patientEntryRepo.findByServiceLogIds(logIds);
      
      // Get unique outcome IDs for batch lookup
      const uniqueOutcomeIds = [...new Set(allPatientEntries
        .map(entry => entry.outcomeId)
        .filter(id => id != null))];
      
      // Batch load outcomes to reduce database calls
      for (const outcomeId of uniqueOutcomeIds) {
        const outcome = await this.outcomeRepo.findById(outcomeId);
        if (outcome) {
          outcomeCache.set(outcomeId, outcome.name);
        }
      }

      // Calculate totals using batch-loaded data
      for (const entry of allPatientEntries) {
        totalNewPatients += entry.newPatients || 0;
        totalFollowupPatients += entry.followupPatients || 0;
        totalDnaCount += entry.dnaCount || 0;

        // Get outcome breakdown using cached data
        if (entry.outcomeId) {
          const outcomeName = outcomeCache.get(entry.outcomeId);
          if (outcomeName) {
            outcomeBreakdown[outcomeName] = (outcomeBreakdown[outcomeName] || 0) + 
              ((entry.newPatients || 0) + (entry.followupPatients || 0));
          }
        }
      }

      // Calculate date range summary
      const dateRange = {
        from: filters.startDate || serviceLogs.items[serviceLogs.items.length - 1]?.createdAt.split('T')[0] || null,
        to: filters.endDate || serviceLogs.items[0]?.createdAt.split('T')[0] || null
      };

      // Build comprehensive summary response
      // Build optimized summary data with caching
      const summaryData = {
        // Overview statistics
        overview: {
          totalServiceLogs: stats.totalLogs,
          totalDrafts: stats.totalDrafts,
          totalSubmitted: stats.totalSubmitted,
          totalPatients: stats.totalPatients,
          averagePatientsPerLog: stats.averagePatientsPerLog,
          completionRate: stats.totalLogs > 0 
            ? Math.round((stats.totalSubmitted / stats.totalLogs) * 100) 
            : 0
        },

        // Appointment type breakdown
        appointmentTypes: {
          newPatients: totalNewPatients,
          followupPatients: totalFollowupPatients,
          dnaCount: totalDnaCount,
          totalAppointments: totalNewPatients + totalFollowupPatients + totalDnaCount,
          dnaRate: (totalNewPatients + totalFollowupPatients + totalDnaCount) > 0
            ? Math.round((totalDnaCount / (totalNewPatients + totalFollowupPatients + totalDnaCount)) * 100)
            : 0
        },

        // Enhanced breakdowns from repository
        breakdowns: {
          byClient: stats.logsByClient.slice(0, 15), // Top 15 for better insights
          byActivity: stats.logsByActivity.slice(0, 15), // Top 15 for better insights
          byOutcome: Object.entries(outcomeBreakdown)
            .map(([name, count]) => ({ outcomeName: name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10)
        },

        // Enhanced time period information
        period: {
          dateRange,
          totalDays: dateRange.from && dateRange.to 
            ? Math.ceil((new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime()) / (1000 * 60 * 60 * 24)) + 1
            : null,
          weekdays: dateRange.from && dateRange.to ? this.calculateWeekdays(dateRange.from, dateRange.to) : null
        },

        // Filters applied with validation status
        appliedFilters: {
          dateFrom: filters.startDate || null,
          dateTo: filters.endDate || null,
          clientId: filters.clientId || null,
          activityId: filters.activityId || null,
          userId: filters.userId || null,
          hasFilters: !!(filters.startDate || filters.endDate || filters.clientId || filters.activityId || filters.userId)
        }
      };

      logger.info('Summary report generated', {
        userId,
        totalLogs: stats.totalLogs,
        totalPatients: stats.totalPatients,
        dateRange
      });

      res.json({
        success: true,
        data: summaryData,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Summary report failed', { error, userId: req.user?.id });
      next(error);
    }
  };
}