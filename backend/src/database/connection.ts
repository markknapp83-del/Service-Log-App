// Database connection following SQLite documentation patterns
import sqlite3 from 'sqlite3';
import { logger } from '@/utils/logger.js';

class DatabaseConnection {
  private db: sqlite3.Database;

  constructor() {
    const dbPath = process.env.NODE_ENV === 'test' 
      ? ':memory:' 
      : (process.env.DB_PATH || './healthcare.db');
    
    this.db = new sqlite3.Database(dbPath);
    
    // Enable foreign key constraints
    this.db.run('PRAGMA foreign_keys = ON');
    
    // Enable WAL mode for better concurrency
    this.db.run('PRAGMA journal_mode = WAL');
    
    // Set busy timeout to 30 seconds
    this.db.run('PRAGMA busy_timeout = 30000');
    
    // Optimize performance
    this.db.run('PRAGMA synchronous = NORMAL');
    this.db.run('PRAGMA cache_size = 1000000');
    this.db.run('PRAGMA temp_store = memory');
    
    logger.info('Database connected', { path: dbPath });
  }

  getDb(): sqlite3.Database {
    return this.db;
  }

  close(): void {
    this.db.close();
    logger.info('Database connection closed');
  }

  // Promise wrapper for run operations
  run(sql: string, params?: any[]): Promise<sqlite3.RunResult> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params || [], function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  // Promise wrapper for get operations
  get(sql: string, params?: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params || [], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  // Promise wrapper for all operations
  all(sql: string, params?: any[]): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params || [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

export const dbConnection = new DatabaseConnection();
export { dbConnection as db };