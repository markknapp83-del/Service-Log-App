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
      FOREIGN KEY (service_log_id) REFERENCES service_logs(id) ON DELETE CASCADE,
      FOREIGN KEY (outcome_id) REFERENCES outcomes(id)
    )
  `);

  try {
    // Custom Fields table - for dynamic form fields (client-specific support)
    db.exec(`
      CREATE TABLE IF NOT EXISTS custom_fields (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        field_label TEXT NOT NULL,
        field_type TEXT DEFAULT 'dropdown' CHECK (field_type IN ('dropdown', 'text', 'number', 'checkbox')),
        field_order INTEGER,
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (client_id) REFERENCES clients(id)
      )
    `);
    logger.info('✓ Custom Fields table with client_id created');
  } catch (error) {
    logger.error('❌ Failed to create custom_fields table', { error });
    throw error;
  }

  // Custom Field Choices table - for dropdown options
  db.exec(`
    CREATE TABLE IF NOT EXISTS field_choices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      field_id INTEGER NOT NULL,
      choice_text TEXT NOT NULL,
      choice_order INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (field_id) REFERENCES custom_fields(id) ON DELETE CASCADE
    )
  `);

  // Custom Field Values table - stores dynamic field values
  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_field_values (
      id TEXT PRIMARY KEY,
      patient_entry_id TEXT NOT NULL,
      field_id INTEGER NOT NULL,
      choice_id INTEGER,
      text_value TEXT,
      number_value REAL,
      checkbox_value INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (patient_entry_id) REFERENCES patient_entries(id) ON DELETE CASCADE,
      FOREIGN KEY (field_id) REFERENCES custom_fields(id),
      FOREIGN KEY (choice_id) REFERENCES field_choices(id)
    )
  `);

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

  createIndexes();
  logger.info('Database tables created successfully');
}

function createIndexes(): void {
  // Create indexes for performance - following documented optimization patterns
  
  // User indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_username ON users (username)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_is_active ON users (is_active)`);
  
  // Service log indexes - critical for performance
  db.exec(`CREATE INDEX IF NOT EXISTS idx_service_logs_user ON service_logs (user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_service_logs_client ON service_logs (client_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_service_logs_activity ON service_logs (activity_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_service_logs_created_at ON service_logs (created_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_service_logs_submitted_at ON service_logs (submitted_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_service_logs_is_draft ON service_logs (is_draft)`);
  
  // Patient entries indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_patient_entries_service_log ON patient_entries (service_log_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_patient_entries_outcome ON patient_entries (outcome_id)`);
  
  // Custom field indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_custom_fields_active ON custom_fields (is_active, field_order)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_custom_fields_client ON custom_fields (client_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_custom_fields_client_active ON custom_fields (client_id, is_active, field_order)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_field_choices_field ON field_choices (field_id, choice_order)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_custom_field_values_entry ON custom_field_values (patient_entry_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_custom_field_values_field ON custom_field_values (field_id)`);
  
  // Reference data indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_clients_active ON clients (is_active)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_activities_active ON activities (is_active)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_outcomes_active ON outcomes (is_active)`);
  
  // Audit log indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_table_record ON audit_log (table_name, record_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log (timestamp)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log (user_id)`);
}

export function dropTables(): void {
  logger.info('Dropping database tables');
  
  // Drop in reverse order to respect foreign key constraints
  db.exec(`DROP TABLE IF EXISTS custom_field_values`);
  db.exec(`DROP TABLE IF EXISTS field_choices`);
  db.exec(`DROP TABLE IF EXISTS custom_fields`);
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