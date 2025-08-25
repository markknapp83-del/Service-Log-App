// Optimized Database connection with performance monitoring and prepared statement caching
// Following SQLite documentation patterns from devdocs/sqlite-better-sqlite3.md
import Database from 'better-sqlite3';
import { logger } from '@/utils/logger';

interface QueryMetrics {
  queryType: string;
  executionTime: number;
  tableName?: string;
  recordCount?: number;
}

interface PreparedStatementCache {
  [sql: string]: Database.Statement;
}

class OptimizedDatabaseConnection {
  private db: Database.Database;
  private preparedStatements: PreparedStatementCache = {};
  private queryMetrics: QueryMetrics[] = [];
  private metricsEnabled: boolean = false;

  constructor() {
    const dbPath = process.env.NODE_ENV === 'test' 
      ? ':memory:' 
      : (process.env.DB_PATH || './database/healthcare.db');
    
    this.db = new Database(dbPath);
    
    // Apply comprehensive performance optimizations
    this.applyOptimalSettings();
    
    // Enable query performance monitoring in development
    this.metricsEnabled = process.env.NODE_ENV === 'development';
    
    logger.info('Optimized database connection established', { 
      path: dbPath, 
      metricsEnabled: this.metricsEnabled 
    });
  }

  private applyOptimalSettings(): void {
    logger.info('Applying Phase 8 database performance optimizations');
    
    try {
      // Enable foreign key constraints for data integrity
      this.db.pragma('foreign_keys = ON');
      
      // WAL mode for maximum concurrency and performance
      this.db.pragma('journal_mode = WAL');
      
      // Optimize synchronization for healthcare data safety vs performance balance
      this.db.pragma('synchronous = NORMAL');
      
      // Large cache size for healthcare queries (128MB)
      this.db.pragma('cache_size = -128000');
      
      // Store temporary tables in memory for speed
      this.db.pragma('temp_store = memory');
      
      // Enable memory-mapped I/O for large database files (256MB)
      this.db.pragma('mmap_size = 268435456');
      
      // Longer busy timeout for healthcare system reliability (60 seconds)
      this.db.pragma('busy_timeout = 60000');
      
      // Optimize query planning
      this.db.pragma('optimize');
      this.db.pragma('analysis_limit = 1000');
      
      // Enable automatic index creation for better query performance
      this.db.pragma('automatic_index = ON');
      
      // Disable full fsync for faster checkpoints (acceptable for healthcare data)
      this.db.pragma('checkpoint_fullfsync = OFF');
      
      logger.info('✓ Phase 8 database performance settings applied successfully');
    } catch (error) {
      logger.error('Failed to apply database performance settings', { error });
    }
  }

  getDb(): Database.Database {
    return this.db;
  }

  close(): void {
    // Clean up prepared statements
    for (const stmt of Object.values(this.preparedStatements)) {
      try {
        stmt.finalize();
      } catch (error) {
        logger.warn('Error finalizing prepared statement', { error });
      }
    }
    this.preparedStatements = {};
    
    this.db.close();
    logger.info('Database connection closed with cleanup');
  }

  // Optimized prepare with caching for frequently used statements
  prepare(sql: string, cacheKey?: string): Database.Statement {
    const key = cacheKey || sql;
    
    if (this.preparedStatements[key]) {
      return this.preparedStatements[key];
    }
    
    const stmt = this.db.prepare(sql);
    
    // Cache frequently used statements (limit cache size to prevent memory leaks)
    if (Object.keys(this.preparedStatements).length < 100) {
      this.preparedStatements[key] = stmt;
    }
    
    return stmt;
  }

  exec(sql: string): Database.RunResult {
    const startTime = Date.now();
    const result = this.db.exec(sql);
    
    if (this.metricsEnabled) {
      this.recordQueryMetric('EXEC', Date.now() - startTime);
    }
    
    return result;
  }

  // Optimized run with prepared statement caching and metrics
  run(sql: string, params?: any[], cacheKey?: string): Database.RunResult {
    const startTime = Date.now();
    const stmt = this.prepare(sql, cacheKey);
    const result = stmt.run(...(params || []));
    
    if (this.metricsEnabled) {
      this.recordQueryMetric('RUN', Date.now() - startTime, undefined, result.changes);
    }
    
    return result;
  }

