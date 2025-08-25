// Base Repository following SQLite documentation patterns
import Database from 'better-sqlite3';
import { db } from '@/database/connection';
import { logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseUser, AuditLogEntry, ISODateString, UserId } from '@/types/index';

export abstract class BaseRepository<TDomain, TDatabase, TKey = string> {
  protected tableName: string;
  protected db: typeof db;

  constructor(tableName: string) {
    this.tableName = tableName;
    this.db = db;
  }

  // Abstract methods to be implemented by concrete repositories
  protected abstract fromDatabase(dbRow: TDatabase): TDomain;
  protected abstract toDatabase(domain: Partial<TDomain>): Partial<TDatabase>;

  // Optimized find by ID with prepared statement caching
  findById(id: TKey): TDomain | null {
    try {
      const cacheKey = `${this.tableName}_findById`;
      let stmt: Database.Statement;
      
      // Use cached prepared statement for better performance
      try {
        stmt = this.db.prepare(`
          SELECT * FROM ${this.tableName} 
          WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')
        `, cacheKey);
      } catch (error) {
        // If deleted_at column doesn't exist, fallback to simple query
        stmt = this.db.prepare(`
          SELECT * FROM ${this.tableName} 
          WHERE id = ?
        `, `${cacheKey}_simple`);
      }
      
      const row = stmt.get(id) as TDatabase | undefined;
      
      if (!row) {
        return null;
      }

      return this.fromDatabase(row);
    } catch (error) {
      logger.error(`Failed to find ${this.tableName} by ID`, { id, error });
      throw error;
    }
  }

