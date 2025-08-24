// Outcome Repository following documented healthcare patterns
import { BaseRepository } from './BaseRepository';
import { 
  Outcome, 
  DatabaseOutcome, 
  OutcomeId, 
  OutcomeCreateRequest,
  ISODateString 
} from '@/types/index';

export class OutcomeRepository extends BaseRepository<Outcome, DatabaseOutcome, OutcomeId> {
  constructor() {
    super('outcomes');
  }

  // Convert database row to domain object
  protected fromDatabase(dbRow: DatabaseOutcome): Outcome {
    return {
      id: dbRow.id,
      name: dbRow.name,
      isActive: this.convertBooleanFromDb(dbRow.is_active),
      createdAt: dbRow.created_at,
      updatedAt: dbRow.updated_at
    };
  }

  // Convert domain object to database row
  protected toDatabase(domain: Partial<Outcome>): Partial<DatabaseOutcome> {
    const result: Partial<DatabaseOutcome> = {};

    if (domain.id !== undefined) result.id = domain.id;
    if (domain.name !== undefined) result.name = domain.name;
    if (domain.isActive !== undefined) result.is_active = this.convertBooleanToDb(domain.isActive);
    if (domain.createdAt !== undefined) result.created_at = domain.createdAt;
    if (domain.updatedAt !== undefined) result.updated_at = domain.updatedAt;

    return result;
  }

  // Find outcomes by name (case-insensitive search)
  async findByName(name: string): Promise<Outcome[]> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM ${this.tableName}
        WHERE LOWER(name) LIKE LOWER(?) 
        AND is_active = 1
        ORDER BY name ASC
      `);

      const rows = stmt.all(`%${name}%`) as DatabaseOutcome[];
      return rows.map(row => this.fromDatabase(row));
    } catch (error) {
      throw new Error(`Failed to search outcomes by name: ${error}`);
    }
  }

  // Get all active outcomes
  async findActive(): Promise<Outcome[]> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM ${this.tableName}
        WHERE is_active = 1 
        ORDER BY name ASC
      `);

      const rows = stmt.all() as DatabaseOutcome[];
      return rows.map(row => this.fromDatabase(row));
    } catch (error) {
      throw new Error(`Failed to find active outcomes: ${error}`);
    }
  }

  // Check if outcome name already exists
  isNameTaken(name: string, excludeId?: OutcomeId): boolean {
    try {
      let query = `
        SELECT COUNT(*) as count FROM ${this.tableName}
        WHERE LOWER(name) = LOWER(?) 
      `;
      const params: any[] = [name];

      if (excludeId) {
        query += ' AND id != ?';
        params.push(excludeId);
      }

      const stmt = this.db.prepare(query);
      const result = stmt.get(...params) as { count: number };
      
      return result.count > 0;
    } catch (error) {
      throw new Error(`Failed to check outcome name uniqueness: ${error}`);
    }
  }

  // Create outcome with name uniqueness validation
  createOutcome(data: OutcomeCreateRequest, userId: string): Outcome {
    // Validate name uniqueness
    const nameExists = this.isNameTaken(data.name);
    if (nameExists) {
      throw new Error(`Outcome name '${data.name}' already exists`);
    }

    return this.create(data, userId);
  }

  // Update outcome with name uniqueness validation
  updateOutcome(id: OutcomeId, data: Partial<Outcome>, userId: string): Outcome {
    // Validate name uniqueness if name is being updated
    if (data.name) {
      const nameExists = this.isNameTaken(data.name, id);
      if (nameExists) {
        throw new Error(`Outcome name '${data.name}' already exists`);
      }
    }

    return this.update(id, data, userId);
  }

  // Toggle outcome active status
  toggleActive(id: OutcomeId, userId: string): Outcome {
    const outcome = this.findById(id);
    if (!outcome) {
      throw new Error(`Outcome not found: ${id}`);
    }

    return this.update(id, { isActive: !outcome.isActive }, userId);
  }

  // Get outcomes with usage statistics
  findWithStats(): Array<Outcome & { usageCount: number; lastUsed?: ISODateString }> {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          o.*,
          COUNT(pe.id) as usage_count,
          MAX(pe.created_at) as last_used
        FROM ${this.tableName} o
        LEFT JOIN patient_entries pe ON o.id = pe.outcome_id
        GROUP BY o.id
        ORDER BY o.name ASC
      `);

      const rows = stmt.all() as Array<DatabaseOutcome & { 
        usage_count: number; 
        last_used: string | null;
      }>;

      return rows.map(row => ({
        ...this.fromDatabase(row),
        usageCount: row.usage_count,
        lastUsed: row.last_used || undefined
      }));
    } catch (error) {
      throw new Error(`Failed to find outcomes with stats: ${error}`);
    }
  }

  // Bulk create outcomes
  async bulkCreateOutcomes(outcomes: OutcomeCreateRequest[], userId: string): Promise<Outcome[]> {
    // Validate all names are unique
    const names = outcomes.map(o => o.name.toLowerCase());
    const uniqueNames = new Set(names);
    
    if (names.length !== uniqueNames.size) {
      throw new Error('Duplicate outcome names in bulk create request');
    }

    // Check against existing outcomes
    for (const outcome of outcomes) {
      const nameExists = this.isNameTaken(outcome.name);
      if (nameExists) {
        throw new Error(`Outcome name '${outcome.name}' already exists`);
      }
    }

    return this.bulkCreate(outcomes, userId);
  }
}