  // Optimized get with prepared statement caching and metrics
  get(sql: string, params?: any[], cacheKey?: string): any {
    const startTime = Date.now();
    const stmt = this.prepare(sql, cacheKey);
    const result = stmt.get(...(params || []));
    
    if (this.metricsEnabled) {
      this.recordQueryMetric('GET', Date.now() - startTime, undefined, result ? 1 : 0);
    }
    
    return result;
  }

  // Optimized all with prepared statement caching and metrics
  all(sql: string, params?: any[], cacheKey?: string): any[] {
    const startTime = Date.now();
    const stmt = this.prepare(sql, cacheKey);
    const result = stmt.all(...(params || []));
    
    if (this.metricsEnabled) {
      this.recordQueryMetric('ALL', Date.now() - startTime, undefined, result.length);
    }
    
    return result;
  }

  // High-performance transaction with proper error handling
  transaction<T>(fn: () => T): T {
    const startTime = Date.now();
    
    try {
      const result = this.db.transaction(fn)();
      
      if (this.metricsEnabled) {
        this.recordQueryMetric('TRANSACTION', Date.now() - startTime);
      }
      
      return result;
    } catch (error) {
      if (this.metricsEnabled) {
        this.recordQueryMetric('TRANSACTION_FAILED', Date.now() - startTime);
      }
      throw error;
    }
  }

  // Batch operations for better performance with large datasets
  batchInsert(sql: string, records: any[][], batchSize: number = 100): Database.RunResult[] {
    const startTime = Date.now();
    const stmt = this.prepare(sql);
    const results: Database.RunResult[] = [];
    
    const insertBatch = this.db.transaction((batch: any[][]) => {
      for (const record of batch) {
        results.push(stmt.run(...record));
      }
    });
    
    // Process in batches for better memory management
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      insertBatch(batch);
    }
    
    if (this.metricsEnabled) {
      this.recordQueryMetric('BATCH_INSERT', Date.now() - startTime, undefined, records.length);
    }
    
