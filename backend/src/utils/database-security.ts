// Database security utilities following SQLite documentation patterns
import Database from 'better-sqlite3';
import crypto from 'crypto';
import { logger } from './logger';

// SQL injection prevention utilities
export class SQLSecurityUtils {
  private static readonly DANGEROUS_PATTERNS = [
    /('|(\-\-)|;|\||\*|%|\+|,|\.|\?|@|\[|\]|\{|\}|\$|#|\^|&|\(|\)|\!|<|>|=|~|`)/gi,
    /((union|select|insert|update|delete|drop|create|alter|exec|execute|script)\s)/gi,
    /(information_schema|sysobjects|syscolumns|syslogins|sysusers)/gi,
    /(xp_|sp_)/gi,
    /(\b(eval|system|exec)\b)/gi
  ];

  /**
   * Validate and sanitize SQL input to prevent injection attacks
   */
  static sanitizeInput(input: string): string {
    if (typeof input !== 'string') {
      return String(input);
    }

    // Remove null bytes and control characters
    let sanitized = input.replace(/[\x00-\x1F\x7F-\x9F]/g, '');

    // Remove dangerous SQL keywords and patterns
    const dangerousPatterns = [
      /DROP\s+TABLE/gi,
      /DELETE\s+FROM/gi,
      /INSERT\s+INTO/gi,
      /UPDATE\s+SET/gi,
      /UNION\s+SELECT/gi,
      /--/g,
      /;\s*$/g
    ];

    dangerousPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });

    // Escape dangerous characters
    sanitized = sanitized
      .replace(/'/g, "''") // Escape single quotes
      .replace(/\\/g, '\\\\') // Escape backslashes
      .replace(/\x00/g, '\\0') // Escape null bytes
      .replace(/\n/g, '\\n') // Escape newlines
      .replace(/\r/g, '\\r') // Escape carriage returns
      .replace(/\x1a/g, '\\Z') // Escape EOF character
      .trim();

    return sanitized;
  }

  /**
   * Validate that a query is safe for execution
   */
  static validateQuery(query: string): boolean {
    const normalizedQuery = query.toLowerCase().trim();
    
    // Allow common safe queries
    const safePatterns = [
      /^select\s+.+\s+from\s+\w+\s+where\s+.+\s*=\s*\?/,
      /^insert\s+into\s+\w+\s*\(.+\)\s*values\s*\(.+\)/,
      /^update\s+\w+\s+set\s+.+\s+where\s+.+\s*=\s*\?/,
      /^delete\s+from\s+\w+\s+where\s+.+\s*=\s*\?/
    ];
    
    // Check if query matches safe patterns
    const isSafe = safePatterns.some(pattern => pattern.test(normalizedQuery));
    if (isSafe) return true;
    
    // Check for dangerous patterns
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(normalizedQuery)) {
        logger.warn('Potentially dangerous SQL pattern detected', {
          query: query.substring(0, 100),
          pattern: pattern.toString()
        });
        return false;
      }
    }

    // Ensure query uses parameterized statements
    const parameterCount = (query.match(/\?/g) || []).length;
    const suspiciousConcat = /(\+|\||concat)/gi.test(query) && !query.includes('?');
    
    if (suspiciousConcat && parameterCount === 0) {
      logger.warn('Query appears to use string concatenation instead of parameters', {
        query: query.substring(0, 100)
      });
      return false;
    }

    return true;
  }

  /**
   * Create a parameterized query safely
   */
  static createParameterizedQuery(db: Database.Database, sql: string): Database.Statement {
    if (!this.validateQuery(sql)) {
      throw new Error('Query failed security validation');
    }

    try {
      return db.prepare(sql);
    } catch (error) {
      logger.error('Failed to prepare SQL statement', { sql, error });
      throw new Error('Failed to prepare database query');
    }
  }
}

// Database audit logging
export class DatabaseAuditLogger {
  private static auditDb: Database.Database | null = null;
  
