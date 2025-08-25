// Database migration system for performance optimizations
// Following SQLite documentation patterns from devdocs/sqlite-better-sqlite3.md
import { db } from './connection';
import { logger } from '@/utils/logger';
import Database from 'better-sqlite3';

interface Migration {
  version: number;
  description: string;
  up: () => void;
  down?: () => void;
}

export class DatabaseMigrator {
  private migrations: Migration[] = [];

  constructor() {
    this.initializeMigrations();
  }

  private initializeMigrations(): void {
    this.migrations = [
      {
        version: 1,
        description: 'Create migration tracking table',
        up: () => {
          db.exec(`
            CREATE TABLE IF NOT EXISTS database_migrations (
              version INTEGER PRIMARY KEY,
              description TEXT NOT NULL,
              applied_at TEXT NOT NULL DEFAULT (datetime('now')),
              execution_time_ms INTEGER
            )
          `);
        }
      },
      {
        version: 2,
        description: 'Phase 8 Performance: Optimize indexes for healthcare queries',
        up: () => {
          logger.info('Phase 8: Applying comprehensive database performance optimizations');
          
          // Drop existing indexes to recreate them optimally
          this.dropIndexesSafely();
          
          // Create optimized indexes for healthcare-specific query patterns
          this.createOptimizedIndexes();
          
          // Update SQLite settings for maximum performance
          this.applyPerformanceSettings();
          
          // Analyze tables for query optimizer
          this.analyzeTablesForOptimizer();
        },
        down: () => {
          logger.info('Rolling back Phase 8 performance optimizations');
          this.rollbackOptimizedIndexes();
        }
      },
      {
        version: 3,
        description: 'Phase 8 Performance: Add computed columns for faster aggregations',
        up: () => {
          logger.info('Phase 8: Adding computed columns for faster healthcare reporting');
          
          // Add computed columns to service_logs for faster aggregations
          try {
            db.exec(`
              ALTER TABLE service_logs ADD COLUMN appointment_stats_json TEXT;
            `);
          } catch (error) {
            // Column might already exist
            logger.info('appointment_stats_json column already exists, skipping');
          }
          
          // Create trigger to maintain computed stats
          this.createAppointmentStatsTrigger();
          
          // Backfill existing data
          this.backfillAppointmentStats();
        },
        down: () => {
          db.exec(`DROP TRIGGER IF EXISTS update_appointment_stats_trigger`);
          // Note: SQLite doesn't support DROP COLUMN, would need table recreation
        }
      },
      {
        version: 4,
        description: 'Phase 8 Performance: Create materialized view for reporting',
        up: () => {
          logger.info('Phase 8: Creating materialized views for healthcare reporting');
          
          // Create reporting summary table (acts as materialized view)
          db.exec(`
            CREATE TABLE IF NOT EXISTS service_log_reporting_view (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              client_id INTEGER NOT NULL,
              client_name TEXT NOT NULL,
              activity_id INTEGER NOT NULL,
              activity_name TEXT NOT NULL,
              service_date TEXT NOT NULL,
              is_draft INTEGER NOT NULL,
              submitted_at TEXT,
              total_appointments INTEGER NOT NULL DEFAULT 0,
              new_appointments INTEGER NOT NULL DEFAULT 0,
              followup_appointments INTEGER NOT NULL DEFAULT 0,
              dna_appointments INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              last_refreshed TEXT NOT NULL DEFAULT (datetime('now'))
            )
          `);
          
          // Create indexes on the reporting view
          db.exec(`CREATE INDEX IF NOT EXISTS idx_reporting_view_user_date ON service_log_reporting_view (user_id, service_date)`);
          db.exec(`CREATE INDEX IF NOT EXISTS idx_reporting_view_client_date ON service_log_reporting_view (client_id, service_date)`);
          db.exec(`CREATE INDEX IF NOT EXISTS idx_reporting_view_activity_date ON service_log_reporting_view (activity_id, service_date)`);
          db.exec(`CREATE INDEX IF NOT EXISTS idx_reporting_view_draft_status ON service_log_reporting_view (is_draft, submitted_at)`);
          db.exec(`CREATE INDEX IF NOT EXISTS idx_reporting_view_date_range ON service_log_reporting_view (service_date, created_at)`);
          
          // Initial population of the reporting view
          this.refreshReportingView();
        },
        down: () => {
          db.exec(`DROP TABLE IF EXISTS service_log_reporting_view`);
        }
      },
      {
        version: 5,
        description: 'Phase 8 Performance: Add database monitoring and query caching',
        up: () => {
          logger.info('Phase 8: Setting up database monitoring and query performance tracking');
          
          // Create query performance tracking table
          db.exec(`
            CREATE TABLE IF NOT EXISTS query_performance_log (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              query_type TEXT NOT NULL,
              execution_time_ms INTEGER NOT NULL,
              table_name TEXT,
              record_count INTEGER,
              timestamp TEXT NOT NULL DEFAULT (datetime('now'))
            )
          `);
          
          // Create index for performance monitoring
          db.exec(`CREATE INDEX IF NOT EXISTS idx_query_perf_type_time ON query_performance_log (query_type, timestamp)`);
          db.exec(`CREATE INDEX IF NOT EXISTS idx_query_perf_table_time ON query_performance_log (table_name, timestamp)`);
          
          // Create database statistics table for monitoring
          db.exec(`
            CREATE TABLE IF NOT EXISTS database_statistics (
              metric_name TEXT PRIMARY KEY,
              metric_value TEXT NOT NULL,
              last_updated TEXT NOT NULL DEFAULT (datetime('now'))
            )
          `);
          
          // Initialize basic statistics
          this.updateDatabaseStatistics();
        },
        down: () => {
          db.exec(`DROP TABLE IF EXISTS query_performance_log`);
          db.exec(`DROP TABLE IF EXISTS database_statistics`);
        }
      }
    ];
  }

