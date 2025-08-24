// Database schema following SQLite documentation patterns
import { db } from './connection.js';
import { logger } from '@/utils/logger.js';

export async function createTables(): Promise<void> {
  logger.info('Creating database tables');

  // Users table for authentication
  await db.run(`
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
      updated_at TEXT NOT NULL
    )
  `);

  // Audit log for tracking changes
  await db.run(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
      old_values TEXT, -- JSON
      new_values TEXT, -- JSON
      user_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  // Create indexes for performance
  await db.run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_users_username ON users (username)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_users_is_active ON users (is_active)`);
  
  await db.run(`CREATE INDEX IF NOT EXISTS idx_audit_table_record ON audit_log (table_name, record_id)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log (timestamp)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log (user_id)`);

  logger.info('Database tables created successfully');
}

export async function dropTables(): Promise<void> {
  logger.info('Dropping database tables');
  
  await db.run(`DROP TABLE IF EXISTS audit_log`);
  await db.run(`DROP TABLE IF EXISTS users`);
  
  logger.info('Database tables dropped');
}

// Initialize schema
export async function initializeSchema(): Promise<void> {
  try {
    await createTables();
    logger.info('Database schema initialized');
  } catch (error) {
    logger.error('Failed to initialize database schema', { error });
    throw error;
  }
}