  static initialize(dbPath: string): void {
    try {
      this.auditDb = new Database(dbPath);
      this.auditDb.pragma('journal_mode = WAL');
      this.auditDb.pragma('foreign_keys = ON');
      
      // Create audit table if it doesn't exist
      this.auditDb.exec(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          user_id TEXT,
          action TEXT NOT NULL,
          table_name TEXT NOT NULL,
          record_id TEXT,
          old_values TEXT,
          new_values TEXT,
          ip_address TEXT,
          user_agent TEXT,
          timestamp TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
          query_hash TEXT,
          CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'SELECT'))
        )
      `);
      
      logger.info('Database audit logging initialized');
    } catch (error) {
      logger.error('Failed to initialize audit logging', { error });
    }
  }

  static logQuery(
    userId: string | null,
    action: 'INSERT' | 'UPDATE' | 'DELETE' | 'SELECT',
    tableName: string,
    recordId?: string,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>,
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
      queryHash?: string;
    }
  ): void {
    if (!this.auditDb) {
      logger.warn('Audit database not initialized');
      return;
    }

    try {
      const stmt = this.auditDb.prepare(`
        INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent, query_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        userId,
        action,
        tableName,
        recordId || null,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        metadata?.ipAddress || null,
        metadata?.userAgent || null,
        metadata?.queryHash || null
      );
    } catch (error) {
      logger.error('Failed to log database audit event', { error, action, tableName });
    }
  }

  static getAuditLogs(filters: {
    userId?: string;
    tableName?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  } = {}): any[] {
    if (!this.auditDb) {
      return [];
    }

    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];

    if (filters.userId) {
      query += ' AND user_id = ?';
      params.push(filters.userId);
    }

    if (filters.tableName) {
      query += ' AND table_name = ?';
      params.push(filters.tableName);
    }

    if (filters.action) {
      query += ' AND action = ?';
      params.push(filters.action);
    }

    if (filters.startDate) {
      query += ' AND timestamp >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND timestamp <= ?';
      params.push(filters.endDate);
    }

    query += ' ORDER BY timestamp DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    try {
      const stmt = this.auditDb.prepare(query);
      return stmt.all(...params);
    } catch (error) {
      logger.error('Failed to retrieve audit logs', { error, filters });
      return [];
    }
  }
}

// Data encryption utilities for sensitive fields
export class DataEncryption {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static encryptionKey: Buffer | null = null;

  static initialize(key?: string): void {
    if (key) {
      this.encryptionKey = Buffer.from(key, 'hex');
    } else {
      // Generate a key from environment variable or create one
      const envKey = process.env.DATABASE_ENCRYPTION_KEY;
      if (envKey) {
        this.encryptionKey = Buffer.from(envKey, 'hex');
      } else {
        this.encryptionKey = crypto.randomBytes(32);
        logger.warn('No encryption key provided, generated temporary key. Data will not be decryptable after restart.');
      }
    }
  }

  static encrypt(text: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(this.ALGORITHM, this.encryptionKey);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = (cipher as any).getAuthTag();
      
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    } catch (error) {
      logger.error('Encryption failed', { error });
      throw new Error('Failed to encrypt data');
    }
  }

  static decrypt(encryptedText: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    try {
      const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
      
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      
      const decipher = crypto.createDecipher(this.ALGORITHM, this.encryptionKey);
      (decipher as any).setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Decryption failed', { error });
      throw new Error('Failed to decrypt data');
    }
  }

  static isEncrypted(text: string): boolean {
    return typeof text === 'string' && text.includes(':') && text.split(':').length === 3;
  }
}

// Secure database connection manager
export class SecureDatabaseConnection {
  private static connections = new Map<string, Database.Database>();
  
  static create(path: string, options: {
    readonly?: boolean;
    timeout?: number;
    verbose?: boolean;
    pragma?: Record<string, string | number>;
  } = {}): Database.Database {
    const connectionKey = `${path}:${JSON.stringify(options)}`;
    
    if (this.connections.has(connectionKey)) {
      return this.connections.get(connectionKey)!;
    }

    try {
      const db = new Database(path, {
        readonly: options.readonly || false,
        timeout: options.timeout || 5000,
        verbose: options.verbose ? logger.debug : undefined
      });

      // Set secure pragmas
      db.pragma('journal_mode = WAL'); // Better concurrency
      db.pragma('foreign_keys = ON'); // Enforce referential integrity
      db.pragma('secure_delete = ON'); // Overwrite deleted data
      db.pragma('cell_size_check = ON'); // Additional integrity checks
      
      // Apply custom pragmas
      if (options.pragma) {
        Object.entries(options.pragma).forEach(([key, value]) => {
          db.pragma(`${key} = ${value}`);
        });
      }

      // Test connection
      db.prepare('SELECT 1').get();
      
      // Set up connection monitoring
      this.setupConnectionMonitoring(db, path);
      
      this.connections.set(connectionKey, db);
      logger.info('Secure database connection established', { path, options });
      
      return db;
    } catch (error) {
      logger.error('Failed to create secure database connection', { path, error });
      throw new Error('Database connection failed');
    }
  }

  private static setupConnectionMonitoring(db: Database.Database, path: string): void {
    // Monitor for suspicious activity
    const originalPrepare = db.prepare;
    db.prepare = function(sql: string) {
      // Log potentially dangerous queries
      if (SQLSecurityUtils.validateQuery(sql)) {
        return originalPrepare.call(this, sql);
      } else {
        logger.error('Blocked potentially dangerous SQL query', { 
          sql: sql.substring(0, 100),
          path 
        });
        throw new Error('Query blocked by security validation');
      }
    };
  }

