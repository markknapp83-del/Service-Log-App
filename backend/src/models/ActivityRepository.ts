// Activity Repository following documented healthcare patterns
import { BaseRepository } from './BaseRepository';
import { 
  Activity, 
  DatabaseActivity, 
  ActivityId, 
  ActivityCreateRequest,
  ISODateString 
} from '@/types/index';

export class ActivityRepository extends BaseRepository<Activity, DatabaseActivity, ActivityId> {
  constructor() {
    super('activities');
  }

  // Convert database row to domain object
  protected fromDatabase(dbRow: DatabaseActivity): Activity {
    return {
      id: dbRow.id,
      name: dbRow.name,
      isActive: this.convertBooleanFromDb(dbRow.is_active),
      createdAt: dbRow.created_at,
      updatedAt: dbRow.updated_at
    };
  }

  // Convert domain object to database row
  protected toDatabase(domain: Partial<Activity>): Partial<DatabaseActivity> {
    const result: Partial<DatabaseActivity> = {};

    if (domain.id !== undefined) result.id = domain.id;
    if (domain.name !== undefined) result.name = domain.name;
    if (domain.isActive !== undefined) result.is_active = this.convertBooleanToDb(domain.isActive);
    if (domain.createdAt !== undefined) result.created_at = domain.createdAt;
    if (domain.updatedAt !== undefined) result.updated_at = domain.updatedAt;

    return result;
  }

  // Find activities by name (case-insensitive search)
  async findByName(name: string): Promise<Activity[]> {
    try {
      const stmt = await this.db.prepare(`
        SELECT * FROM ${this.tableName}
        WHERE LOWER(name) LIKE LOWER(?) 
        AND (deleted_at IS NULL OR deleted_at = '')
        AND is_active = 1
        ORDER BY name ASC
      `);

      const rows = await stmt.all(`%${name}%`) as DatabaseActivity[];
      return rows.map(row => this.fromDatabase(row));
    } catch (error) {
      throw new Error(`Failed to search activities by name: ${error}`);
    }
  }

  // Get all active activities
  async findActive(): Promise<Activity[]> {
    try {
      const stmt = await this.db.prepare(`
        SELECT * FROM ${this.tableName}
        WHERE is_active = 1 
        AND (deleted_at IS NULL OR deleted_at = '')
        ORDER BY name ASC
      `);

      const rows = await stmt.all() as DatabaseActivity[];
      return rows.map(row => this.fromDatabase(row));
    } catch (error) {
      throw new Error(`Failed to find active activities: ${error}`);
    }
  }

  // Check if activity name already exists
  async isNameTaken(name: string, excludeId?: ActivityId): Promise<boolean> {
    try {
      let query = `
        SELECT COUNT(*) as count FROM ${this.tableName}
        WHERE LOWER(name) = LOWER(?) 
        AND (deleted_at IS NULL OR deleted_at = '')
      `;
      const params: any[] = [name];

      if (excludeId) {
        query += ' AND id != ?';
        params.push(excludeId);
      }

      const stmt = await this.db.prepare(query);
      const result = await stmt.get(...params) as { count: number };
      
      return result.count > 0;
    } catch (error) {
      throw new Error(`Failed to check activity name uniqueness: ${error}`);
    }
  }

  // Create activity with name uniqueness validation
  async createActivity(data: ActivityCreateRequest, userId: string): Promise<Activity> {
    // Validate name uniqueness
    const nameExists = await this.isNameTaken(data.name);
    if (nameExists) {
      throw new Error(`Activity name '${data.name}' already exists`);
    }

    return await this.create(data, userId);
  }

  // Update activity with name uniqueness validation
  async updateActivity(id: ActivityId, data: Partial<Activity>, userId: string): Promise<Activity> {
    // Validate name uniqueness if name is being updated
    if (data.name) {
      const nameExists = await this.isNameTaken(data.name, id);
      if (nameExists) {
        throw new Error(`Activity name '${data.name}' already exists`);
      }
    }

    return await this.update(id, data, userId);
  }

  // Toggle activity active status
  async toggleActive(id: ActivityId, userId: string): Promise<Activity> {
    const activity = await this.findById(id);
    if (!activity) {
      throw new Error(`Activity not found: ${id}`);
    }

    return await this.update(id, { isActive: !activity.isActive }, userId);
  }

  // Get activities with usage statistics
  async findWithStats(): Promise<Array<Activity & { serviceLogCount: number; lastUsed?: ISODateString }>> {
    try {
      const stmt = await this.db.prepare(`
        SELECT 
          a.*,
          COUNT(sl.id) as service_log_count,
          MAX(sl.created_at) as last_used
        FROM ${this.tableName} a
        LEFT JOIN service_logs sl ON a.id = sl.activity_id 
          AND (sl.deleted_at IS NULL OR sl.deleted_at = '')
        WHERE (a.deleted_at IS NULL OR a.deleted_at = '')
        GROUP BY a.id
        ORDER BY a.name ASC
      `);

      const rows = await stmt.all() as Array<DatabaseActivity & { 
        service_log_count: number; 
        last_used: string | null;
      }>;

      return rows.map(row => ({
        ...this.fromDatabase(row),
        serviceLogCount: row.service_log_count,
        lastUsed: row.last_used || undefined
      }));
    } catch (error) {
      throw new Error(`Failed to find activities with stats: ${error}`);
    }
  }

  // Bulk create activities
  async bulkCreateActivities(activities: ActivityCreateRequest[], userId: string): Promise<Activity[]> {
    // Validate all names are unique
    const names = activities.map(a => a.name.toLowerCase());
    const uniqueNames = new Set(names);
    
    if (names.length !== uniqueNames.size) {
      throw new Error('Duplicate activity names in bulk create request');
    }

    // Check against existing activities
    for (const activity of activities) {
      const nameExists = await this.isNameTaken(activity.name);
      if (nameExists) {
        throw new Error(`Activity name '${activity.name}' already exists`);
      }
    }

    return await this.bulkCreate(activities, userId);
  }
}