  private dropIndexesSafely(): void {
    const indexesToDrop = [
      'idx_service_logs_user_draft_old',
      'idx_service_logs_client_date_old',
      'idx_service_logs_activity_date_old'
    ];
    
    for (const indexName of indexesToDrop) {
      try {
        db.exec(`DROP INDEX IF EXISTS ${indexName}`);
      } catch (error) {
        logger.warn(`Could not drop index ${indexName}`, { error });
      }
    }
  }

  private createOptimizedIndexes(): void {
    logger.info('Creating optimized indexes for healthcare query patterns');
    
    // Critical path: Service log query optimization
    // These indexes support the most common healthcare query patterns
    
    // Multi-column indexes for common filter combinations
    db.exec(`CREATE INDEX IF NOT EXISTS idx_service_logs_user_date_draft ON service_logs (user_id, service_date, is_draft)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_service_logs_client_date_submitted ON service_logs (client_id, service_date, submitted_at)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_service_logs_activity_date_active ON service_logs (activity_id, service_date) WHERE deleted_at IS NULL`);
    
    // Covering indexes for common SELECT patterns (include frequently accessed columns)
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_service_logs_reporting_cover ON service_logs 
      (user_id, client_id, activity_id, service_date, is_draft, patient_count, created_at, updated_at) 
      WHERE deleted_at IS NULL
    `);
    
    // Patient entries optimization for appointment aggregation
    db.exec(`CREATE INDEX IF NOT EXISTS idx_patient_entries_log_type_outcome ON patient_entries (service_log_id, appointment_type, outcome_id) WHERE deleted_at IS NULL`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_patient_entries_type_date ON patient_entries (appointment_type, created_at) WHERE deleted_at IS NULL`);
    
