// Service Log Repository following documented healthcare patterns
import { BaseRepository } from './BaseRepository';
import { 
  ServiceLog, 
  DatabaseServiceLog, 
  ServiceLogId, 
  ServiceLogCreateRequest,
  ServiceLogFilters,
  ServiceLogWithDetails,
  UserId,
  ClientId,
  ActivityId,
  ISODateString,
  PaginatedResult,
  PaginationOptions 
} from '@/types/index';

export class ServiceLogRepository extends BaseRepository<ServiceLog, DatabaseServiceLog, ServiceLogId> {
  constructor() {
    super('service_logs');
  }

  // Convert database row to domain object
  protected fromDatabase(dbRow: DatabaseServiceLog): ServiceLog {
    return {
      id: dbRow.id,
      userId: dbRow.user_id,
      clientId: String(dbRow.client_id), // Convert number to string for frontend consistency
      activityId: String(dbRow.activity_id), // Convert number to string for frontend consistency
      serviceDate: dbRow.service_date,
      patientCount: dbRow.patient_count,
      isDraft: this.convertBooleanFromDb(dbRow.is_draft),
      submittedAt: this.convertDateFromDb(dbRow.submitted_at),
      createdAt: dbRow.created_at,
      updatedAt: dbRow.updated_at
    };
  }

  // Convert domain object to database row
  protected toDatabase(domain: Partial<ServiceLog>): Partial<DatabaseServiceLog> {
    const result: Partial<DatabaseServiceLog> = {};

    if (domain.id !== undefined) result.id = domain.id;
    if (domain.userId !== undefined) result.user_id = domain.userId;
    if (domain.clientId !== undefined) result.client_id = Number(domain.clientId); // Convert string back to number for database
    if (domain.activityId !== undefined) result.activity_id = Number(domain.activityId); // Convert string back to number for database
    if (domain.serviceDate !== undefined) result.service_date = domain.serviceDate;
    if (domain.patientCount !== undefined) result.patient_count = domain.patientCount;
    if (domain.isDraft !== undefined) result.is_draft = this.convertBooleanToDb(domain.isDraft);
    if ('submittedAt' in domain) result.submitted_at = this.convertDateToDb(domain.submittedAt);
    if (domain.createdAt !== undefined) result.created_at = domain.createdAt;
    if (domain.updatedAt !== undefined) result.updated_at = domain.updatedAt;

    return result;
  }

