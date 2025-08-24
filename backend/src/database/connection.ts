// Database connection following SQLite documentation patterns
import Database from 'better-sqlite3';
import { logger } from '@/utils/logger';

class DatabaseConnection {
  private db: Database.Database;

  constructor() {
    const dbPath = process.env.NODE_ENV === 'test' 
      ? ':memory:' 
      : (process.env.DB_PATH || './healthcare.db');
    
    this.db = new Database(dbPath);
    
    // Enable foreign key constraints
    this.db.pragma('foreign_keys = ON');
    
    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    
    // Set busy timeout to 30 seconds
    this.db.pragma('busy_timeout = 30000');
    
    // Optimize performance
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 1000000');
    this.db.pragma('temp_store = memory');
    
    logger.info('Database connected', { path: dbPath });
  }

  getDb(): Database.Database {
    return this.db;
  }

  close(): void {
    this.db.close();
    logger.info('Database connection closed');
  }

  // Direct access methods for better-sqlite3
  prepare(sql: string) {
    return this.db.prepare(sql);
  }

  exec(sql: string) {
    return this.db.exec(sql);
  }

  run(sql: string, params?: any[]): Database.RunResult {
    return this.db.prepare(sql).run(...(params || []));
  }

  get(sql: string, params?: any[]): any {
    return this.db.prepare(sql).get(...(params || []));
  }

  all(sql: string, params?: any[]): any[] {
    return this.db.prepare(sql).all(...(params || []));
  }

  // Transaction support
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }
}

export const dbConnection = new DatabaseConnection();
export { dbConnection as db };