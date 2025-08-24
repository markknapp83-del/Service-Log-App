// FieldChoice Repository following documented healthcare patterns
import { BaseRepository } from './BaseRepository';
import { 
  FieldChoice, 
  DatabaseFieldChoice, 
  FieldChoiceId,
  CustomFieldId
} from '@/types/index';

export class FieldChoiceRepository extends BaseRepository<FieldChoice, DatabaseFieldChoice, FieldChoiceId> {
  constructor() {
    super('field_choices');
  }

  // Convert database row to domain object
  protected fromDatabase(dbRow: DatabaseFieldChoice): FieldChoice {
    return {
      id: dbRow.id,
      fieldId: dbRow.field_id,
      choiceText: dbRow.choice_text,
      choiceOrder: dbRow.choice_order,
      createdAt: dbRow.created_at
    };
  }

  // Convert domain object to database row
  protected toDatabase(domain: Partial<FieldChoice>): Partial<DatabaseFieldChoice> {
    const result: Partial<DatabaseFieldChoice> = {};

    if (domain.id !== undefined) result.id = domain.id;
    if (domain.fieldId !== undefined) result.field_id = domain.fieldId;
    if (domain.choiceText !== undefined) result.choice_text = domain.choiceText;
    if (domain.choiceOrder !== undefined) result.choice_order = domain.choiceOrder;
    if (domain.createdAt !== undefined) result.created_at = domain.createdAt;

    return result;
  }

  // Get choices for a specific field, ordered by choice_order
  async findByFieldId(fieldId: CustomFieldId): Promise<FieldChoice[]> {
    try {
      const stmt = await this.db.prepare(`
        SELECT * FROM ${this.tableName}
        WHERE field_id = ?
        ORDER BY choice_order ASC, choice_text ASC
      `);

      const rows = await stmt.all(fieldId) as DatabaseFieldChoice[];
      return rows.map(row => this.fromDatabase(row));
    } catch (error) {
      throw new Error(`Failed to find field choices for field ${fieldId}: ${error}`);
    }
  }

  // Check if choice text already exists for a field
  async isChoiceTextTaken(fieldId: CustomFieldId, choiceText: string, excludeId?: FieldChoiceId): Promise<boolean> {
    try {
      let query = `
        SELECT COUNT(*) as count FROM ${this.tableName}
        WHERE field_id = ? AND LOWER(choice_text) = LOWER(?)
      `;
      const params: any[] = [fieldId, choiceText];

      if (excludeId) {
        query += ' AND id != ?';
        params.push(excludeId);
      }

      const stmt = await this.db.prepare(query);
      const result = await stmt.get(...params) as { count: number };
      
      return result.count > 0;
    } catch (error) {
      throw new Error(`Failed to check choice text uniqueness: ${error}`);
    }
  }

  // Create choice with uniqueness validation within field
  async createChoice(fieldId: CustomFieldId, choiceText: string, choiceOrder?: number): Promise<FieldChoice> {
    // Validate choice text uniqueness within the field
    const choiceExists = await this.isChoiceTextTaken(fieldId, choiceText);
    if (choiceExists) {
      throw new Error(`Choice text '${choiceText}' already exists for this field`);
    }

    // Set choice order if not provided
    if (choiceOrder === undefined) {
      choiceOrder = await this.getNextChoiceOrder(fieldId);
    }

    const choiceData = {
      fieldId,
      choiceText,
      choiceOrder
    };

    return await this.create(choiceData, 'system'); // Field choices don't track user changes in base schema
  }

  // Update choice with uniqueness validation
  async updateChoice(id: FieldChoiceId, choiceText: string): Promise<FieldChoice> {
    const existingChoice = await this.findById(id);
    if (!existingChoice) {
      throw new Error(`Choice not found: ${id}`);
    }

    // Validate choice text uniqueness within the field
    const choiceExists = await this.isChoiceTextTaken(existingChoice.fieldId, choiceText, id);
    if (choiceExists) {
      throw new Error(`Choice text '${choiceText}' already exists for this field`);
    }

    return await this.update(id, { choiceText }, 'system');
  }

  // Get next available choice order for a field
  async getNextChoiceOrder(fieldId: CustomFieldId): Promise<number> {
    try {
      const stmt = await this.db.prepare(`
        SELECT COALESCE(MAX(choice_order), 0) + 1 as next_order 
        FROM ${this.tableName}
        WHERE field_id = ?
      `);

      const result = await stmt.get(fieldId) as { next_order: number };
      return result.next_order;
    } catch (error) {
      throw new Error(`Failed to get next choice order: ${error}`);
    }
  }

  // Update choice orders for drag-and-drop reordering within a field
  async updateChoiceOrders(fieldId: CustomFieldId, choiceOrders: Array<{ id: FieldChoiceId; order: number }>): Promise<void> {
    try {
      const updateStmt = this.db.prepare(`
        UPDATE ${this.tableName} 
        SET choice_order = ?
        WHERE id = ? AND field_id = ?
      `);

      // Use transaction for atomic updates
      this.db.transaction(() => {
        for (const { id, order } of choiceOrders) {
          updateStmt.run(order, id, fieldId);
        }
      })();

    } catch (error) {
      throw new Error(`Failed to update choice orders: ${error}`);
    }
  }

  // Bulk create choices for a field
  async bulkCreateChoices(fieldId: CustomFieldId, choices: Array<{ text: string; order: number }>): Promise<FieldChoice[]> {
    // Validate all choice texts are unique within the field
    const choiceTexts = choices.map(c => c.text.toLowerCase());
    const uniqueTexts = new Set(choiceTexts);
    
    if (choiceTexts.length !== uniqueTexts.size) {
      throw new Error('Duplicate choice texts in bulk create request');
    }

    // Check against existing choices
    for (const choice of choices) {
      const choiceExists = await this.isChoiceTextTaken(fieldId, choice.text);
      if (choiceExists) {
        throw new Error(`Choice text '${choice.text}' already exists for this field`);
      }
    }

    // Create all choices
    const createdChoices: FieldChoice[] = [];
    for (const choice of choices) {
      const choiceData = {
        fieldId,
        choiceText: choice.text,
        choiceOrder: choice.order
      };
      const created = await this.create(choiceData, 'system');
      createdChoices.push(created);
    }

    return createdChoices;
  }

  // Delete all choices for a field (used when field is deleted)
  async deleteByFieldId(fieldId: CustomFieldId): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        DELETE FROM ${this.tableName}
        WHERE field_id = ?
      `);
      
      stmt.run(fieldId);
    } catch (error) {
      throw new Error(`Failed to delete choices for field ${fieldId}: ${error}`);
    }
  }

  // Get choices with usage statistics
  async findWithStats(fieldId: CustomFieldId): Promise<Array<FieldChoice & { usageCount: number }>> {
    try {
      const stmt = await this.db.prepare(`
        SELECT 
          fc.*,
          COUNT(cfv.id) as usage_count
        FROM ${this.tableName} fc
        LEFT JOIN custom_field_values cfv ON fc.id = cfv.choice_id 
        WHERE fc.field_id = ?
        GROUP BY fc.id
        ORDER BY fc.choice_order ASC, fc.choice_text ASC
      `);

      const rows = await stmt.all(fieldId) as Array<DatabaseFieldChoice & { usage_count: number }>;

      return rows.map(row => ({
        ...this.fromDatabase(row),
        usageCount: row.usage_count
      }));
    } catch (error) {
      throw new Error(`Failed to find field choices with stats: ${error}`);
    }
  }
}