    // Audit log performance for compliance queries
    db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_log_table_user_time ON audit_log (table_name, user_id, timestamp)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_log_record_action ON audit_log (record_id, action, timestamp)`);
    
    // Reference data optimization
    db.exec(`CREATE INDEX IF NOT EXISTS idx_clients_active_name ON clients (is_active, name) WHERE deleted_at IS NULL`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_activities_active_name ON activities (is_active, name) WHERE deleted_at IS NULL`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_outcomes_active_name ON outcomes (is_active, name) WHERE deleted_at IS NULL`);
    
    // User authentication and authorization optimization
    db.exec(`CREATE INDEX IF NOT EXISTS idx_users_role_active_email ON users (role, is_active, email) WHERE deleted_at IS NULL`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_users_login_tracking ON users (last_login_at, is_active) WHERE deleted_at IS NULL`);
  }

  private applyPerformanceSettings(): void {
    logger.info('Applying SQLite performance settings for healthcare data');
    
    try {
      // WAL mode for better concurrency (already set in connection, but ensure it's active)
      db.exec(`PRAGMA journal_mode=WAL`);
      
      // Optimize for healthcare data patterns
      db.exec(`PRAGMA synchronous=NORMAL`);
      db.exec(`PRAGMA cache_size=-128000`); // 128MB cache for large datasets
      db.exec(`PRAGMA temp_store=memory`);
      db.exec(`PRAGMA mmap_size=268435456`); // 256MB memory-mapped I/O
      
      // Optimize query planner for healthcare queries
      db.exec(`PRAGMA optimize`);
      db.exec(`PRAGMA analysis_limit=1000`); // More thorough analysis
      
      // Connection settings for better performance
      db.exec(`PRAGMA busy_timeout=60000`); // 60 second timeout for busy database
      db.exec(`PRAGMA checkpoint_fullfsync=OFF`); // Faster checkpoints
      
      logger.info('✓ Phase 8 SQLite performance settings applied successfully');
    } catch (error) {
      logger.error('Failed to apply some SQLite performance settings', { error });
    }
  }

  private analyzeTablesForOptimizer(): void {
    logger.info('Analyzing tables for query optimizer');
    
    const tables = ['service_logs', 'patient_entries', 'users', 'clients', 'activities', 'outcomes', 'audit_log'];
    
    for (const table of tables) {
      try {
        db.exec(`ANALYZE ${table}`);
        logger.debug(`✓ Analyzed table: ${table}`);
      } catch (error) {
        logger.warn(`Could not analyze table ${table}`, { error });
      }
    }
    
    // Global analysis for better query planning
    try {
      db.exec(`ANALYZE`);
      logger.info('✓ Global table analysis completed');
    } catch (error) {
      logger.warn('Global table analysis failed', { error });
    }
  }

  private rollbackOptimizedIndexes(): void {
    logger.info('Rolling back optimized indexes');
    
    const optimizedIndexes = [
      'idx_service_logs_user_date_draft',
      'idx_service_logs_client_date_submitted',
      'idx_service_logs_activity_date_active',
      'idx_service_logs_reporting_cover',
      'idx_patient_entries_log_type_outcome',
      'idx_patient_entries_type_date',
      'idx_audit_log_table_user_time',
      'idx_audit_log_record_action',
      'idx_clients_active_name',
      'idx_activities_active_name',
      'idx_outcomes_active_name',
      'idx_users_role_active_email',
      'idx_users_login_tracking'
    ];
    
    for (const indexName of optimizedIndexes) {
      try {
        db.exec(`DROP INDEX IF EXISTS ${indexName}`);
      } catch (error) {
        logger.warn(`Could not drop optimized index ${indexName}`, { error });
      }
    }
  }

  private createAppointmentStatsTrigger(): void {
    logger.info('Creating appointment statistics maintenance trigger');
    
    // Drop existing trigger if it exists
    db.exec(`DROP TRIGGER IF EXISTS update_appointment_stats_trigger`);
    
    // Create trigger to maintain appointment statistics
    db.exec(`
      CREATE TRIGGER update_appointment_stats_trigger
      AFTER INSERT ON patient_entries
      FOR EACH ROW
      BEGIN
        UPDATE service_logs 
        SET appointment_stats_json = (
          SELECT json_object(
            'new', COALESCE(SUM(CASE WHEN pe.appointment_type = 'new' THEN 1 ELSE 0 END), 0),
            'followup', COALESCE(SUM(CASE WHEN pe.appointment_type = 'followup' THEN 1 ELSE 0 END), 0),
            'dna', COALESCE(SUM(CASE WHEN pe.appointment_type = 'dna' THEN 1 ELSE 0 END), 0),
            'total', COUNT(pe.id)
          )
          FROM patient_entries pe
          WHERE pe.service_log_id = NEW.service_log_id
          AND (pe.deleted_at IS NULL OR pe.deleted_at = '')
        ),
        updated_at = datetime('now')
        WHERE id = NEW.service_log_id;
      END
    `);
    
    // Create trigger for updates
    db.exec(`
      CREATE TRIGGER update_appointment_stats_on_update_trigger
      AFTER UPDATE ON patient_entries
      FOR EACH ROW
      WHEN OLD.appointment_type != NEW.appointment_type OR OLD.deleted_at != NEW.deleted_at
      BEGIN
        UPDATE service_logs 
        SET appointment_stats_json = (
          SELECT json_object(
            'new', COALESCE(SUM(CASE WHEN pe.appointment_type = 'new' THEN 1 ELSE 0 END), 0),
            'followup', COALESCE(SUM(CASE WHEN pe.appointment_type = 'followup' THEN 1 ELSE 0 END), 0),
            'dna', COALESCE(SUM(CASE WHEN pe.appointment_type = 'dna' THEN 1 ELSE 0 END), 0),
            'total', COUNT(pe.id)
          )
          FROM patient_entries pe
          WHERE pe.service_log_id = NEW.service_log_id
          AND (pe.deleted_at IS NULL OR pe.deleted_at = '')
        ),
        updated_at = datetime('now')
        WHERE id = NEW.service_log_id;
      END
    `);
  }

  private backfillAppointmentStats(): void {
    logger.info('Backfilling appointment statistics for existing service logs');
    
    try {
      const result = db.exec(`
        UPDATE service_logs 
        SET appointment_stats_json = (
          SELECT json_object(
            'new', COALESCE(SUM(CASE WHEN pe.appointment_type = 'new' THEN 1 ELSE 0 END), 0),
            'followup', COALESCE(SUM(CASE WHEN pe.appointment_type = 'followup' THEN 1 ELSE 0 END), 0),
            'dna', COALESCE(SUM(CASE WHEN pe.appointment_type = 'dna' THEN 1 ELSE 0 END), 0),
            'total', COUNT(pe.id)
          )
          FROM patient_entries pe
          WHERE pe.service_log_id = service_logs.id
          AND (pe.deleted_at IS NULL OR pe.deleted_at = '')
        )
        WHERE (deleted_at IS NULL OR deleted_at = '')
      `);
      
      logger.info(`✓ Backfilled appointment statistics for service logs`);
    } catch (error) {
      logger.error('Failed to backfill appointment statistics', { error });
    }
  }

  private refreshReportingView(): void {
    logger.info('Refreshing reporting view with latest data');
    
    try {
      // Clear existing data
      db.exec(`DELETE FROM service_log_reporting_view`);
      
      // Populate with current data
      db.exec(`
        INSERT INTO service_log_reporting_view (
          id, user_id, client_id, client_name, activity_id, activity_name,
          service_date, is_draft, submitted_at, total_appointments,
          new_appointments, followup_appointments, dna_appointments,
          created_at, updated_at
        )
        SELECT 
          sl.id,
          sl.user_id,
          sl.client_id,
          c.name as client_name,
          sl.activity_id,
          a.name as activity_name,
          sl.service_date,
          sl.is_draft,
          sl.submitted_at,
          COALESCE(COUNT(pe.id), 0) as total_appointments,
          COALESCE(SUM(CASE WHEN pe.appointment_type = 'new' THEN 1 ELSE 0 END), 0) as new_appointments,
          COALESCE(SUM(CASE WHEN pe.appointment_type = 'followup' THEN 1 ELSE 0 END), 0) as followup_appointments,
          COALESCE(SUM(CASE WHEN pe.appointment_type = 'dna' THEN 1 ELSE 0 END), 0) as dna_appointments,
          sl.created_at,
          sl.updated_at
        FROM service_logs sl
        LEFT JOIN clients c ON sl.client_id = c.id
        LEFT JOIN activities a ON sl.activity_id = a.id
        LEFT JOIN patient_entries pe ON sl.id = pe.service_log_id AND (pe.deleted_at IS NULL OR pe.deleted_at = '')
        WHERE (sl.deleted_at IS NULL OR sl.deleted_at = '')
        GROUP BY sl.id, c.name, a.name
      `);
      
      logger.info('✓ Reporting view refreshed successfully');
    } catch (error) {
      logger.error('Failed to refresh reporting view', { error });
    }
  }

  private updateDatabaseStatistics(): void {
    logger.info('Updating database statistics');
    
    try {
      // Basic table statistics
      const tables = ['service_logs', 'patient_entries', 'users', 'clients', 'activities', 'outcomes'];
      
      for (const table of tables) {
        const result = db.get(`SELECT COUNT(*) as count FROM ${table}`) as { count: number };
        
        db.run(`
          INSERT OR REPLACE INTO database_statistics (metric_name, metric_value, last_updated)
          VALUES (?, ?, datetime('now'))
        `, [`${table}_count`, result.count.toString()]);
      }
      
      // Healthcare-specific metrics
      const draftsCount = db.get(`SELECT COUNT(*) as count FROM service_logs WHERE is_draft = 1`) as { count: number };
      db.run(`
        INSERT OR REPLACE INTO database_statistics (metric_name, metric_value, last_updated)
        VALUES (?, ?, datetime('now'))
      `, ['draft_service_logs_count', draftsCount.count.toString()]);
      
      const totalPatients = db.get(`SELECT COALESCE(SUM(patient_count), 0) as total FROM service_logs`) as { total: number };
      db.run(`
        INSERT OR REPLACE INTO database_statistics (metric_name, metric_value, last_updated)
        VALUES (?, ?, datetime('now'))
      `, ['total_patients_served', totalPatients.total.toString()]);
      
      logger.info('✓ Database statistics updated successfully');
    } catch (error) {
      logger.error('Failed to update database statistics', { error });
    }
  }

  public async migrate(): Promise<void> {
    logger.info('Starting database migration process');
    
    try {
      // Create migrations table if it doesn't exist
      if (this.migrations.length > 0) {
        this.migrations[0].up();
      }
      
      // Get current version
      const currentVersion = this.getCurrentVersion();
      logger.info(`Current database version: ${currentVersion}`);
      
      // Apply pending migrations
      const pendingMigrations = this.migrations.filter(m => m.version > currentVersion);
      
      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations');
        return;
      }
      
      logger.info(`Applying ${pendingMigrations.length} pending migrations`);
      
      for (const migration of pendingMigrations) {
        const startTime = Date.now();
        
        logger.info(`Applying migration ${migration.version}: ${migration.description}`);
        
        try {
          // Run migration in transaction
          db.transaction(() => {
            migration.up();
            
            // Record migration
            db.run(`
              INSERT INTO database_migrations (version, description, applied_at, execution_time_ms)
              VALUES (?, ?, datetime('now'), ?)
            `, [migration.version, migration.description, Date.now() - startTime]);
          })();
          
          logger.info(`✓ Migration ${migration.version} completed in ${Date.now() - startTime}ms`);
        } catch (error) {
          logger.error(`Failed to apply migration ${migration.version}`, { error });
          throw error;
        }
      }
      
      logger.info('All migrations completed successfully');
    } catch (error) {
      logger.error('Migration process failed', { error });
      throw error;
    }
  }

  public async rollback(targetVersion: number): Promise<void> {
    logger.info(`Rolling back to version ${targetVersion}`);
    
    const currentVersion = this.getCurrentVersion();
    const migrationsToRollback = this.migrations
      .filter(m => m.version > targetVersion && m.version <= currentVersion)
      .sort((a, b) => b.version - a.version); // Descending order
    
    for (const migration of migrationsToRollback) {
      if (migration.down) {
        logger.info(`Rolling back migration ${migration.version}: ${migration.description}`);
        
        try {
          db.transaction(() => {
            migration.down!();
            db.run(`DELETE FROM database_migrations WHERE version = ?`, [migration.version]);
          })();
          
          logger.info(`✓ Rolled back migration ${migration.version}`);
        } catch (error) {
          logger.error(`Failed to rollback migration ${migration.version}`, { error });
          throw error;
        }
      }
    }
  }

  private getCurrentVersion(): number {
    try {
      const result = db.get(`
        SELECT MAX(version) as version FROM database_migrations
      `) as { version: number | null };
      
      return result?.version || 0;
    } catch (error) {
      // Migrations table doesn't exist yet
      return 0;
    }
  }

  public getMigrationStatus(): Array<{ version: number; description: string; applied: boolean; appliedAt?: string }> {
    const currentVersion = this.getCurrentVersion();
    
    return this.migrations.map(migration => ({
      version: migration.version,
      description: migration.description,
      applied: migration.version <= currentVersion,
      appliedAt: migration.version <= currentVersion 
        ? (db.get(`SELECT applied_at FROM database_migrations WHERE version = ?`, [migration.version]) as any)?.applied_at
        : undefined
    }));
  }
}

// Export singleton instance
export const migrator = new DatabaseMigrator();

// Legacy export for compatibility
export default async function migrate(): Promise<void> {
  await migrator.migrate();
}