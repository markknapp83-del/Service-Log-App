// Database Performance Monitoring and Analytics
// Following SQLite documentation patterns from devdocs/sqlite-better-sqlite3.md
import { db } from '@/database/connection';
import { logger } from '@/utils/logger';

export interface DatabaseMetrics {
  // Connection metrics
  connectionHealth: {
    connected: boolean;
    walMode: boolean;
    cacheSize: number;
    pageCount: number;
    freePages: number;
    integrityCheck: boolean;
  };

  // Performance metrics
  queryPerformance: {
    totalQueries: number;
    averageExecutionTime: number;
    slowQueries: number;
    queryTypeStats: { [queryType: string]: { count: number; avgTime: number } };
  };

  // Healthcare-specific metrics
  healthcareMetrics: {
    totalServiceLogs: number;
    totalPatientEntries: number;
    totalUsers: number;
    draftServiceLogs: number;
    recentActivity: {
      logsToday: number;
      logsThisWeek: number;
      logsThisMonth: number;
    };
  };

  // Database size and optimization metrics
  storageMetrics: {
    databaseSizeKB: number;
    tableStats: Array<{
      tableName: string;
      rowCount: number;
      sizeKB: number;
    }>;
    indexStats: Array<{
      indexName: string;
      tableName: string;
      isUsed: boolean;
    }>;
  };
}

export class DatabaseMonitor {
  private static instance: DatabaseMonitor;
  private metricsCache: DatabaseMetrics | null = null;
  private lastCacheUpdate = 0;
  private cacheTimeout = 60000; // 1 minute cache

  public static getInstance(): DatabaseMonitor {
    if (!DatabaseMonitor.instance) {
      DatabaseMonitor.instance = new DatabaseMonitor();
    }
    return DatabaseMonitor.instance;
  }

  // Get comprehensive database metrics
  async getMetrics(forceRefresh = false): Promise<DatabaseMetrics> {
    const now = Date.now();
    
    if (!forceRefresh && this.metricsCache && (now - this.lastCacheUpdate) < this.cacheTimeout) {
      return this.metricsCache;
    }

    logger.info('Collecting database performance metrics');
    const startTime = Date.now();

    try {
      const [connectionHealth, queryPerformance, healthcareMetrics, storageMetrics] = await Promise.all([
        this.getConnectionHealth(),
        this.getQueryPerformance(),
        this.getHealthcareMetrics(),
        this.getStorageMetrics()
      ]);

      this.metricsCache = {
        connectionHealth,
        queryPerformance,
        healthcareMetrics,
        storageMetrics
      };

      this.lastCacheUpdate = now;
      
      logger.info(`Database metrics collected in ${Date.now() - startTime}ms`);
      return this.metricsCache;
    } catch (error) {
      logger.error('Failed to collect database metrics', { error });
      throw error;
    }
  }

