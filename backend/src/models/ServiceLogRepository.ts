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
    if (domain.patientCount !== undefined) result.patient_count = domain.patientCount;
    if (domain.isDraft !== undefined) result.is_draft = this.convertBooleanToDb(domain.isDraft);
    if (domain.submittedAt !== undefined) result.submitted_at = this.convertDateToDb(domain.submittedAt);
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

  // Find service logs with filters
  async findWithFilters(
    filters: ServiceLogFilters,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<ServiceLog>> {
    const whereClauses: string[] = [];
    const params: any[] = [];

    if (filters.userId) {
      whereClauses.push('user_id = ?');
      params.push(filters.userId);
    }

    if (filters.clientId) {
      whereClauses.push('client_id = ?');
      params.push(filters.clientId);
    }

    if (filters.activityId) {
      whereClauses.push('activity_id = ?');
      params.push(filters.activityId);
    }

    if (filters.isDraft !== undefined) {
      whereClauses.push('is_draft = ?');
      params.push(this.convertBooleanToDb(filters.isDraft));
    }

    if (filters.startDate) {
      whereClauses.push('created_at >= ?');
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      whereClauses.push('created_at <= ?');
      params.push(filters.endDate);
    }

    const whereClause = whereClauses.length > 0 ? whereClauses.join(' AND ') : '';

    return await this.findAll({
      ...options,
      where: whereClause,
      params
    });
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
      submittedAt: undefined
    }, userId);
  }

  // Get statistics for service logs
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
      // Build WHERE clause for filters
      const whereClauses: string[] = ['(sl.deleted_at IS NULL OR sl.deleted_at = \'\')'];
      const params: any[] = [];

      if (filters?.userId) {
        whereClauses.push('sl.user_id = ?');
        params.push(filters.userId);
      }

      if (filters?.startDate) {
        whereClauses.push('sl.created_at >= ?');
        params.push(filters.startDate);
      }

      if (filters?.endDate) {
        whereClauses.push('sl.created_at <= ?');
        params.push(filters.endDate);
      }

      const whereClause = whereClauses.join(' AND ');

      // Get basic statistics
      const basicStatsStmt = await this.db.prepare(`
        SELECT 
          COUNT(*) as total_logs,
          SUM(CASE WHEN is_draft = 1 THEN 1 ELSE 0 END) as total_drafts,
          SUM(CASE WHEN is_draft = 0 THEN 1 ELSE 0 END) as total_submitted,
          SUM(patient_count) as total_patients,
          AVG(patient_count) as average_patients_per_log
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

      // Get logs by client
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
      `);

      const clientStats = await clientStatsStmt.all(...params) as Array<{
        client_id: number;
        client_name: string;
        count: number;
      }>;

      // Get logs by activity
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
      `);

      const activityStats = await activityStatsStmt.all(...params) as Array<{
        activity_id: number;
        activity_name: string;
        count: number;
      }>;

      return {
        totalLogs: basicStats.total_logs,
        totalDrafts: basicStats.total_drafts,
        totalSubmitted: basicStats.total_submitted,
        totalPatients: basicStats.total_patients,
        averagePatientsPerLog: Math.round(basicStats.average_patients_per_log * 100) / 100,
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

      await this.db.transaction(async () => {
        for (const log of logs.items) {
          await this.softDelete(log.id, deleteUserId);
          deleteCount++;
        }
      })();

      return deleteCount;
    } catch (error) {
      throw new Error(`Failed to bulk delete service logs for user ${userId}: ${error}`);
    }
  }
}