// Migration system following SQLite documentation patterns
import { db } from './connection';
import { logger } from '@/utils/logger';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MigrationRunner {
  private migrationsTable = 'migrations';

  constructor() {
    this.ensureMigrationsTable();
  }

  private ensureMigrationsTable(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.migrationsTable} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT UNIQUE NOT NULL,
        executed_at TEXT NOT NULL DEFAULT (datetime('now')),
        checksum TEXT
      )
    `);
  }

  async runMigrations(): Promise<void> {
    const migrationDir = path.join(__dirname, '..', '..', 'database', 'migrations');
    
    // Create migrations directory if it doesn't exist
    if (!fs.existsSync(migrationDir)) {
      fs.mkdirSync(migrationDir, { recursive: true });
      logger.info('Created migrations directory', { path: migrationDir });
    }

    const files = fs.readdirSync(migrationDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Execute in alphabetical order

    const executedMigrations = db.prepare(`SELECT filename FROM ${this.migrationsTable}`)
      .all()
      .map((row: any) => row.filename);

    logger.info('Found migrations', { 
      total: files.length, 
      executed: executedMigrations.length,
      pending: files.filter(f => !executedMigrations.includes(f)).length
    });

    for (const file of files) {
      if (!executedMigrations.includes(file)) {
        await this.executeMigration(file, migrationDir);
      }
    }

    logger.info('Migration run completed');
  }

  private async executeMigration(filename: string, migrationDir: string): Promise<void> {
    const filePath = path.join(migrationDir, filename);
    const sql = fs.readFileSync(filePath, 'utf8');
    const checksum = this.calculateChecksum(sql);

    const transaction = db.transaction(() => {
      try {
        // Execute the migration SQL
        db.exec(sql);
        
        // Record the migration
        db.prepare(`
          INSERT INTO ${this.migrationsTable} (filename, checksum) 
          VALUES (?, ?)
        `).run(filename, checksum);
        
        logger.info('Migration executed successfully', { filename });
      } catch (error) {
        logger.error('Migration failed', { filename, error });
        throw error;
      }
    });

    transaction();
  }

  async rollbackLastMigration(): Promise<void> {
    const lastMigration = db.prepare(`
      SELECT filename FROM ${this.migrationsTable} 
      ORDER BY executed_at DESC 
      LIMIT 1
    `).get() as any;

    if (!lastMigration) {
      logger.info('No migrations to rollback');
      return;
    }

    // Note: SQLite doesn't support DDL rollback easily
    // This is a placeholder for rollback logic
    logger.warn('Migration rollback requested but not implemented', { 
      filename: lastMigration.filename 
    });
    
    throw new Error('Migration rollback not implemented for SQLite. Please create a new migration to reverse changes.');
  }

  createMigration(name: string): string {
    const timestamp = new Date().toISOString()
      .replace(/[:\-T]/g, '')
      .slice(0, 14);
    const filename = `${timestamp}_${name.replace(/\s+/g, '_').toLowerCase()}.sql`;
    const migrationDir = path.join(__dirname, '..', '..', 'database', 'migrations');
    const filePath = path.join(migrationDir, filename);

    if (!fs.existsSync(migrationDir)) {
      fs.mkdirSync(migrationDir, { recursive: true });
    }

    const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}
-- Description: Add your migration description here

-- Add your SQL DDL statements here
-- Example:
-- ALTER TABLE users ADD COLUMN new_column TEXT;

-- Don't forget to add corresponding indexes if needed
-- CREATE INDEX IF NOT EXISTS idx_table_column ON table_name (column);
`;

    fs.writeFileSync(filePath, template);
    logger.info('Migration file created', { filename, path: filePath });
    
    return filePath;
  }

  async getMigrationStatus(): Promise<{
    executed: Array<{ filename: string; executedAt: string }>;
    pending: string[];
  }> {
    const migrationDir = path.join(__dirname, '..', '..', 'database', 'migrations');
    
    const allFiles = fs.existsSync(migrationDir) 
      ? fs.readdirSync(migrationDir).filter(file => file.endsWith('.sql')).sort()
      : [];

    const executedMigrations = db.prepare(`
      SELECT filename, executed_at as executedAt 
      FROM ${this.migrationsTable} 
      ORDER BY executed_at
    `).all() as Array<{ filename: string; executedAt: string }>;

    const executedFilenames = executedMigrations.map(m => m.filename);
    const pending = allFiles.filter(f => !executedFilenames.includes(f));

    return {
      executed: executedMigrations,
      pending
    };
  }

  private calculateChecksum(content: string): string {
    // Simple checksum for migration integrity
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  async validateMigrations(): Promise<boolean> {
    const migrationDir = path.join(__dirname, '..', '..', 'database', 'migrations');
    
    if (!fs.existsSync(migrationDir)) {
      return true; // No migrations to validate
    }

    const executedMigrations = db.prepare(`
      SELECT filename, checksum 
      FROM ${this.migrationsTable}
    `).all() as Array<{ filename: string; checksum: string }>;

    for (const migration of executedMigrations) {
      const filePath = path.join(migrationDir, migration.filename);
      
      if (!fs.existsSync(filePath)) {
        logger.error('Migration file missing', { filename: migration.filename });
        return false;
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const currentChecksum = this.calculateChecksum(content);

      if (currentChecksum !== migration.checksum) {
        logger.error('Migration checksum mismatch', { 
          filename: migration.filename,
          expected: migration.checksum,
          actual: currentChecksum
        });
        return false;
      }
    }

    logger.info('All migrations validated successfully');
    return true;
  }
}

export const migrationRunner = new MigrationRunner();