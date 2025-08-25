// Patient Entry Repository following documented healthcare patterns
import { BaseRepository } from './BaseRepository';
import { 
  PatientEntry, 
  DatabasePatientEntry, 
  PatientEntryId, 
  ServiceLogId,
  OutcomeId,
  UserId,
  PaginatedResult,
  PaginationOptions,
  AppointmentType
} from '@/types/index';

export class PatientEntryRepository extends BaseRepository<PatientEntry, DatabasePatientEntry, PatientEntryId> {
  constructor() {
    super('patient_entries');
  }

  // Convert database row to domain object
  protected fromDatabase(dbRow: DatabasePatientEntry): PatientEntry {
    return {
      id: dbRow.id,
      serviceLogId: dbRow.service_log_id,
      appointmentType: dbRow.appointment_type as AppointmentType,
      outcomeId: String(dbRow.outcome_id), // Convert number to string for frontend consistency
      createdAt: dbRow.created_at,
      updatedAt: dbRow.updated_at
    };
  }

  // Convert domain object to database row
  protected toDatabase(domain: Partial<PatientEntry>): Partial<DatabasePatientEntry> {
    const result: Partial<DatabasePatientEntry> = {};

    if (domain.id !== undefined) result.id = domain.id;
    if (domain.serviceLogId !== undefined) result.service_log_id = domain.serviceLogId;
    if (domain.appointmentType !== undefined) result.appointment_type = domain.appointmentType;
    if (domain.outcomeId !== undefined) result.outcome_id = Number(domain.outcomeId); // Convert string back to number for database
    if (domain.createdAt !== undefined) result.created_at = domain.createdAt;
    if (domain.updatedAt !== undefined) result.updated_at = domain.updatedAt;

    return result;
  }

