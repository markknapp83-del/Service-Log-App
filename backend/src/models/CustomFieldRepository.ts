// CustomField Repository following documented healthcare patterns
import { BaseRepository } from './BaseRepository';
import { 
  CustomField, 
  DatabaseCustomField, 
  CustomFieldId, 
  CustomFieldCreateRequest,
  FieldType 
} from '@/types/index';

export class CustomFieldRepository extends BaseRepository<CustomField, DatabaseCustomField, CustomFieldId> {
  constructor() {
    super('custom_fields');
  }

  // Convert database row to domain object
  protected fromDatabase(dbRow: DatabaseCustomField): CustomField {
    return {
      id: dbRow.id,
      fieldLabel: dbRow.field_label,
      fieldType: dbRow.field_type as FieldType,
      fieldOrder: dbRow.field_order,
      isActive: this.convertBooleanFromDb(dbRow.is_active),
      createdAt: dbRow.created_at,
      updatedAt: dbRow.updated_at
    };
  }

  // Convert domain object to database row
  protected toDatabase(domain: Partial<CustomField>): Partial<DatabaseCustomField> {
    const result: Partial<DatabaseCustomField> = {};

    if (domain.id !== undefined) result.id = domain.id;
    if (domain.fieldLabel !== undefined) result.field_label = domain.fieldLabel;
    if (domain.fieldType !== undefined) result.field_type = domain.fieldType;
    if (domain.fieldOrder !== undefined) result.field_order = domain.fieldOrder;
    if (domain.isActive !== undefined) result.is_active = this.convertBooleanToDb(domain.isActive);
    if (domain.createdAt !== undefined) result.created_at = domain.createdAt;
    if (domain.updatedAt !== undefined) result.updated_at = domain.updatedAt;

    return result;
  }

  // Find fields by label (case-insensitive search)
  async findByLabel(label: string): Promise<CustomField[]> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM ${this.tableName}
        WHERE LOWER(field_label) LIKE LOWER(?) 
        AND is_active = 1
        ORDER BY field_order ASC, field_label ASC
      `);

      const rows = await stmt.all(`%${label}%`) as DatabaseCustomField[];
      return rows.map(row => this.fromDatabase(row));
    } catch (error) {
      throw new Error(`Failed to search custom fields by label: ${error}`);
    }
  }

  // Get all active fields ordered by field_order
  async findActiveOrdered(): Promise<CustomField[]> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM ${this.tableName}
        WHERE is_active = 1 
        ORDER BY field_order ASC, field_label ASC
      `);

      const rows = await stmt.all() as DatabaseCustomField[];
      return rows.map(row => this.fromDatabase(row));
    } catch (error) {
      throw new Error(`Failed to find active custom fields: ${error}`);
    }
  }

  // Check if field label already exists
  isLabelTaken(label: string, excludeId?: CustomFieldId): boolean {
    try {
      let query = `
        SELECT COUNT(*) as count FROM ${this.tableName}
        WHERE LOWER(field_label) = LOWER(?) 
      `;
      const params: any[] = [label];

      if (excludeId) {
        query += ' AND id != ?';
        params.push(excludeId);
      }

      const stmt = this.db.prepare(query);
      const result = stmt.get(...params) as { count: number };
      
      return result.count > 0;
    } catch (error) {
      throw new Error(`Failed to check custom field label uniqueness: ${error}`);
    }
  }

  // Create field with label uniqueness validation
  createField(data: CustomFieldCreateRequest, userId: string): CustomField {
    // Validate label uniqueness
    const labelExists = this.isLabelTaken(data.fieldLabel);
    if (labelExists) {
      throw new Error(`Custom field label '${data.fieldLabel}' already exists`);
    }

    // Set field order if not provided
    if (data.fieldOrder === undefined) {
      data.fieldOrder = this.getNextFieldOrder();
    }

    return this.create(data, userId);
  }

  // Update field with label uniqueness validation
  async updateField(id: CustomFieldId, data: Partial<CustomField>, userId: string): Promise<CustomField> {
    // Validate label uniqueness if label is being updated
    if (data.fieldLabel) {
      const labelExists = await this.isLabelTaken(data.fieldLabel, id);
      if (labelExists) {
        throw new Error(`Custom field label '${data.fieldLabel}' already exists`);
      }
    }

    return await this.update(id, data, userId);
  }

  // Toggle field active status
  async toggleActive(id: CustomFieldId, userId: string): Promise<CustomField> {
    const field = await this.findById(id);
    if (!field) {
      throw new Error(`Custom field not found: ${id}`);
    }

    return await this.update(id, { isActive: !field.isActive }, userId);
  }

  // Get next available field order
  getNextFieldOrder(): number {
    try {
      const stmt = this.db.prepare(`
        SELECT COALESCE(MAX(field_order), 0) + 1 as next_order 
        FROM ${this.tableName}
      `);

      const result = stmt.get() as { next_order: number };
      return result.next_order;
    } catch (error) {
      throw new Error(`Failed to get next field order: ${error}`);
    }
  }

  // Update field orders for drag-and-drop reordering
  async updateFieldOrders(fieldOrders: Array<{ id: CustomFieldId; order: number }>, userId: string): Promise<void> {
    try {
      const updateStmt = this.db.prepare(`
        UPDATE ${this.tableName} 
        SET field_order = ?, updated_at = datetime('now')
        WHERE id = ?
      `);

      // Use transaction for atomic updates
      this.db.transaction(() => {
        for (const { id, order } of fieldOrders) {
          updateStmt.run(order, id);
          
          // Log audit entry for each update
          this.logAuditEntry(this.tableName, String(id), 'UPDATE', 
            { field_order: 'previous_order' }, { field_order: order }, userId);
        }
      })();

    } catch (error) {
      throw new Error(`Failed to update field orders: ${error}`);
    }
  }

  // Get fields with usage statistics
  findWithStats(): Array<CustomField & { usageCount: number }> {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          cf.*,
          COUNT(cfv.id) as usage_count
        FROM ${this.tableName} cf
        LEFT JOIN custom_field_values cfv ON cf.id = cfv.field_id
        GROUP BY cf.id
        ORDER BY cf.field_order ASC, cf.field_label ASC
      `);

      const rows = stmt.all() as Array<DatabaseCustomField & { usage_count: number }>;

      return rows.map(row => ({
        ...this.fromDatabase(row),
        usageCount: row.usage_count
      }));
    } catch (error) {
      throw new Error(`Failed to find custom fields with stats: ${error}`);
    }
  }

  // Get fields by type
  async findByType(fieldType: FieldType): Promise<CustomField[]> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM ${this.tableName}
        WHERE field_type = ? 
        AND is_active = 1
        ORDER BY field_order ASC, field_label ASC
      `);

      const rows = await stmt.all(fieldType) as DatabaseCustomField[];
      return rows.map(row => this.fromDatabase(row));
    } catch (error) {
      throw new Error(`Failed to find custom fields by type: ${error}`);
    }
  }
}