  // Optimized find all with pagination, filtering, and prepared statement caching
  findAll(options: {
    page?: number;
    limit?: number;
    orderBy?: string;
    order?: 'ASC' | 'DESC';
    where?: string;
    params?: any[];
  } = {}): {
    items: TDomain[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  } {
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

      // Build WHERE clause for consistent querying
      let whereClause = `(deleted_at IS NULL OR deleted_at = '')`;
      if (where) {
        whereClause += ` AND (${where})`;
      }

      // Use cached prepared statements for better performance
      const queryKey = `${this.tableName}_findAll_${orderBy}_${order}_${!!where}`;
      const countKey = `${this.tableName}_count_${!!where}`;

      // Get items with optimized query
      const stmt = this.db.prepare(`
        SELECT * FROM ${this.tableName}
        WHERE ${whereClause}
        ORDER BY ${orderBy} ${order}
        LIMIT ? OFFSET ?
      `, queryKey);

      const rows = stmt.all(...params, limit, offset) as TDatabase[];
      const items = rows.map(row => this.fromDatabase(row));

      // Get total count with cached prepared statement
      const countStmt = this.db.prepare(`
        SELECT COUNT(*) as total FROM ${this.tableName} 
        WHERE ${whereClause}
      `, countKey);

      const countResult = countStmt.get(...params) as { total: number };
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

  // Optimized create with cached prepared statements and audit logging
  create(data: Omit<TDomain, 'id' | 'createdAt' | 'updatedAt'>, userId: UserId): TDomain {
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

      // Use cached prepared statement for better performance
      const insertKey = `${this.tableName}_insert`;
      const stmt = this.db.prepare(`
        INSERT INTO ${this.tableName} (${columns.join(', ')})
        VALUES (${placeholders})
      `, insertKey);

      // High-performance transaction with optimized audit logging
      this.db.transaction(() => {
        stmt.run(...values);
        
        // Log to audit table with cached prepared statement
        if (userId) {
          this.logAuditOptimized(id, 'INSERT', null, { id, ...data }, userId);
        }
      });
      
      const created = this.findById(id as TKey);
      if (!created) {
        throw new Error('Failed to retrieve created record');
      }

      logger.debug(`${this.tableName} created`, { id, userId });
      return created;
    } catch (error) {
      logger.error(`Failed to create ${this.tableName}`, { data, userId, error });
      throw error;
    }
  }

  // Optimized update with cached prepared statements and audit logging
  update(id: TKey, data: Partial<TDomain>, userId: UserId): TDomain {
    try {
      const oldRecord = this.findById(id);
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

      // Generate cache key based on columns being updated for better statement reuse
      const updateKey = `${this.tableName}_update_${columns.sort().join('_')}`;
      const stmt = this.db.prepare(`
        UPDATE ${this.tableName} 
        SET ${setClause}
        WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')
      `, updateKey);

      // High-performance transaction with optimized audit logging
      this.db.transaction(() => {
        const result = stmt.run(...values, id);
        
        if (result.changes === 0) {
          throw new Error(`Failed to update ${this.tableName}: ${id}`);
        }
        
        // Log to audit table with cached prepared statement
        this.logAuditOptimized(id, 'UPDATE', oldRecord, { ...oldRecord, ...data }, userId);
      });

      const updated = this.findById(id);
      if (!updated) {
        throw new Error('Failed to retrieve updated record');
      }

      logger.debug(`${this.tableName} updated`, { id, userId });
      return updated;
    } catch (error) {
      logger.error(`Failed to update ${this.tableName}`, { id, data, userId, error });
      throw error;
    }
  }

  // Soft delete with audit logging
  softDelete(id: TKey, userId: UserId): boolean {
    try {
      const oldRecord = this.findById(id);
      if (!oldRecord) {
        throw new Error(`${this.tableName} not found: ${id}`);
      }

      const now = new Date().toISOString();
      const stmt = this.db.prepare(`
        UPDATE ${this.tableName} 
        SET deleted_at = ?, updated_at = ?
        WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')
      `);

      this.db.transaction(() => {
        const result = stmt.run(now, now, id);
        
        if (result.changes === 0) {
          throw new Error(`Failed to delete ${this.tableName}: ${id}`);
        }
        
        // Log to audit table
        this.logAudit(id, 'DELETE', oldRecord, { ...oldRecord, deletedAt: now }, userId);
      });

      logger.info(`${this.tableName} soft deleted`, { id, userId });
      return true;
    } catch (error) {
      logger.error(`Failed to soft delete ${this.tableName}`, { id, userId, error });
      throw error;
    }
  }

  // Hard delete (use sparingly)
  hardDelete(id: TKey, userId: UserId): boolean {
    try {
      const oldRecord = this.findById(id);
      if (!oldRecord) {
        return false; // Already deleted
      }

      const stmt = this.db.prepare(`
        DELETE FROM ${this.tableName} WHERE id = ?
      `);

      this.db.transaction(() => {
        const result = stmt.run(id);
        
        if (result.changes === 0) {
          throw new Error(`Failed to hard delete ${this.tableName}: ${id}`);
        }
        
        // Log to audit table
        this.logAudit(id, 'DELETE', oldRecord, null, userId);
      });

      logger.info(`${this.tableName} hard deleted`, { id, userId });
      return true;
    } catch (error) {
      logger.error(`Failed to hard delete ${this.tableName}`, { id, userId, error });
      throw error;
    }
  }

  // Count records with optional filtering (legacy method maintained for compatibility)
  count(where?: string, params?: any[]): number {
    try {
      let whereClause = `is_active = 1`;
      if (where) {
        whereClause += ` AND (${where})`;
      }

      const countKey = `${this.tableName}_count_legacy`;
      const stmt = this.db.prepare(`
        SELECT COUNT(*) as total FROM ${this.tableName} WHERE ${whereClause}
      `, countKey);

      const result = stmt.get(...(params || [])) as { total: number };
      return result.total;
    } catch (error) {
      logger.error(`Failed to count ${this.tableName}`, { where, params, error });
      throw error;
    }
  }

  // Original audit logging helper (maintained for backward compatibility)
  protected logAudit(
    recordId: TKey, 
    action: 'INSERT' | 'UPDATE' | 'DELETE', 
    oldValues: any, 
    newValues: any, 
    userId: UserId
  ): void {
    try {
      const auditStmt = this.db.prepare(`
        INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, user_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      auditStmt.run(
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

  // Optimized audit logging with cached prepared statements
  protected logAuditOptimized(
    recordId: TKey, 
    action: 'INSERT' | 'UPDATE' | 'DELETE', 
    oldValues: any, 
    newValues: any, 
    userId: UserId
  ): void {
    try {
      const auditKey = 'audit_log_insert';
      const auditStmt = this.db.prepare(`
        INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, user_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `, auditKey);

      auditStmt.run(
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

  // Create with auto-increment ID (for reference tables like clients, activities, outcomes)
  protected createWithAutoIncrement(data: Omit<TDomain, 'id' | 'createdAt' | 'updatedAt'>, userId: UserId): TDomain {
    try {
      const now = new Date().toISOString();
      const dbData = this.toDatabase({
        ...data as any,
        createdAt: now,
        updatedAt: now
      });

      // Remove id from data since it's auto-increment
      delete (dbData as any).id;

      const columns = Object.keys(dbData);
      const placeholders = columns.map(() => '?').join(', ');
      const values = Object.values(dbData);

      const stmt = this.db.prepare(`
        INSERT INTO ${this.tableName} (${columns.join(', ')})
        VALUES (${placeholders})
      `);

      let result: any;
      this.db.transaction(() => {
        result = stmt.run(...values);
        
        // Log to audit table
        if (userId) {
          this.logAudit(result.lastInsertRowid, 'INSERT', null, { id: result.lastInsertRowid, ...data }, userId);
        }
      });

      const created = this.findById(result.lastInsertRowid as any);
      if (!created) {
        throw new Error('Failed to retrieve created record');
      }

      logger.info(`${this.tableName} created with auto-increment`, { id: result.lastInsertRowid, userId });
      return created;
    } catch (error) {
      logger.error(`Failed to create ${this.tableName} with auto-increment`, { data, userId, error });
      throw error;
    }
  }

  // Optimized batch operations for healthcare data bulk imports
  bulkCreate(items: Array<Omit<TDomain, 'id' | 'createdAt' | 'updatedAt'>>, userId: UserId): TDomain[] {
    try {
      const results: TDomain[] = [];
      const now = new Date().toISOString();
      
      // Pre-generate IDs and database representations for better performance
      const preparedItems = items.map(item => {
        const id = typeof item === 'object' && 'id' in item ? (item as any).id : uuidv4();
        const dbData = this.toDatabase({
          ...item as any,
          id,
          createdAt: now,
          updatedAt: now
        });
        return { id, dbData, originalItem: item };
      });

      if (preparedItems.length === 0) return [];

      // Use prepared statement for bulk insert
      const columns = Object.keys(preparedItems[0].dbData);
      const placeholders = columns.map(() => '?').join(', ');
      const bulkInsertKey = `${this.tableName}_bulk_insert`;
      
      const insertStmt = this.db.prepare(`
        INSERT INTO ${this.tableName} (${columns.join(', ')})
        VALUES (${placeholders})
      `, bulkInsertKey);
      
      // High-performance bulk transaction
      this.db.transaction(() => {
        for (const prepared of preparedItems) {
          const values = Object.values(prepared.dbData);
          insertStmt.run(...values);
          
          // Optimized audit logging for bulk operations
          if (userId) {
            this.logAuditOptimized(prepared.id, 'INSERT', null, { id: prepared.id, ...prepared.originalItem }, userId);
          }
        }
      });

      // Retrieve created records efficiently
      for (const prepared of preparedItems) {
        const created = this.findById(prepared.id as TKey);
        if (created) {
          results.push(created);
        }
      }

      logger.info(`Bulk created ${this.tableName}`, { count: items.length, userId });
      return results;
    } catch (error) {
      logger.error(`Failed to bulk create ${this.tableName}`, { count: items.length, userId, error });
      throw error;
    }
  }

  // High-performance bulk update for healthcare data migrations
  bulkUpdate(updates: Array<{ id: TKey; data: Partial<TDomain> }>, userId: UserId): TDomain[] {
    try {
      const results: TDomain[] = [];
      const now = new Date().toISOString();
      
      if (updates.length === 0) return [];

      // Group updates by columns for better prepared statement reuse
      const updateGroups = new Map<string, any[]>();
      
      for (const update of updates) {
        const dbData = this.toDatabase({
          ...update.data as any,
          updatedAt: now
        });
        
        const updateData = Object.entries(dbData)
          .filter(([key, value]) => key !== 'id' && value !== undefined)
          .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
        
        if (Object.keys(updateData).length === 0) continue;
        
        const columns = Object.keys(updateData).sort();
        const groupKey = columns.join('_');
        
        if (!updateGroups.has(groupKey)) {
          updateGroups.set(groupKey, []);
        }
        
        updateGroups.get(groupKey)!.push({ id: update.id, data: update.data, dbData: updateData });
      }
      
      // Process each group with optimized prepared statements
      this.db.transaction(() => {
        for (const [groupKey, groupUpdates] of updateGroups.entries()) {
          const columns = Object.keys(groupUpdates[0].dbData);
          const setClause = columns.map(col => `${col} = ?`).join(', ');
          const updateKey = `${this.tableName}_bulk_update_${groupKey}`;
          
          const updateStmt = this.db.prepare(`
            UPDATE ${this.tableName} 
            SET ${setClause}
            WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')
          `, updateKey);
          
          for (const update of groupUpdates) {
            const values = Object.values(update.dbData);
            const result = updateStmt.run(...values, update.id);
            
            if (result.changes > 0 && userId) {
              // Optimized audit logging for bulk operations
              this.logAuditOptimized(update.id, 'UPDATE', null, update.data, userId);
            }
          }
        }
      });
      
      // Retrieve updated records
      for (const update of updates) {
        const updated = this.findById(update.id);
        if (updated) {
          results.push(updated);
        }
      }
      
      logger.info(`Bulk updated ${this.tableName}`, { count: updates.length, userId });
      return results;
    } catch (error) {
      logger.error(`Failed to bulk update ${this.tableName}`, { count: updates.length, userId, error });
      throw error;
    }
  }

  // Healthcare-specific efficient count with indexing
  countOptimized(conditions: { [key: string]: any } = {}): number {
    try {
      const whereClauses: string[] = ['(deleted_at IS NULL OR deleted_at = \'\')'];
      const params: any[] = [];
      
      // Build optimized WHERE clause using available indexes
      for (const [key, value] of Object.entries(conditions)) {
        if (value !== undefined && value !== null) {
          whereClauses.push(`${key} = ?`);
          params.push(value);
        }
      }
      
      const whereClause = whereClauses.join(' AND ');
      const countKey = `${this.tableName}_count_optimized_${Object.keys(conditions).sort().join('_')}`;
      
      const stmt = this.db.prepare(`
        SELECT COUNT(*) as total FROM ${this.tableName} 
        WHERE ${whereClause}
      `, countKey);
      
      const result = stmt.get(...params) as { total: number };
      return result.total;
    } catch (error) {
      logger.error(`Failed to count ${this.tableName}`, { conditions, error });
      throw error;
    }
  }
}