  // Find patient entries by service log
  async findByServiceLog(
    serviceLogId: ServiceLogId,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<PatientEntry>> {
    return await this.findAll({
      ...options,
      where: 'service_log_id = ?',
      params: [serviceLogId],
      orderBy: 'created_at',
      order: 'ASC'
    });
  }

  // Find patient entries by service log ID (simple array result)
  async findByServiceLogId(serviceLogId: ServiceLogId): Promise<PatientEntry[]> {
    try {
      const stmt = await this.db.prepare(`
        SELECT * FROM ${this.tableName}
        WHERE service_log_id = ?
        AND (deleted_at IS NULL OR deleted_at = '')
        ORDER BY created_at ASC
      `);

      const rows = await stmt.all(serviceLogId) as DatabasePatientEntry[];
      return rows.map(row => this.fromDatabase(row));
    } catch (error) {
      throw new Error(`Failed to find patient entries by service log ID: ${error}`);
    }
  }

  // Batch find patient entries by multiple service log IDs - optimized for exports
  async findByServiceLogIds(serviceLogIds: ServiceLogId[]): Promise<PatientEntry[]> {
    if (serviceLogIds.length === 0) {
      return [];
    }

    try {
      // Create placeholders for IN clause
      const placeholders = serviceLogIds.map(() => '?').join(', ');
      
      const stmt = await this.db.prepare(`
        SELECT * FROM ${this.tableName}
        WHERE service_log_id IN (${placeholders})
        AND (deleted_at IS NULL OR deleted_at = '')
        ORDER BY service_log_id, created_at ASC
      `);

      const rows = await stmt.all(...serviceLogIds) as DatabasePatientEntry[];
      return rows.map(row => this.fromDatabase(row));
    } catch (error) {
      throw new Error(`Failed to find patient entries by service log IDs: ${error}`);
    }
  }

  // Find patient entries by outcome
  async findByOutcome(
    outcomeId: OutcomeId,
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<PatientEntry>> {
    return await this.findAll({
      ...options,
      where: 'outcome_id = ?',
      params: [outcomeId]
    });
  }

  // Get patient entries with outcome details
  async findByServiceLogWithOutcomes(serviceLogId: ServiceLogId): Promise<Array<PatientEntry & {
    outcome?: { id: OutcomeId; name: string; isActive: boolean };
  }>> {
    try {
      const stmt = await this.db.prepare(`
        SELECT 
          pe.*,
          o.id as outcome_id_full,
          o.name as outcome_name,
          o.is_active as outcome_is_active
        FROM ${this.tableName} pe
        LEFT JOIN outcomes o ON pe.outcome_id = o.id
        WHERE pe.service_log_id = ?
        AND (pe.deleted_at IS NULL OR pe.deleted_at = '')
        ORDER BY pe.created_at ASC
      `);

      const rows = await stmt.all(serviceLogId) as Array<DatabasePatientEntry & {
        outcome_id_full?: number;
        outcome_name?: string;
        outcome_is_active?: number;
      }>;

      return rows.map(row => ({
        ...this.fromDatabase(row),
        outcome: row.outcome_name ? {
          id: row.outcome_id_full!,
          name: row.outcome_name,
          isActive: this.convertBooleanFromDb(row.outcome_is_active || 0)
        } : undefined
      }));
    } catch (error) {
      throw new Error(`Failed to find patient entries with outcomes: ${error}`);
    }
  }

  // Get patient statistics for a service log
  async getServiceLogStats(serviceLogId: ServiceLogId): Promise<{
    totalEntries: number;
    totalNewPatients: number;
    totalFollowupPatients: number;
    totalDnaCount: number;
    totalPatients: number;
    outcomeBreakdown: Array<{ outcomeId?: OutcomeId; outcomeName?: string; count: number }>;
  }> {
    try {
      // Get basic stats
      const basicStatsStmt = await this.db.prepare(`
        SELECT 
          COUNT(*) as total_entries,
          SUM(new_patients) as total_new_patients,
          SUM(followup_patients) as total_followup_patients,
          SUM(dna_count) as total_dna_count,
          SUM(new_patients + followup_patients) as total_patients
        FROM ${this.tableName}
        WHERE service_log_id = ?
        AND (deleted_at IS NULL OR deleted_at = '')
      `);

      const basicStats = await basicStatsStmt.get(serviceLogId) as {
        total_entries: number;
        total_new_patients: number;
        total_followup_patients: number;
        total_dna_count: number;
        total_patients: number;
      };

      // Get outcome breakdown
      const outcomeStatsStmt = await this.db.prepare(`
        SELECT 
          pe.outcome_id,
          o.name as outcome_name,
          COUNT(*) as count
        FROM ${this.tableName} pe
        LEFT JOIN outcomes o ON pe.outcome_id = o.id
        WHERE pe.service_log_id = ?
        AND (pe.deleted_at IS NULL OR pe.deleted_at = '')
        GROUP BY pe.outcome_id, o.name
        ORDER BY count DESC
      `);

      const outcomeStats = await outcomeStatsStmt.all(serviceLogId) as Array<{
        outcome_id: number | null;
        outcome_name: string | null;
        count: number;
      }>;

      return {
        totalEntries: basicStats.total_entries,
        totalNewPatients: basicStats.total_new_patients,
        totalFollowupPatients: basicStats.total_followup_patients,
        totalDnaCount: basicStats.total_dna_count,
        totalPatients: basicStats.total_patients,
        outcomeBreakdown: outcomeStats.map(stat => ({
          outcomeId: stat.outcome_id || undefined,
          outcomeName: stat.outcome_name || 'No Outcome',
          count: stat.count
        }))
      };
    } catch (error) {
      throw new Error(`Failed to get service log stats: ${error}`);
    }
  }

  // Bulk create patient entries for a service log
  async bulkCreateForServiceLog(
    serviceLogId: ServiceLogId,
    entries: Array<Omit<PatientEntry, 'id' | 'serviceLogId' | 'createdAt' | 'updatedAt'>>,
    userId: UserId
  ): Promise<PatientEntry[]> {
    try {
      const entriesToCreate = entries.map(entry => ({
        ...entry,
        serviceLogId
      }));

      return await this.bulkCreate(entriesToCreate, userId);
    } catch (error) {
      throw new Error(`Failed to bulk create patient entries: ${error}`);
    }
  }

  // Delete all patient entries for a service log - optimized batch delete
  async deleteByServiceLog(serviceLogId: ServiceLogId, userId: UserId): Promise<number> {
    try {
      const now = new Date().toISOString();
      
      // Use single batch update for better performance
      const stmt = await this.db.prepare(`
        UPDATE ${this.tableName}
        SET deleted_at = ?, updated_at = ?
        WHERE service_log_id = ?
        AND (deleted_at IS NULL OR deleted_at = '')
      `);

      const result = await this.db.transaction(async () => {
        const updateResult = await stmt.run(now, now, serviceLogId);
        
        // Log audit entry for bulk delete
        await this.logAudit(serviceLogId, 'DELETE', 
          { serviceLogId }, 
          { serviceLogId, deletedAt: now, deletedCount: updateResult.changes }, 
          userId
        );
        
        return updateResult.changes || 0;
      })();

      return result;
    } catch (error) {
      throw new Error(`Failed to delete patient entries for service log: ${error}`);
    }
  }

  // Optimized delete by service log ID with userId handling
  async deleteByServiceLogId(serviceLogId: ServiceLogId): Promise<number> {
    try {
      const now = new Date().toISOString();
      
      const stmt = await this.db.prepare(`
        UPDATE ${this.tableName}
        SET deleted_at = ?, updated_at = ?
        WHERE service_log_id = ?
        AND (deleted_at IS NULL OR deleted_at = '')
      `);

      const result = await stmt.run(now, now, serviceLogId);
      return result.changes || 0;
    } catch (error) {
      throw new Error(`Failed to delete patient entries by service log ID: ${error}`);
    }
  }

  // Update patient entry with validation
  async updatePatientEntry(
    id: PatientEntryId,
    data: Partial<PatientEntry>,
    userId: UserId
  ): Promise<PatientEntry> {
    // Validate patient counts are non-negative
    if (data.newPatients !== undefined && data.newPatients < 0) {
      throw new Error('New patients count cannot be negative');
    }

    if (data.followupPatients !== undefined && data.followupPatients < 0) {
      throw new Error('Followup patients count cannot be negative');
    }

    if (data.dnaCount !== undefined && data.dnaCount < 0) {
      throw new Error('DNA count cannot be negative');
    }

    return await this.update(id, data, userId);
  }

  // Get patient entries with custom field values
  async findByServiceLogWithCustomFields(serviceLogId: ServiceLogId): Promise<Array<PatientEntry & {
    customFieldValues?: Array<{
      fieldId: number;
      fieldLabel: string;
      choiceId?: number;
      choiceText?: string;
      textValue?: string;
      numberValue?: number;
      checkboxValue?: boolean;
    }>;
  }>> {
    try {
      // First get the patient entries
      const entries = await this.findByServiceLogWithOutcomes(serviceLogId);

      // Then get custom field values for each entry
      const entriesWithCustomFields = await Promise.all(
        entries.map(async (entry) => {
          const customFieldStmt = await this.db.prepare(`
            SELECT 
              cfv.*,
              cf.field_label,
              fc.choice_text
            FROM custom_field_values cfv
            JOIN custom_fields cf ON cfv.field_id = cf.id
            LEFT JOIN field_choices fc ON cfv.choice_id = fc.id
            WHERE cfv.patient_entry_id = ?
            ORDER BY cf.field_order ASC
          `);

          const customFields = await customFieldStmt.all(entry.id) as Array<{
            id: string;
            field_id: number;
            field_label: string;
            choice_id: number | null;
            choice_text: string | null;
            text_value: string | null;
            number_value: number | null;
            checkbox_value: number | null;
          }>;

          return {
            ...entry,
            customFieldValues: customFields.map(cf => ({
              fieldId: cf.field_id,
              fieldLabel: cf.field_label,
              choiceId: cf.choice_id || undefined,
              choiceText: cf.choice_text || undefined,
              textValue: cf.text_value || undefined,
              numberValue: cf.number_value || undefined,
              checkboxValue: cf.checkbox_value ? this.convertBooleanFromDb(cf.checkbox_value) : undefined
            }))
          };
        })
      );

      return entriesWithCustomFields;
    } catch (error) {
      throw new Error(`Failed to find patient entries with custom fields: ${error}`);
    }
  }

  // Validate patient entry data
  private validatePatientEntry(data: Partial<PatientEntry>): void {
    if (data.newPatients !== undefined && data.newPatients < 0) {
      throw new Error('New patients count cannot be negative');
    }

    if (data.followupPatients !== undefined && data.followupPatients < 0) {
      throw new Error('Followup patients count cannot be negative');
    }

    if (data.dnaCount !== undefined && data.dnaCount < 0) {
      throw new Error('DNA count cannot be negative');
    }

    // Validate that at least one patient type is specified
    const totalPatients = (data.newPatients || 0) + (data.followupPatients || 0);
    if (totalPatients === 0 && data.dnaCount === 0) {
      throw new Error('At least one patient count must be greater than zero');
    }
  }

  // Override create to add validation
  async create(
    data: Omit<PatientEntry, 'id' | 'createdAt' | 'updatedAt'>,
    userId: UserId
  ): Promise<PatientEntry> {
    this.validatePatientEntry(data);
    return await super.create(data, userId);
  }

  // Override update to add validation
  async update(
    id: PatientEntryId,
    data: Partial<PatientEntry>,
    userId: UserId
  ): Promise<PatientEntry> {
    this.validatePatientEntry(data);
    return await super.update(id, data, userId);
  }
}