    logger.info(`Batch insert completed`, { records: records.length, batches: Math.ceil(records.length / batchSize) });
    return results;
  }

  // Healthcare-specific bulk operations
  bulkUpsert(tableName: string, records: any[], conflictColumns: string[]): Database.RunResult[] {
    if (records.length === 0) return [];
    
    const startTime = Date.now();
    const columns = Object.keys(records[0]);
    const placeholders = columns.map(() => '?').join(', ');
    const updateClause = columns
      .filter(col => !conflictColumns.includes(col))
      .map(col => `${col} = excluded.${col}`)
      .join(', ');
    
    const sql = `
      INSERT INTO ${tableName} (${columns.join(', ')})
      VALUES (${placeholders})
      ON CONFLICT (${conflictColumns.join(', ')})
      DO UPDATE SET ${updateClause}
    `;
    
    const stmt = this.prepare(sql);
    const results: Database.RunResult[] = [];
    
    const upsertTransaction = this.db.transaction(() => {
      for (const record of records) {
        const values = columns.map(col => record[col]);
        results.push(stmt.run(...values));
      }
    });
    
    upsertTransaction();
    
    if (this.metricsEnabled) {
      this.recordQueryMetric('BULK_UPSERT', Date.now() - startTime, tableName, records.length);
    }
    
    logger.info(`Bulk upsert completed for ${tableName}`, { records: records.length });
    return results;
  }

  // Query performance monitoring
  private recordQueryMetric(queryType: string, executionTime: number, tableName?: string, recordCount?: number): void {
    if (!this.metricsEnabled) return;
    
    const metric: QueryMetrics = {
      queryType,
      executionTime,
      tableName,
      recordCount
    };
    
    this.queryMetrics.push(metric);
    
    // Keep only last 1000 metrics to prevent memory leaks
    if (this.queryMetrics.length > 1000) {
      this.queryMetrics = this.queryMetrics.slice(-1000);
    }
    
    // Log slow queries for healthcare system optimization
    if (executionTime > 100) { // Queries over 100ms
      logger.warn('Slow query detected', { 
        queryType, 
        executionTime, 
        tableName, 
        recordCount 
      });
    }
  }

  // Get query performance statistics
  getQueryMetrics(): {
    totalQueries: number;
    averageExecutionTime: number;
    slowQueries: number;
    queryTypeStats: { [queryType: string]: { count: number; avgTime: number } };
  } {
    if (this.queryMetrics.length === 0) {
      return {
        totalQueries: 0,
        averageExecutionTime: 0,
        slowQueries: 0,
        queryTypeStats: {}
      };
    }
    
    const totalTime = this.queryMetrics.reduce((sum, metric) => sum + metric.executionTime, 0);
    const slowQueries = this.queryMetrics.filter(metric => metric.executionTime > 100).length;
    
    const queryTypeStats: { [queryType: string]: { count: number; avgTime: number } } = {};
    
    for (const metric of this.queryMetrics) {
      if (!queryTypeStats[metric.queryType]) {
        queryTypeStats[metric.queryType] = { count: 0, avgTime: 0 };
      }
      queryTypeStats[metric.queryType].count++;
      queryTypeStats[metric.queryType].avgTime = 
        (queryTypeStats[metric.queryType].avgTime + metric.executionTime) / 2;
    }
    
    return {
      totalQueries: this.queryMetrics.length,
      averageExecutionTime: totalTime / this.queryMetrics.length,
      slowQueries,
      queryTypeStats
    };
  }

  // Clear query metrics
  clearMetrics(): void {
    this.queryMetrics = [];
    logger.info('Query metrics cleared');
  }

  // Database health check for monitoring
  async healthCheck(): Promise<{
    connected: boolean;
    walMode: boolean;
    cacheSize: number;
    pageCount: number;
    freePages: number;
    integrityCheck: boolean;
  }> {
    try {
      // Basic connectivity test
      this.db.exec('SELECT 1');
      
      // Check WAL mode
      const walResult = this.db.pragma('journal_mode', { simple: true }) as string;
      
      // Check cache configuration
      const cacheSize = this.db.pragma('cache_size', { simple: true }) as number;
      
      // Check database size
      const pageCount = this.db.pragma('page_count', { simple: true }) as number;
      const freePages = this.db.pragma('freelist_count', { simple: true }) as number;
      
      // Quick integrity check (first 10 pages)
      let integrityCheck = true;
      try {
        const result = this.db.pragma('quick_check', { simple: true }) as string;
        integrityCheck = result === 'ok';
      } catch (error) {
        integrityCheck = false;
      }
      
      return {
        connected: true,
        walMode: walResult === 'wal',
        cacheSize,
        pageCount,
        freePages,
        integrityCheck
      };
    } catch (error) {
      logger.error('Database health check failed', { error });
      return {
        connected: false,
        walMode: false,
        cacheSize: 0,
        pageCount: 0,
        freePages: 0,
        integrityCheck: false
      };
    }
  }

  // Optimize database (runs ANALYZE and VACUUM if needed)
  async optimize(): Promise<void> {
    logger.info('Starting database optimization');
    const startTime = Date.now();
    
    try {
      // Update statistics for query optimizer
      this.db.exec('ANALYZE');
      logger.info('Database analysis completed');
      
      // Check if VACUUM is needed (if free pages > 10% of total)
      const pageCount = this.db.pragma('page_count', { simple: true }) as number;
      const freePages = this.db.pragma('freelist_count', { simple: true }) as number;
      
      if (freePages > pageCount * 0.1) {
        logger.info('Running VACUUM to reclaim space', { freePages, totalPages: pageCount });
        this.db.exec('VACUUM');
        logger.info('VACUUM completed');
      }
      
      // Optimize pragma
      this.db.exec('PRAGMA optimize');
      
      logger.info(`Database optimization completed in ${Date.now() - startTime}ms`);
    } catch (error) {
      logger.error('Database optimization failed', { error });
      throw error;
    }
  }
}

export const dbConnection = new OptimizedDatabaseConnection();
export { dbConnection as db };
export type { QueryMetrics };