  // Find service logs by user
  async findByUser(
    userId: UserId, 
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<ServiceLog>> {
    return await this.findAll({
      ...options,
      where: 'user_id = ?',
      params: [userId]
    });
  }

  // Find service logs by client
  async findByClient(
    clientId: ClientId, 
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<ServiceLog>> {
    return await this.findAll({
      ...options,
      where: 'client_id = ?',
      params: [clientId]
    });
  }

  // Find service logs by activity
  async findByActivity(
    activityId: ActivityId, 
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<ServiceLog>> {
    return await this.findAll({
      ...options,
      where: 'activity_id = ?',
      params: [activityId]
    });
  }

  // Optimized find draft service logs for a user with caching
  async findDraftsByUser(userId: UserId): Promise<ServiceLog[]> {
    try {
      const cacheKey = 'service_logs_drafts_by_user';
      const stmt = this.db.prepare(`
        SELECT * FROM ${this.tableName}
        WHERE user_id = ? AND is_draft = 1
        AND (deleted_at IS NULL OR deleted_at = '')
        ORDER BY updated_at DESC
        LIMIT 50
      `, cacheKey);

      const rows = stmt.all(userId) as DatabaseServiceLog[];
      return rows.map(row => this.fromDatabase(row));
    } catch (error) {
      throw new Error(`Failed to find drafts for user ${userId}: ${error}`);
    }
  }

  // High-performance service logs query with materialized view fallback
  async findWithFilters(
    filters: ServiceLogFilters,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<ServiceLog>> {
    try {
      const { 
        page = 1, 
        limit = 20, 
        orderBy = 'created_at', 
        orderDirection = 'DESC' 
      } = options;
      
      const offset = (page - 1) * limit;
      const whereClauses: string[] = ['(sl.deleted_at IS NULL OR sl.deleted_at = \'\')'];
      const params: any[] = [];

      // Build optimized WHERE clause with proper index usage
      if (filters.userId) {
        whereClauses.push('sl.user_id = ?');
        params.push(filters.userId);
      }

      if (filters.clientId) {
        whereClauses.push('sl.client_id = ?');
        params.push(filters.clientId);
      }

      if (filters.activityId) {
        whereClauses.push('sl.activity_id = ?');
        params.push(filters.activityId);
      }

      if (filters.isDraft !== undefined) {
        whereClauses.push('sl.is_draft = ?');
        params.push(this.convertBooleanToDb(filters.isDraft));
      }

      // Use indexed date range queries with optimized BETWEEN clause
      if (filters.startDate && filters.endDate) {
        whereClauses.push('sl.service_date BETWEEN ? AND ?');
        params.push(filters.startDate, filters.endDate);
      } else if (filters.startDate) {
        whereClauses.push('sl.service_date >= ?');
        params.push(filters.startDate);
      } else if (filters.endDate) {
        whereClauses.push('sl.service_date <= ?');
        params.push(filters.endDate);
      }

      const whereClause = whereClauses.join(' AND ');

      // Try using materialized reporting view for better performance (if available)
      let useReportingView = false;
      try {
        // Check if reporting view exists and is recent
        const viewCheck = this.db.get(`
          SELECT COUNT(*) as count FROM sqlite_master 
          WHERE type='table' AND name='service_log_reporting_view'
        `) as { count: number };
        
        useReportingView = viewCheck.count > 0;
      } catch (error) {
        useReportingView = false;
      }

      let stmt: any, countStmt: any, rows: any[], countResult: any;

      if (useReportingView) {
        // Use optimized reporting view for faster queries
        // Remove deleted_at conditions since reporting view only contains active records
        let reportingWhereClause = whereClause.replace(/sl\./g, 'rv.');
        
        // Remove deleted_at condition and fix any resulting syntax issues
        reportingWhereClause = reportingWhereClause
          .replace(/\(rv\.deleted_at IS NULL OR rv\.deleted_at = ''\)\s*AND\s*/g, '')  // Remove if at start
          .replace(/\s*AND\s*\(rv\.deleted_at IS NULL OR rv\.deleted_at = ''\)/g, '')  // Remove if in middle/end
          .replace(/^\s*AND\s+/g, '')  // Remove leading AND
          .replace(/\s*AND\s*$/g, '')  // Remove trailing AND
          .trim();
          
        // If we end up with an empty clause, use '1=1' to make SQL valid
        if (!reportingWhereClause) {
          reportingWhereClause = '1=1';
        }
        const cacheKey = `service_logs_with_filters_reporting_${JSON.stringify(filters)}_${orderBy}_${orderDirection}`;
        
        stmt = this.db.prepare(`
          SELECT 
            rv.*
          FROM service_log_reporting_view rv
          WHERE ${reportingWhereClause}
          ORDER BY rv.${orderBy} ${orderDirection}
          LIMIT ? OFFSET ?
        `, cacheKey);

        const countKey = `service_logs_count_reporting_${JSON.stringify(filters)}`;
        countStmt = this.db.prepare(`
          SELECT COUNT(*) as total FROM service_log_reporting_view rv
          WHERE ${reportingWhereClause}
        `, countKey);

        rows = stmt.all(...params, limit, offset);
        countResult = countStmt.get(...params) as { total: number };
        
        // Transform reporting view data to expected format
        const items = rows.map(row => ({
          id: row.id,
          userId: row.user_id,
          clientId: String(row.client_id),
          activityId: String(row.activity_id),
          serviceDate: row.service_date,
          patientCount: 0, // Will be calculated from appointments
          isDraft: this.convertBooleanFromDb(row.is_draft),
          submittedAt: row.submitted_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          client: {
            id: String(row.client_id),
            name: row.client_name,
            isActive: true,
            createdAt: row.created_at,
            updatedAt: row.updated_at
          },
          activity: {
            id: String(row.activity_id),
            name: row.activity_name,
            isActive: true,
            createdAt: row.created_at,
            updatedAt: row.updated_at
          },
          appointmentBreakdown: {
            new: row.new_appointments || 0,
            followup: row.followup_appointments || 0,
            dna: row.dna_appointments || 0,
            total: row.total_appointments || 0
          }
        }));
        
        return {
          items,
          total: countResult.total,
          page,
          limit,
          pages: Math.ceil(countResult.total / limit)
        };
      } else {
        // Fallback to full query with optimized prepared statements
        const cacheKey = `service_logs_with_filters_full_${JSON.stringify(filters)}_${orderBy}_${orderDirection}`;
        
        stmt = this.db.prepare(`
          SELECT 
            sl.*,
            c.name as client_name,
            a.name as activity_name,
            u.first_name as user_first_name,
            u.last_name as user_last_name,
            COALESCE(appointment_stats.new_count, 0) as new_count,
            COALESCE(appointment_stats.followup_count, 0) as followup_count,
            COALESCE(appointment_stats.dna_count, 0) as dna_count,
            COALESCE(appointment_stats.total_count, 0) as total_appointments
          FROM service_logs sl
          LEFT JOIN clients c ON sl.client_id = c.id
          LEFT JOIN activities a ON sl.activity_id = a.id
          LEFT JOIN users u ON sl.user_id = u.id
          LEFT JOIN (
            SELECT 
              pe.service_log_id,
              SUM(CASE WHEN pe.appointment_type = 'new' THEN 1 ELSE 0 END) as new_count,
              SUM(CASE WHEN pe.appointment_type = 'followup' THEN 1 ELSE 0 END) as followup_count,
              SUM(CASE WHEN pe.appointment_type = 'dna' THEN 1 ELSE 0 END) as dna_count,
              COUNT(pe.id) as total_count
            FROM patient_entries pe
            WHERE (pe.deleted_at IS NULL OR pe.deleted_at = '')
            GROUP BY pe.service_log_id
          ) appointment_stats ON sl.id = appointment_stats.service_log_id
          WHERE ${whereClause}
          ORDER BY sl.${orderBy} ${orderDirection}
          LIMIT ? OFFSET ?
        `, cacheKey);

        const countKey = `service_logs_count_full_${JSON.stringify(filters)}`;
        countStmt = this.db.prepare(`
          SELECT COUNT(*) as total FROM service_logs sl
          WHERE ${whereClause}
        `, countKey);

        // Execute queries with proper parameter handling
        rows = stmt.all(...params, limit, offset) as (DatabaseServiceLog & {
          client_name?: string;
          activity_name?: string;
          user_first_name?: string;
          user_last_name?: string;
          new_count: number;
          followup_count: number;
          dna_count: number;
          total_appointments: number;
        })[];
        countResult = countStmt.get(...params) as { total: number };

        const items = rows.map(row => {
          const serviceLog = this.fromDatabase(row);
          return {
            ...serviceLog,
            client: row.client_name ? {
              id: serviceLog.clientId,
              name: row.client_name,
              isActive: true,
              createdAt: serviceLog.createdAt,
              updatedAt: serviceLog.updatedAt
            } : undefined,
            activity: row.activity_name ? {
              id: serviceLog.activityId,
              name: row.activity_name,
              isActive: true,
              createdAt: serviceLog.createdAt,
              updatedAt: serviceLog.updatedAt
            } : undefined,
            user: (row.user_first_name && row.user_last_name) ? {
              id: serviceLog.userId,
              firstName: row.user_first_name,
              lastName: row.user_last_name
            } : undefined,
            // Add appointment breakdown
            appointmentBreakdown: {
              new: row.new_count,
              followup: row.followup_count,
              dna: row.dna_count,
              total: row.total_appointments
            }
          };
        });
        
        return {
          items,
          total: countResult.total,
          page,
          limit,
          pages: Math.ceil(countResult.total / limit)
        };
      }
    } catch (error) {
      throw new Error(`Failed to find service logs with filters: ${error}`);
    }
  }

  // Get service log with full details (joins)
  async findByIdWithDetails(id: ServiceLogId): Promise<ServiceLogWithDetails | null> {
    try {
      const stmt = await this.db.prepare(`
        SELECT 
          sl.*,
          c.name as client_name,
          a.name as activity_name,
          u.first_name as user_first_name,
          u.last_name as user_last_name
        FROM ${this.tableName} sl
        LEFT JOIN clients c ON sl.client_id = c.id
        LEFT JOIN activities a ON sl.activity_id = a.id
        LEFT JOIN users u ON sl.user_id = u.id
        WHERE sl.id = ? 
        AND (sl.deleted_at IS NULL OR sl.deleted_at = '')
      `);

      const row = await stmt.get(id) as (DatabaseServiceLog & {
        client_name?: string;
        activity_name?: string;
        user_first_name?: string;
        user_last_name?: string;
      }) | undefined;

      if (!row) {
        return null;
      }

      const serviceLog = this.fromDatabase(row);

      // Get patient entries
      const patientEntriesStmt = await this.db.prepare(`
        SELECT 
          pe.*,
          o.name as outcome_name
        FROM patient_entries pe
        LEFT JOIN outcomes o ON pe.outcome_id = o.id
        WHERE pe.service_log_id = ?
        AND (pe.deleted_at IS NULL OR pe.deleted_at = '')
        ORDER BY pe.created_at ASC
      `);

      const patientEntryRows = await patientEntriesStmt.all(id) as Array<{
        id: string;
        service_log_id: string;
        new_patients: number;
        followup_patients: number;
        dna_count: number;
        outcome_id: number | null;
        created_at: string;
        updated_at: string;
        outcome_name?: string;
      }>;

      const patientEntries = patientEntryRows.map(pe => ({
        id: pe.id,
        serviceLogId: pe.service_log_id,
        newPatients: pe.new_patients,
        followupPatients: pe.followup_patients,
        dnaCount: pe.dna_count,
        outcomeId: pe.outcome_id || undefined,
        createdAt: pe.created_at,
        updatedAt: pe.updated_at,
        outcome: pe.outcome_name ? {
          id: pe.outcome_id!,
          name: pe.outcome_name,
          isActive: true,
          createdAt: pe.created_at,
          updatedAt: pe.updated_at
        } : undefined
      }));

      return {
        ...serviceLog,
        client: row.client_name ? {
          id: serviceLog.clientId,
          name: row.client_name,
          isActive: true,
          createdAt: serviceLog.createdAt,
          updatedAt: serviceLog.updatedAt
        } : undefined,
        activity: row.activity_name ? {
          id: serviceLog.activityId,
          name: row.activity_name,
          isActive: true,
          createdAt: serviceLog.createdAt,
          updatedAt: serviceLog.updatedAt
        } : undefined,
        user: (row.user_first_name && row.user_last_name) ? {
          id: serviceLog.userId,
          firstName: row.user_first_name,
          lastName: row.user_last_name
        } : undefined,
        patientEntries
      };
    } catch (error) {
      throw new Error(`Failed to find service log with details: ${error}`);
    }
  }

  // Submit a draft (mark as submitted)
  async submitDraft(id: ServiceLogId, userId: UserId): Promise<ServiceLog> {
    const serviceLog = await this.findById(id);
    if (!serviceLog) {
      throw new Error(`Service log not found: ${id}`);
    }

    if (!serviceLog.isDraft) {
      throw new Error(`Service log ${id} is not a draft`);
    }

    if (serviceLog.userId !== userId) {
      throw new Error(`User ${userId} not authorized to submit service log ${id}`);
    }

    return await this.update(id, {
      isDraft: false,
      submittedAt: new Date().toISOString()
    }, userId);
  }

  // Convert submitted service log back to draft
  async convertToDraft(id: ServiceLogId, userId: UserId): Promise<ServiceLog> {
    const serviceLog = await this.findById(id);
    if (!serviceLog) {
      throw new Error(`Service log not found: ${id}`);
    }

    if (serviceLog.isDraft) {
      throw new Error(`Service log ${id} is already a draft`);
    }

    return await this.update(id, {
      isDraft: true,
      submittedAt: null
    }, userId);
  }

  // High-performance statistics with materialized view optimization
  async getStatistics(filters?: ServiceLogFilters): Promise<{
    totalLogs: number;
    totalDrafts: number;
    totalSubmitted: number;
    totalPatients: number;
    averagePatientsPerLog: number;
    logsByClient: Array<{ clientId: number; clientName: string; count: number }>;
    logsByActivity: Array<{ activityId: number; activityName: string; count: number }>;
  }> {
    try {
      // Build WHERE clause for filters with optimized parameter binding
      const whereClauses: string[] = ['(sl.deleted_at IS NULL OR sl.deleted_at = \'\')'];
      const params: any[] = [];

      if (filters?.userId) {
        whereClauses.push('sl.user_id = ?');
        params.push(filters.userId);
      }

      if (filters?.startDate && filters?.endDate) {
        whereClauses.push('sl.service_date BETWEEN ? AND ?');
        params.push(filters.startDate, filters.endDate);
      } else if (filters?.startDate) {
        whereClauses.push('sl.service_date >= ?');
        params.push(filters.startDate);
      } else if (filters?.endDate) {
        whereClauses.push('sl.service_date <= ?');
        params.push(filters.endDate);
      }

      const whereClause = whereClauses.join(' AND ');

      // Check if we can use the reporting view for faster statistics
      let useReportingView = false;
      try {
        const viewCheck = this.db.get(`
          SELECT COUNT(*) as count FROM sqlite_master 
          WHERE type='table' AND name='service_log_reporting_view'
        `) as { count: number };
        
        useReportingView = viewCheck.count > 0;
      } catch (error) {
        useReportingView = false;
      }

      if (useReportingView) {
        // Use optimized reporting view for statistics
        // Remove deleted_at conditions since reporting view only contains active records
        let reportingWhereClause = whereClause.replace(/sl\./g, 'rv.');
        
        // Remove deleted_at condition and fix any resulting syntax issues
        reportingWhereClause = reportingWhereClause
          .replace(/\(rv\.deleted_at IS NULL OR rv\.deleted_at = ''\)\s*AND\s*/g, '')  // Remove if at start
          .replace(/\s*AND\s*\(rv\.deleted_at IS NULL OR rv\.deleted_at = ''\)/g, '')  // Remove if in middle/end
          .replace(/^\s*AND\s+/g, '')  // Remove leading AND
          .replace(/\s*AND\s*$/g, '')  // Remove trailing AND
          .trim();
          
        // If we end up with an empty clause, use '1=1' to make SQL valid
        if (!reportingWhereClause) {
          reportingWhereClause = '1=1';
        }
        const statsKey = `statistics_reporting_${JSON.stringify(filters || {})}`;
        
        const statsStmt = this.db.prepare(`
          SELECT 
            COUNT(*) as total_logs,
            SUM(CASE WHEN rv.is_draft = 1 THEN 1 ELSE 0 END) as total_drafts,
            SUM(CASE WHEN rv.is_draft = 0 THEN 1 ELSE 0 END) as total_submitted,
            COALESCE(SUM(rv.total_appointments), 0) as total_patients,
            COALESCE(AVG(CAST(rv.total_appointments AS FLOAT)), 0) as average_patients_per_log
          FROM service_log_reporting_view rv
          WHERE ${reportingWhereClause}
        `, statsKey);

        const clientStatsKey = `client_stats_reporting_${JSON.stringify(filters || {})}`;
        const clientStatsStmt = this.db.prepare(`
          SELECT 
            rv.client_id,
            rv.client_name,
            COUNT(*) as count
          FROM service_log_reporting_view rv
          WHERE ${reportingWhereClause}
          GROUP BY rv.client_id, rv.client_name
          ORDER BY count DESC
          LIMIT 20
        `, clientStatsKey);

        const activityStatsKey = `activity_stats_reporting_${JSON.stringify(filters || {})}`;
        const activityStatsStmt = this.db.prepare(`
          SELECT 
            rv.activity_id,
            rv.activity_name,
            COUNT(*) as count
          FROM service_log_reporting_view rv
          WHERE ${reportingWhereClause}
          GROUP BY rv.activity_id, rv.activity_name
          ORDER BY count DESC
          LIMIT 20
        `, activityStatsKey);

        const [basicStats, clientStats, activityStats] = [
          statsStmt.get(...params) as {
            total_logs: number;
            total_drafts: number;
            total_submitted: number;
            total_patients: number;
            average_patients_per_log: number;
          },
          clientStatsStmt.all(...params) as Array<{
            client_id: number;
            client_name: string;
            count: number;
          }>,
          activityStatsStmt.all(...params) as Array<{
            activity_id: number;
            activity_name: string;
            count: number;
          }>
        ];

        return {
          totalLogs: basicStats.total_logs || 0,
          totalDrafts: basicStats.total_drafts || 0,
          totalSubmitted: basicStats.total_submitted || 0,
          totalPatients: basicStats.total_patients || 0,
          averagePatientsPerLog: Math.round((basicStats.average_patients_per_log || 0) * 100) / 100,
          logsByClient: clientStats.map(stat => ({
            clientId: stat.client_id,
            clientName: stat.client_name,
            count: stat.count
          })),
          logsByActivity: activityStats.map(stat => ({
            activityId: stat.activity_id,
            activityName: stat.activity_name,
            count: stat.count
          }))
        };
      } else {
        // Fallback to optimized queries on main tables
        const statsKey = `statistics_full_${JSON.stringify(filters || {})}`;
        
        const basicStatsStmt = this.db.prepare(`
          SELECT 
            COUNT(*) as total_logs,
            SUM(CASE WHEN sl.is_draft = 1 THEN 1 ELSE 0 END) as total_drafts,
            SUM(CASE WHEN sl.is_draft = 0 THEN 1 ELSE 0 END) as total_submitted,
            COALESCE(SUM(appointment_counts.total_appointments), 0) as total_patients,
            COALESCE(AVG(CAST(appointment_counts.total_appointments AS FLOAT)), 0) as average_patients_per_log
          FROM service_logs sl
          LEFT JOIN (
            SELECT 
              pe.service_log_id,
              COUNT(pe.id) as total_appointments
            FROM patient_entries pe
            WHERE (pe.deleted_at IS NULL OR pe.deleted_at = '')
            GROUP BY pe.service_log_id
          ) appointment_counts ON sl.id = appointment_counts.service_log_id
          WHERE ${whereClause}
        `, statsKey);

        const clientStatsKey = `client_stats_full_${JSON.stringify(filters || {})}`;
        const clientStatsStmt = this.db.prepare(`
          SELECT 
            c.id as client_id,
            c.name as client_name,
            COUNT(sl.id) as count
          FROM service_logs sl
          JOIN clients c ON sl.client_id = c.id
          WHERE ${whereClause}
          GROUP BY c.id, c.name
          ORDER BY count DESC
          LIMIT 20
        `, clientStatsKey);

        const activityStatsKey = `activity_stats_full_${JSON.stringify(filters || {})}`;
        const activityStatsStmt = this.db.prepare(`
          SELECT 
            a.id as activity_id,
            a.name as activity_name,
            COUNT(sl.id) as count
          FROM service_logs sl
          JOIN activities a ON sl.activity_id = a.id
          WHERE ${whereClause}
          GROUP BY a.id, a.name
          ORDER BY count DESC
          LIMIT 20
        `, activityStatsKey);

        const [basicStats, clientStats, activityStats] = [
          basicStatsStmt.get(...params) as {
            total_logs: number;
            total_drafts: number;
            total_submitted: number;
            total_patients: number;
            average_patients_per_log: number;
          },
          clientStatsStmt.all(...params) as Array<{
            client_id: number;
            client_name: string;
            count: number;
          }>,
          activityStatsStmt.all(...params) as Array<{
            activity_id: number;
            activity_name: string;
            count: number;
          }>
        ];

        return {
          totalLogs: basicStats.total_logs || 0,
          totalDrafts: basicStats.total_drafts || 0,
          totalSubmitted: basicStats.total_submitted || 0,
          totalPatients: basicStats.total_patients || 0,
          averagePatientsPerLog: Math.round((basicStats.average_patients_per_log || 0) * 100) / 100,
          logsByClient: clientStats.map(stat => ({
            clientId: stat.client_id,
            clientName: stat.client_name,
            count: stat.count
          })),
          logsByActivity: activityStats.map(stat => ({
            activityId: stat.activity_id,
            activityName: stat.activity_name,
            count: stat.count
          }))
        };
      }
    } catch (error) {
      throw new Error(`Failed to get service log statistics: ${error}`);
    }
  }

  // Refresh the reporting view for optimal performance
  async refreshReportingView(): Promise<void> {
    try {
      logger.info('Refreshing service log reporting view for optimal performance');
      
      // Clear and repopulate the reporting view
      this.db.transaction(() => {
        this.db.exec('DELETE FROM service_log_reporting_view');
        
        this.db.exec(`
          INSERT INTO service_log_reporting_view (
            id, user_id, client_id, client_name, activity_id, activity_name,
            service_date, is_draft, submitted_at, total_appointments,
            new_appointments, followup_appointments, dna_appointments,
            created_at, updated_at
          )
          SELECT 
            sl.id,
            sl.user_id,
            sl.client_id,
            c.name as client_name,
            sl.activity_id,
            a.name as activity_name,
            sl.service_date,
            sl.is_draft,
            sl.submitted_at,
            COALESCE(COUNT(pe.id), 0) as total_appointments,
            COALESCE(SUM(CASE WHEN pe.appointment_type = 'new' THEN 1 ELSE 0 END), 0) as new_appointments,
            COALESCE(SUM(CASE WHEN pe.appointment_type = 'followup' THEN 1 ELSE 0 END), 0) as followup_appointments,
            COALESCE(SUM(CASE WHEN pe.appointment_type = 'dna' THEN 1 ELSE 0 END), 0) as dna_appointments,
            sl.created_at,
            sl.updated_at
          FROM service_logs sl
          LEFT JOIN clients c ON sl.client_id = c.id
          LEFT JOIN activities a ON sl.activity_id = a.id
          LEFT JOIN patient_entries pe ON sl.id = pe.service_log_id AND (pe.deleted_at IS NULL OR pe.deleted_at = '')
          WHERE (sl.deleted_at IS NULL OR sl.deleted_at = '')
          GROUP BY sl.id, c.name, a.name
        `);
      })();
      
      logger.info('Service log reporting view refreshed successfully');
    } catch (error) {
      logger.error('Failed to refresh service log reporting view', { error });
      throw error;
    }
  }

  // Bulk delete service logs for a user (for testing/cleanup)
  async bulkDeleteByUser(userId: UserId, deleteUserId: UserId): Promise<number> {
    try {
      const logs = await this.findByUser(userId);
      let deleteCount = 0;

      // Can't use transaction with async operations, do them individually
      for (const log of logs.items) {
        this.softDelete(log.id, deleteUserId);
        deleteCount++;
      }

      return deleteCount;
    } catch (error) {
      throw new Error(`Failed to bulk delete service logs for user ${userId}: ${error}`);
    }
  }
}