  static closeAll(): void {
    this.connections.forEach((db, key) => {
      try {
        db.close();
        logger.info('Database connection closed', { key });
      } catch (error) {
        logger.error('Error closing database connection', { key, error });
      }
    });
    
    this.connections.clear();
  }

  static getConnectionStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    this.connections.forEach((db, key) => {
      try {
        const info = db.pragma('database_list');
        stats[key] = {
          connected: true,
          info
        };
      } catch (error) {
        stats[key] = {
          connected: false,
          error: error.message
        };
      }
    });
    
    return stats;
  }
}

// Database integrity checking
export class DatabaseIntegrityChecker {
  static checkIntegrity(db: Database.Database): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const result = {
      isValid: true,
      errors: [] as string[],
      warnings: [] as string[]
    };

    try {
      // Check database integrity
      const integrityCheck = db.pragma('integrity_check');
      
      if (integrityCheck.length === 0 || integrityCheck[0].integrity_check !== 'ok') {
        result.isValid = false;
        result.errors.push('Database integrity check failed');
        result.errors.push(...integrityCheck.map((check: any) => check.integrity_check));
      }

      // Check foreign key constraints
      const foreignKeyCheck = db.pragma('foreign_key_check');
      if (foreignKeyCheck.length > 0) {
        result.warnings.push('Foreign key constraint violations found');
        result.warnings.push(...foreignKeyCheck.map((fk: any) => 
          `Table: ${fk.table}, Row: ${fk.rowid}, Parent: ${fk.parent}, Constraint: ${fk.fkid}`
        ));
      }

      // Check for suspicious table modifications
      const tableList = db.pragma('table_list');
      const suspiciousTables = tableList.filter((table: any) => 
        table.name.toLowerCase().includes('temp') || 
        table.name.toLowerCase().includes('tmp') ||
        table.name.startsWith('sqlite_')
      );
      
      if (suspiciousTables.length > 0) {
        result.warnings.push('Suspicious tables detected');
        result.warnings.push(...suspiciousTables.map((table: any) => table.name));
      }

    } catch (error) {
      result.isValid = false;
      result.errors.push(`Integrity check failed: ${error.message}`);
    }

    return result;
  }

  static performSecurityScan(db: Database.Database): {
    securityScore: number;
    vulnerabilities: string[];
    recommendations: string[];
  } {
    const result = {
      securityScore: 100,
      vulnerabilities: [] as string[],
      recommendations: [] as string[]
    };

    try {
      // Check pragma settings
      const pragmas = {
        foreign_keys: db.pragma('foreign_keys'),
        secure_delete: db.pragma('secure_delete'),
        journal_mode: db.pragma('journal_mode')
      };

      if (!pragmas.foreign_keys[0]?.foreign_keys) {
        result.securityScore -= 10;
        result.vulnerabilities.push('Foreign key constraints not enabled');
        result.recommendations.push('Enable foreign key constraints with PRAGMA foreign_keys = ON');
      }

      if (!pragmas.secure_delete[0]?.secure_delete) {
        result.securityScore -= 15;
        result.vulnerabilities.push('Secure delete not enabled');
        result.recommendations.push('Enable secure delete with PRAGMA secure_delete = ON');
      }

      if (pragmas.journal_mode[0]?.journal_mode !== 'wal') {
        result.securityScore -= 5;
        result.recommendations.push('Consider using WAL mode for better concurrency and crash recovery');
      }

      // Check for encrypted database
      try {
        // This would fail if database is encrypted
        db.prepare('SELECT name FROM sqlite_master').all();
        result.securityScore -= 20;
        result.vulnerabilities.push('Database is not encrypted');
        result.recommendations.push('Consider using SQLite encryption extension for sensitive data');
      } catch (error) {
        // Database might be encrypted, which is good
      }

    } catch (error) {
      result.securityScore = 0;
      result.vulnerabilities.push(`Security scan failed: ${error.message}`);
    }

    return result;
  }
}

// Initialize security utilities
if (process.env.DATABASE_ENCRYPTION_KEY) {
  DataEncryption.initialize();
}

if (process.env.AUDIT_DB_PATH) {
  DatabaseAuditLogger.initialize(process.env.AUDIT_DB_PATH);
}

// Cleanup on process exit
process.on('SIGINT', () => {
  SecureDatabaseConnection.closeAll();
});

process.on('SIGTERM', () => {
  SecureDatabaseConnection.closeAll();
});
