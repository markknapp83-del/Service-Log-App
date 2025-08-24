// Base Repository following SQLite documentation patterns
import { db } from '@/database/connection';
import { logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseUser, AuditLogEntry, ISODateString, UserId } from '@/types/index';

export abstract class BaseRepository<TDomain, TDatabase, TKey = string> {
  protected tableName: string;
  protected db = db;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  // Abstract methods to be implemented by concrete repositories
  protected abstract fromDatabase(dbRow: TDatabase): TDomain;
  protected abstract toDatabase(domain: Partial<TDomain>): Partial<TDatabase>;

  // Generic find by ID with soft delete support
  async findById(id: TKey): Promise<TDomain | null> {
    try {
      const stmt = await this.db.prepare(`
        SELECT * FROM ${this.tableName} 
        WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')
      `);
      
      const row = await stmt.get(id) as TDatabase | undefined;
      
      if (!row) {
        return null;
      }

      return this.fromDatabase(row);
    } catch (error) {
      logger.error(`Failed to find ${this.tableName} by ID`, { id, error });
      throw error;
    }
  }

  // Generic find all with pagination and filtering
  async findAll(options: {
    page?: number;
    limit?: number;
    orderBy?: string;
    order?: 'ASC' | 'DESC';
    where?: string;
    params?: any[];
  } = {}): Promise<{
    items: TDomain[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const { 
        page = 1, 
        limit = 20, 
        orderBy = 'created_at', 
        order = 'DESC',
        where = '',
        params = []
      } = options;
      
      const offset = (page - 1) * limit;

      // Build WHERE clause
      let whereClause = `(deleted_at IS NULL OR deleted_at = '')`;
      if (where) {
        whereClause += ` AND (${where})`;
      }

      // Get items
      const stmt = await this.db.prepare(`
        SELECT * FROM ${this.tableName}
        WHERE ${whereClause}
        ORDER BY ${orderBy} ${order}
        LIMIT ? OFFSET ?
      `);

      const rows = await stmt.all(...params, limit, offset) as TDatabase[];
      const items = rows.map(row => this.fromDatabase(row));

      // Get total count
      const countStmt = await this.db.prepare(`
        SELECT COUNT(*) as total FROM ${this.tableName} 
        WHERE ${whereClause}
      `);

      const countResult = await countStmt.get(...params) as { total: number };
      const total = countResult.total;

      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error(`Failed to find all ${this.tableName}`, { options, error });
      throw error;
    }
  }

  // Generic create with audit logging
  async create(data: Omit<TDomain, 'id' | 'createdAt' | 'updatedAt'>, userId: UserId): Promise<TDomain> {
    try {
      const id = typeof data === 'object' && 'id' in data ? (data as any).id : uuidv4();
      const now = new Date().toISOString();
      
      const dbData = this.toDatabase({
        ...data as any,
        id,
        createdAt: now,
        updatedAt: now
      });

      const columns = Object.keys(dbData);
      const placeholders = columns.map(() => '?').join(', ');
      const values = Object.values(dbData);

      const stmt = await this.db.prepare(`
        INSERT INTO ${this.tableName} (${columns.join(', ')})
        VALUES (${placeholders})
      `);

      await this.db.transaction(async () => {
        await stmt.run(...values);
        
        // Log to audit table
        await this.logAudit(id, 'INSERT', null, { id, ...data }, userId);
      })();
      
      const created = await this.findById(id as TKey);
      if (!created) {
        throw new Error('Failed to retrieve created record');
      }

      logger.info(`${this.tableName} created`, { id, userId });
      return created;
    } catch (error) {
      logger.error(`Failed to create ${this.tableName}`, { data, userId, error });
      throw error;
    }
  }

  // Generic update with audit logging
  async update(id: TKey, data: Partial<TDomain>, userId: UserId): Promise<TDomain> {
    try {
      const oldRecord = await this.findById(id);
      if (!oldRecord) {
        throw new Error(`${this.tableName} not found: ${id}`);
      }

      const now = new Date().toISOString();
      const dbData = this.toDatabase({
        ...data as any,
        updatedAt: now
      });

      // Remove undefined values and id
      const updateData = Object.entries(dbData)
        .filter(([key, value]) => key !== 'id' && value !== undefined)
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

      if (Object.keys(updateData).length === 0) {
        return oldRecord; // Nothing to update
      }

      const columns = Object.keys(updateData);
      const setClause = columns.map(col => `${col} = ?`).join(', ');
      const values = Object.values(updateData);

      const stmt = await this.db.prepare(`
        UPDATE ${this.tableName} 
        SET ${setClause}
        WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')
      `);

      await this.db.transaction(async () => {
        const result = await stmt.run(...values, id);
        
        if (result.changes === 0) {
          throw new Error(`Failed to update ${this.tableName}: ${id}`);
        }
        
        // Log to audit table
        await this.logAudit(id, 'UPDATE', oldRecord, { ...oldRecord, ...data }, userId);
      })();

      const updated = await this.findById(id);
      if (!updated) {
        throw new Error('Failed to retrieve updated record');
      }

      logger.info(`${this.tableName} updated`, { id, userId });
      return updated;
    } catch (error) {
      logger.error(`Failed to update ${this.tableName}`, { id, data, userId, error });
      throw error;
    }
  }

