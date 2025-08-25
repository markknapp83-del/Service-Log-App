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
      clientId: dbRow.client_id,
      activityId: dbRow.activity_id,
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
    if (domain.clientId !== undefined) result.client_id = domain.clientId;
    if (domain.activityId !== undefined) result.activity_id = domain.activityId;
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

  // Find draft service logs for a user
  async findDraftsByUser(userId: UserId): Promise<ServiceLog[]> {
    try {
      const stmt = await this.db.prepare(`
        SELECT * FROM ${this.tableName}
        WHERE user_id = ? AND is_draft = 1
        AND (deleted_at IS NULL OR deleted_at = '')
        ORDER BY updated_at DESC
      `);

      const rows = await stmt.all(userId) as DatabaseServiceLog[];
      return rows.map(row => this.fromDatabase(row));
    } catch (error) {
      throw new Error(`Failed to find drafts for user ${userId}: ${error}`);
    }
  }

  // Find service logs with filters - optimized for large datasets
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

      // Use indexed date range queries
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

      // Use optimized query with prepared statements, joins for names and patient entry counts
      const stmt = await this.db.prepare(`
        SELECT 
          sl.*,
          c.name as client_name,
          a.name as activity_name,
          u.first_name as user_first_name,
          u.last_name as user_last_name,
          COALESCE(SUM(CASE WHEN pe.appointment_type = 'new' THEN 1 ELSE 0 END), 0) as new_count,
          COALESCE(SUM(CASE WHEN pe.appointment_type = 'followup' THEN 1 ELSE 0 END), 0) as followup_count,
          COALESCE(SUM(CASE WHEN pe.appointment_type = 'dna' THEN 1 ELSE 0 END), 0) as dna_count,
          COUNT(pe.id) as total_appointments
        FROM service_logs sl
        LEFT JOIN clients c ON sl.client_id = c.id
        LEFT JOIN activities a ON sl.activity_id = a.id
        LEFT JOIN users u ON sl.user_id = u.id
        LEFT JOIN patient_entries pe ON sl.id = pe.service_log_id AND (pe.deleted_at IS NULL OR pe.deleted_at = '')
        WHERE ${whereClause}
        GROUP BY sl.id, c.name, a.name, u.first_name, u.last_name
        ORDER BY sl.${orderBy} ${orderDirection}
        LIMIT ? OFFSET ?
      `);

      const countStmt = await this.db.prepare(`
        SELECT COUNT(*) as total FROM service_logs sl
        WHERE ${whereClause}
      `);

      // Execute queries with proper parameter handling
      const rows = await stmt.all(...params, limit, offset) as (DatabaseServiceLog & {
        client_name?: string;
        activity_name?: string;
        user_first_name?: string;
        user_last_name?: string;
        new_count: number;
        followup_count: number;
        dna_count: number;
        total_appointments: number;
      })[];
      const countResult = await countStmt.get(...params) as { total: number };

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
      const total = countResult.total;

      return {
        items,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      };
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

  // Get statistics for service logs - optimized with single query approach
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

      // Single optimized query for basic statistics
      const basicStatsStmt = await this.db.prepare(`
        SELECT 
          COUNT(*) as total_logs,
          SUM(CASE WHEN sl.is_draft = 1 THEN 1 ELSE 0 END) as total_drafts,
          SUM(CASE WHEN sl.is_draft = 0 THEN 1 ELSE 0 END) as total_submitted,
          COALESCE(SUM(sl.patient_count), 0) as total_patients,
          COALESCE(AVG(CAST(sl.patient_count AS FLOAT)), 0) as average_patients_per_log
        FROM service_logs sl
        WHERE ${whereClause}
      `);

      const basicStats = await basicStatsStmt.get(...params) as {
        total_logs: number;
        total_drafts: number;
        total_submitted: number;
        total_patients: number;
        average_patients_per_log: number;
      };

      // Optimized client stats with LIMIT for performance
      const clientStatsStmt = await this.db.prepare(`
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
      `);

      // Optimized activity stats with LIMIT for performance
      const activityStatsStmt = await this.db.prepare(`
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
      `);

      // Execute all queries in parallel for better performance
      const [clientStats, activityStats] = await Promise.all([
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
      ]);

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
    } catch (error) {
      throw new Error(`Failed to get service log statistics: ${error}`);
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