  // Check database connection health
  async getConnectionHealth(): Promise<DatabaseMetrics['connectionHealth']> {
    try {
      return await db.healthCheck();
    } catch (error) {
      logger.error('Failed to get connection health', { error });
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

  // Get query performance statistics
  async getQueryPerformance(): Promise<DatabaseMetrics['queryPerformance']> {
    try {
      return db.getQueryMetrics();
    } catch (error) {
      logger.error('Failed to get query performance', { error });
      return {
        totalQueries: 0,
        averageExecutionTime: 0,
        slowQueries: 0,
        queryTypeStats: {}
      };
    }
  }

  // Get healthcare-specific metrics
  async getHealthcareMetrics(): Promise<DatabaseMetrics['healthcareMetrics']> {
    try {
      const startTime = Date.now();
      
      // Basic counts
      const totalServiceLogs = (db.get('SELECT COUNT(*) as count FROM service_logs WHERE deleted_at IS NULL') as { count: number }).count;
      const totalPatientEntries = (db.get('SELECT COUNT(*) as count FROM patient_entries WHERE deleted_at IS NULL') as { count: number }).count;
      const totalUsers = (db.get('SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL') as { count: number }).count;
      const draftServiceLogs = (db.get('SELECT COUNT(*) as count FROM service_logs WHERE is_draft = 1 AND deleted_at IS NULL') as { count: number }).count;

      // Recent activity metrics
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const logsToday = (db.get(`
        SELECT COUNT(*) as count FROM service_logs 
        WHERE DATE(created_at) = ? AND deleted_at IS NULL
      `, today) as { count: number }).count;

      const logsThisWeek = (db.get(`
        SELECT COUNT(*) as count FROM service_logs 
        WHERE DATE(created_at) >= ? AND deleted_at IS NULL
      `, weekAgo) as { count: number }).count;

      const logsThisMonth = (db.get(`
        SELECT COUNT(*) as count FROM service_logs 
        WHERE DATE(created_at) >= ? AND deleted_at IS NULL
      `, monthAgo) as { count: number }).count;

      if (Date.now() - startTime > 50) {
        logger.warn('Healthcare metrics query took longer than expected', { 
          executionTime: Date.now() - startTime 
        });
      }

      return {
        totalServiceLogs,
        totalPatientEntries,
        totalUsers,
        draftServiceLogs,
        recentActivity: {
          logsToday,
          logsThisWeek,
          logsThisMonth
        }
      };
    } catch (error) {
      logger.error('Failed to get healthcare metrics', { error });
      return {
        totalServiceLogs: 0,
        totalPatientEntries: 0,
        totalUsers: 0,
        draftServiceLogs: 0,
        recentActivity: {
          logsToday: 0,
          logsThisWeek: 0,
          logsThisMonth: 0
        }
      };
    }
  }

  // Get storage and optimization metrics
  async getStorageMetrics(): Promise<DatabaseMetrics['storageMetrics']> {
    try {
      const startTime = Date.now();

      // Database size
      const pageSize = db.get('PRAGMA page_size') as { 'page_size': number } | number;
      const pageCount = db.get('PRAGMA page_count') as { 'page_count': number } | number;
      
      const pageSizeValue = typeof pageSize === 'object' ? pageSize['page_size'] : pageSize;
      const pageCountValue = typeof pageCount === 'object' ? pageCount['page_count'] : pageCount;
      
      const databaseSizeKB = Math.round((pageSizeValue * pageCountValue) / 1024);

      // Table statistics
      const tables = ['service_logs', 'patient_entries', 'users', 'clients', 'activities', 'outcomes', 'audit_log'];
      const tableStats: Array<{ tableName: string; rowCount: number; sizeKB: number }> = [];

      for (const table of tables) {
        try {
          const count = (db.get(`SELECT COUNT(*) as count FROM ${table}`) as { count: number }).count;
          
          // Estimate table size (rough calculation)
          const avgRowSize = table === 'service_logs' ? 200 : 
                           table === 'patient_entries' ? 150 :
                           table === 'audit_log' ? 300 : 100;
          const estimatedSizeKB = Math.round((count * avgRowSize) / 1024);

          tableStats.push({
            tableName: table,
            rowCount: count,
            sizeKB: estimatedSizeKB
          });
        } catch (error) {
          logger.warn(`Could not get stats for table ${table}`, { error });
        }
      }

      // Index usage statistics
      const indexes = db.all(`
        SELECT name as index_name, tbl_name as table_name
        FROM sqlite_master 
        WHERE type = 'index' 
        AND name NOT LIKE 'sqlite_%'
        ORDER BY tbl_name, name
      `) as Array<{ index_name: string; table_name: string }>;

      const indexStats = indexes.map(index => ({
        indexName: index.index_name,
        tableName: index.table_name,
        isUsed: true // SQLite doesn't provide direct index usage stats
      }));

      if (Date.now() - startTime > 100) {
        logger.warn('Storage metrics query took longer than expected', { 
          executionTime: Date.now() - startTime 
        });
      }

      return {
        databaseSizeKB,
        tableStats,
        indexStats
      };
    } catch (error) {
      logger.error('Failed to get storage metrics', { error });
      return {
        databaseSizeKB: 0,
        tableStats: [],
        indexStats: []
      };
    }
  }

  // Log slow query for analysis
  logSlowQuery(queryType: string, executionTime: number, tableName?: string, recordCount?: number): void {
    try {
      if (executionTime > 100) { // Only log queries over 100ms
        db.run(`
          INSERT INTO query_performance_log (query_type, execution_time_ms, table_name, record_count)
          VALUES (?, ?, ?, ?)
        `, [queryType, executionTime, tableName || null, recordCount || null]);
      }
    } catch (error) {
      logger.warn('Failed to log slow query', { error });
    }
  }

  // Get slow query analysis
  async getSlowQueryAnalysis(limitHours = 24): Promise<{
    slowQueries: Array<{
      queryType: string;
      avgExecutionTime: number;
      maxExecutionTime: number;
      count: number;
      tableName?: string;
    }>;
    totalSlowQueries: number;
  }> {
    try {
      const hoursAgo = new Date(Date.now() - limitHours * 60 * 60 * 1000).toISOString();

      const slowQueries = db.all(`
        SELECT 
          query_type,
          AVG(execution_time_ms) as avg_execution_time,
          MAX(execution_time_ms) as max_execution_time,
          COUNT(*) as count,
          table_name
        FROM query_performance_log
        WHERE timestamp >= ?
        AND execution_time_ms > 100
        GROUP BY query_type, table_name
        ORDER BY avg_execution_time DESC
        LIMIT 20
      `, hoursAgo) as Array<{
        query_type: string;
        avg_execution_time: number;
        max_execution_time: number;
        count: number;
        table_name?: string;
      }>;

      const totalSlowQueries = (db.get(`
        SELECT COUNT(*) as count 
        FROM query_performance_log 
        WHERE timestamp >= ? AND execution_time_ms > 100
      `, hoursAgo) as { count: number }).count;

      return {
        slowQueries: slowQueries.map(q => ({
          queryType: q.query_type,
          avgExecutionTime: Math.round(q.avg_execution_time),
          maxExecutionTime: q.max_execution_time,
          count: q.count,
          tableName: q.table_name
        })),
        totalSlowQueries
      };
    } catch (error) {
      logger.error('Failed to get slow query analysis', { error });
      return {
        slowQueries: [],
        totalSlowQueries: 0
      };
    }
  }

  // Database optimization recommendations
  async getOptimizationRecommendations(): Promise<Array<{
    type: 'index' | 'query' | 'schema' | 'maintenance';
    priority: 'high' | 'medium' | 'low';
    recommendation: string;
    impact: string;
  }>> {
    const recommendations: Array<{
      type: 'index' | 'query' | 'schema' | 'maintenance';
      priority: 'high' | 'medium' | 'low';
      recommendation: string;
      impact: string;
    }> = [];

    try {
      const metrics = await this.getMetrics();
      const slowQueries = await this.getSlowQueryAnalysis();

      // Check for slow queries
      if (slowQueries.totalSlowQueries > 10) {
        recommendations.push({
          type: 'query',
          priority: 'high',
          recommendation: `Found ${slowQueries.totalSlowQueries} slow queries in the last 24 hours. Consider optimizing the most frequent slow query types.`,
          impact: 'Reducing slow queries will improve response times for healthcare users'
        });
      }

      // Check database size
      if (metrics.storageMetrics.databaseSizeKB > 50 * 1024) { // 50MB
        const freePagePercent = (metrics.connectionHealth.freePages / metrics.connectionHealth.pageCount) * 100;
        
        if (freePagePercent > 20) {
          recommendations.push({
            type: 'maintenance',
            priority: 'medium',
            recommendation: `Database has ${freePagePercent.toFixed(1)}% free pages. Consider running VACUUM to reclaim space.`,
            impact: 'Reduces database file size and improves I/O performance'
          });
        }
      }

      // Check for table growth patterns
      const serviceLogCount = metrics.healthcareMetrics.totalServiceLogs;
      const patientEntryCount = metrics.healthcareMetrics.totalPatientEntries;

      if (serviceLogCount > 10000) {
        recommendations.push({
          type: 'index',
          priority: 'medium',
          recommendation: 'Service logs table is growing large. Ensure all frequently queried columns have appropriate indexes.',
          impact: 'Maintains fast query performance as healthcare data grows'
        });
      }

      if (patientEntryCount > 50000) {
        recommendations.push({
          type: 'schema',
          priority: 'low',
          recommendation: 'Patient entries table has significant data. Consider archiving old entries or implementing partitioning strategy.',
          impact: 'Improves query performance and reduces backup/maintenance time'
        });
      }

      // Check recent activity patterns
      const { logsToday, logsThisWeek } = metrics.healthcareMetrics.recentActivity;
      if (logsToday > logsThisWeek / 7 * 2) { // More than 2x daily average
        recommendations.push({
          type: 'maintenance',
          priority: 'low',
          recommendation: 'High activity detected today. Monitor database performance and consider running optimization during low-usage periods.',
          impact: 'Prevents performance degradation during peak healthcare service periods'
        });
      }

      // Check query performance
      if (metrics.queryPerformance.averageExecutionTime > 50) {
        recommendations.push({
          type: 'index',
          priority: 'high',
          recommendation: `Average query time is ${metrics.queryPerformance.averageExecutionTime.toFixed(1)}ms. Review and optimize slow queries.`,
          impact: 'Improves overall system responsiveness for healthcare workers'
        });
      }

    } catch (error) {
      logger.error('Failed to generate optimization recommendations', { error });
    }

    return recommendations;
  }

  // Clear old performance logs to prevent unbounded growth
  async cleanupPerformanceLogs(olderThanDays = 7): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
      
      const result = db.run(`
        DELETE FROM query_performance_log 
        WHERE timestamp < ?
      `, cutoffDate);
      
      if (result.changes > 0) {
        logger.info(`Cleaned up ${result.changes} old performance log entries`);
      }
    } catch (error) {
      logger.error('Failed to cleanup performance logs', { error });
    }
  }

  // Force cache refresh
  clearCache(): void {
    this.metricsCache = null;
    this.lastCacheUpdate = 0;
    logger.info('Database monitoring cache cleared');
  }
}

// Export singleton instance
export const databaseMonitor = DatabaseMonitor.getInstance();

// Export utility functions for easy access
export const getDatabaseMetrics = (forceRefresh = false) => databaseMonitor.getMetrics(forceRefresh);
export const getOptimizationRecommendations = () => databaseMonitor.getOptimizationRecommendations();
export const logSlowQuery = (queryType: string, executionTime: number, tableName?: string, recordCount?: number) => 
  databaseMonitor.logSlowQuery(queryType, executionTime, tableName, recordCount);