  // Soft delete with audit logging
  async softDelete(id: TKey, userId: UserId): Promise<boolean> {
    try {
      const oldRecord = await this.findById(id);
      if (!oldRecord) {
        throw new Error(`${this.tableName} not found: ${id}`);
      }

      const now = new Date().toISOString();
      const stmt = await this.db.prepare(`
        UPDATE ${this.tableName} 
        SET deleted_at = ?, updated_at = ?
        WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')
      `);

      await this.db.transaction(async () => {
        const result = await stmt.run(now, now, id);
        
        if (result.changes === 0) {
          throw new Error(`Failed to delete ${this.tableName}: ${id}`);
        }
        
        // Log to audit table
        await this.logAudit(id, 'DELETE', oldRecord, { ...oldRecord, deletedAt: now }, userId);
      })();

      logger.info(`${this.tableName} soft deleted`, { id, userId });
      return true;
    } catch (error) {
      logger.error(`Failed to soft delete ${this.tableName}`, { id, userId, error });
      throw error;
    }
  }

  // Hard delete (use sparingly)
  async hardDelete(id: TKey, userId: UserId): Promise<boolean> {
    try {
      const oldRecord = await this.findById(id);
      if (!oldRecord) {
        return false; // Already deleted
      }

      const stmt = await this.db.prepare(`
        DELETE FROM ${this.tableName} WHERE id = ?
      `);

      await this.db.transaction(async () => {
        const result = await stmt.run(id);
        
        if (result.changes === 0) {
          throw new Error(`Failed to hard delete ${this.tableName}: ${id}`);
        }
        
        // Log to audit table
        await this.logAudit(id, 'DELETE', oldRecord, null, userId);
      })();

      logger.info(`${this.tableName} hard deleted`, { id, userId });
      return true;
    } catch (error) {
      logger.error(`Failed to hard delete ${this.tableName}`, { id, userId, error });
      throw error;
    }
  }

  // Count records with optional filtering
  count(where?: string, params?: any[]): number {
    try {
      let whereClause = `is_active = 1`;
      if (where) {
        whereClause += ` AND (${where})`;
      }

      const stmt = this.db.prepare(`
        SELECT COUNT(*) as total FROM ${this.tableName} WHERE ${whereClause}
      `);

      const result = stmt.get(...(params || [])) as { total: number };
      return result.total;
    } catch (error) {
      logger.error(`Failed to count ${this.tableName}`, { where, params, error });
      throw error;
    }
  }

  // Audit logging helper
  protected async logAudit(
    recordId: TKey, 
    action: 'INSERT' | 'UPDATE' | 'DELETE', 
    oldValues: any, 
    newValues: any, 
    userId: UserId
  ): Promise<void> {
    try {
      const auditStmt = await this.db.prepare(`
        INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, user_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      await auditStmt.run(
        this.tableName,
        recordId,
        action,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        userId
      );
    } catch (error) {
      logger.error('Failed to log audit entry', { 
        tableName: this.tableName,
        recordId, 
        action, 
        userId, 
        error 
      });
      // Don't throw here - audit logging failure shouldn't break the main operation
    }
  }

  // Utility methods
  protected convertBooleanFromDb(value: number | boolean): boolean {
    return value === 1 || value === true;
  }

  protected convertBooleanToDb(value: boolean): number {
    return value ? 1 : 0;
  }

  protected convertDateFromDb(value: string | null): ISODateString | undefined {
    return value || undefined;
  }

  protected convertDateToDb(value: ISODateString | undefined): string | null {
    return value || null;
  }

  // Batch operations
  async bulkCreate(items: Array<Omit<TDomain, 'id' | 'createdAt' | 'updatedAt'>>, userId: UserId): Promise<TDomain[]> {
    try {
      const results: TDomain[] = [];
      
      await this.db.transaction(async () => {
        for (const item of items) {
          const created = await this.create(item, userId);
          results.push(created);
        }
      })();

      logger.info(`Bulk created ${this.tableName}`, { count: items.length, userId });
      return results;
    } catch (error) {
      logger.error(`Failed to bulk create ${this.tableName}`, { count: items.length, userId, error });
      throw error;
    }
  }
}