// Database schema following SQLite documentation patterns
import { db } from './connection';
import { logger } from '@/utils/logger';

export function createTables(): void {
  logger.info('Creating database tables');

  // Users table for authentication - following documented patterns
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'candidate')),
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      last_login_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    )
  `);

  // Clients/Sites table - following healthcare domain patterns
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    )
  `);

  // Activities/Specialties table - following healthcare domain patterns
  db.exec(`
    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    )
  `);

  // Outcomes table - following healthcare domain patterns
  db.exec(`
    CREATE TABLE IF NOT EXISTS outcomes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    )
  `);

  // Service Logs table - main healthcare service tracking entity
  db.exec(`
    CREATE TABLE IF NOT EXISTS service_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      client_id INTEGER NOT NULL,
      activity_id INTEGER NOT NULL,
      service_date TEXT NOT NULL,
      patient_count INTEGER NOT NULL DEFAULT 0,
      is_draft INTEGER DEFAULT 0,
      submitted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (activity_id) REFERENCES activities(id)
    )
  `);

  // Patient Entries table - appointment-based structure (Phase 3.5)
  db.exec(`
    CREATE TABLE IF NOT EXISTS patient_entries (
      id TEXT PRIMARY KEY,
      service_log_id TEXT NOT NULL,
      appointment_type TEXT NOT NULL CHECK (appointment_type IN ('new', 'followup', 'dna')),
      outcome_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT,
      FOREIGN KEY (service_log_id) REFERENCES service_logs(id) ON DELETE CASCADE,
      FOREIGN KEY (outcome_id) REFERENCES outcomes(id)
    )
  `);

  // Note: Custom field tables removed in Phase 7.1 cleanup
  // These tables (custom_fields, field_choices, custom_field_values) were causing
  // performance issues and were disabled in Phase 6.6. Removed to improve client selection performance.

  // Audit log for tracking changes - following documented audit patterns
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
      old_values TEXT, -- JSON
      new_values TEXT, -- JSON
      user_id TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  // Enable WAL mode and optimize SQLite settings for performance
  try {
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = -64000'); // 64MB cache
    db.pragma('temp_store = memory');
    db.pragma('mmap_size = 268435456'); // 256MB mmap
    db.pragma('optimize');
    logger.info('✓ SQLite performance settings applied');
  } catch (error) {
    logger.warn('⚠️ Could not apply all SQLite performance settings', { error });
  }

  createIndexes();
  logger.info('Database tables created successfully');
}

function createIndexes(): void {
  logger.info('Creating performance indexes');
  
  // User indexes - authentication performance
  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_username ON users (username)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_is_active ON users (is_active)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_role_active ON users (role, is_active)`);
  
  // Service log indexes - critical for reporting performance
  db.exec(`CREATE INDEX IF NOT EXISTS idx_service_logs_user ON service_logs (user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_service_logs_client ON service_logs (client_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_service_logs_activity ON service_logs (activity_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_service_logs_created_at ON service_logs (created_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_service_logs_submitted_at ON service_logs (submitted_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_service_logs_is_draft ON service_logs (is_draft)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_service_logs_service_date ON service_logs (service_date)`);
  
  // Composite indexes for common query patterns
  db.exec(`CREATE INDEX IF NOT EXISTS idx_service_logs_user_draft ON service_logs (user_id, is_draft)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_service_logs_user_date ON service_logs (user_id, service_date)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_service_logs_client_date ON service_logs (client_id, service_date)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_service_logs_activity_date ON service_logs (activity_id, service_date)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_service_logs_date_range ON service_logs (service_date, created_at)`);
  
  // Patient entries indexes - critical for export performance
  db.exec(`CREATE INDEX IF NOT EXISTS idx_patient_entries_service_log ON patient_entries (service_log_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_patient_entries_outcome ON patient_entries (outcome_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_patient_entries_appointment_type ON patient_entries (appointment_type)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_patient_entries_service_log_created ON patient_entries (service_log_id, created_at)`);
  
  // Note: Custom field indexes removed in Phase 7.1 cleanup
  // 7 indexes removed to improve performance and eliminate unused infrastructure
  
  // Reference data indexes - lookup performance
  db.exec(`CREATE INDEX IF NOT EXISTS idx_clients_active ON clients (is_active)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_clients_name ON clients (name)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_activities_active ON activities (is_active)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_activities_name ON activities (name)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_outcomes_active ON outcomes (is_active)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_outcomes_name ON outcomes (name)`);
  
  // Audit log indexes - monitoring and compliance
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_table_record ON audit_log (table_name, record_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log (timestamp)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log (user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log (action)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_user_timestamp ON audit_log (user_id, timestamp)`);
  
  logger.info('Performance indexes created successfully');
}

export function dropTables(): void {
  logger.info('Dropping database tables');
  
  // Drop in reverse order to respect foreign key constraints
  // Note: Custom field tables removed in Phase 7.1 - no longer exist
  db.exec(`DROP TABLE IF EXISTS patient_entries`);
  db.exec(`DROP TABLE IF EXISTS service_logs`);
  db.exec(`DROP TABLE IF EXISTS outcomes`);
  db.exec(`DROP TABLE IF EXISTS activities`);
  db.exec(`DROP TABLE IF EXISTS clients`);
  db.exec(`DROP TABLE IF EXISTS audit_log`);
  db.exec(`DROP TABLE IF EXISTS users`);
  
  logger.info('Database tables dropped');
}

// Initialize schema
export function initializeSchema(): void {
  try {
    createTables();
    logger.info('Database schema initialized');
  } catch (error) {
    logger.error('Failed to initialize database schema', { 
      error: {
        message: error instanceof Error ? error.message : String(error),
        code: (error as any)?.code,
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    throw error;
  }
}