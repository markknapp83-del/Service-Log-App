# SQLite & better-sqlite3 Documentation for Healthcare Service Log Portal

## Overview
SQLite with better-sqlite3 provides a lightweight, serverless database solution perfect for healthcare applications requiring fast, reliable data storage with ACID compliance and strong data integrity.

## Installation and Setup

### Installation
```bash
npm install better-sqlite3
npm install --save-dev @types/better-sqlite3
```

### Basic Database Setup
```javascript
// database/connection.js
import Database from 'better-sqlite3';
import { logger } from '../utils/logger.js';

class DatabaseConnection {
  constructor() {
    const dbPath = process.env.NODE_ENV === 'test' ? ':memory:' : (process.env.DB_PATH || './healthcare.db');
    
    this.db = new Database(dbPath);
    
    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    
    // Enable foreign key constraints
    this.db.pragma('foreign_keys = ON');
    
    // Set busy timeout to 30 seconds
    this.db.pragma('busy_timeout = 30000');
    
    // Optimize performance
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 1000000');
    this.db.pragma('temp_store = memory');
    
    logger.info('Database connected', { path: dbPath });
  }

  getDb() {
    return this.db;
  }

  close() {
    this.db.close();
    logger.info('Database connection closed');
  }
}

export const dbConnection = new DatabaseConnection();
export const db = dbConnection.getDb();
```

## Schema Design for Healthcare

### Database Schema
```sql
-- database/schema.sql

-- Users table for authentication and authorization
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'provider', 'staff')),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  department TEXT,
  license_number TEXT,
  is_active BOOLEAN DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Patients table
CREATE TABLE patients (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth TEXT NOT NULL, -- ISO date string
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  emergency_contact TEXT NOT NULL, -- JSON string
  insurance_info TEXT, -- JSON string
  medical_record_number TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  created_by TEXT NOT NULL,
  updated_by TEXT,
  FOREIGN KEY (created_by) REFERENCES users (id),
  FOREIGN KEY (updated_by) REFERENCES users (id)
);

-- Service entries table
CREATE TABLE services (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  service_type TEXT NOT NULL CHECK (service_type IN ('consultation', 'procedure', 'therapy', 'diagnostic')),
  provider_id TEXT NOT NULL,
  scheduled_date TEXT NOT NULL,
  actual_date TEXT,
  duration INTEGER NOT NULL, -- minutes
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in-progress', 'completed', 'cancelled')),
  notes TEXT,
  diagnosis_codes TEXT, -- JSON array
  billing_code TEXT,
  billing_amount REAL,
  insurance_claim_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  created_by TEXT NOT NULL,
  updated_by TEXT,
  FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE RESTRICT,
  FOREIGN KEY (provider_id) REFERENCES users (id),
  FOREIGN KEY (created_by) REFERENCES users (id),
  FOREIGN KEY (updated_by) REFERENCES users (id)
);

-- Audit log for tracking changes
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_values TEXT, -- JSON
  new_values TEXT, -- JSON
  user_id TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users (id)
);

-- Indexes for performance
CREATE INDEX idx_patients_name ON patients (last_name, first_name);
CREATE INDEX idx_patients_phone ON patients (phone);
CREATE INDEX idx_patients_created_at ON patients (created_at);
CREATE INDEX idx_patients_deleted_at ON patients (deleted_at);

CREATE INDEX idx_services_patient ON services (patient_id);
CREATE INDEX idx_services_provider ON services (provider_id);
CREATE INDEX idx_services_date ON services (scheduled_date);
CREATE INDEX idx_services_status ON services (status);
CREATE INDEX idx_services_type ON services (service_type);
CREATE INDEX idx_services_created_at ON services (created_at);
CREATE INDEX idx_services_deleted_at ON services (deleted_at);

CREATE INDEX idx_audit_table_record ON audit_log (table_name, record_id);
CREATE INDEX idx_audit_timestamp ON audit_log (timestamp);
CREATE INDEX idx_audit_user ON audit_log (user_id);

-- Full-text search for patient names and notes
CREATE VIRTUAL TABLE patients_fts USING fts5(
  id, 
  first_name, 
  last_name, 
  phone,
  content='patients',
  content_rowid='rowid'
);

CREATE VIRTUAL TABLE services_fts USING fts5(
  id,
  notes,
  diagnosis_codes,
  content='services',
  content_rowid='rowid'
);
```

## Database Migrations

### Migration System
```javascript
// database/migrations.js
import { db } from './connection.js';
import { logger } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

class MigrationRunner {
  constructor() {
    this.ensureMigrationsTable();
  }

  ensureMigrationsTable() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT UNIQUE NOT NULL,
        executed_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  async runMigrations() {
    const migrationDir = path.join(process.cwd(), 'database', 'migrations');
    const files = fs.readdirSync(migrationDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    const executedMigrations = db.prepare('SELECT filename FROM migrations').all()
      .map(row => row.filename);

    for (const file of files) {
      if (!executedMigrations.includes(file)) {
        await this.executeMigration(file, migrationDir);
      }
    }
  }

  async executeMigration(filename, migrationDir) {
    const filePath = path.join(migrationDir, filename);
    const sql = fs.readFileSync(filePath, 'utf8');

    const transaction = db.transaction(() => {
      try {
        db.exec(sql);
        db.prepare('INSERT INTO migrations (filename) VALUES (?)').run(filename);
        logger.info(`Migration executed: ${filename}`);
      } catch (error) {
        logger.error(`Migration failed: ${filename}`, error);
        throw error;
      }
    });

    transaction();
  }

  createMigration(name) {
    const timestamp = new Date().toISOString().replace(/[:\-T]/g, '').slice(0, 14);
    const filename = `${timestamp}_${name}.sql`;
    const migrationDir = path.join(process.cwd(), 'database', 'migrations');
    const filePath = path.join(migrationDir, filename);

    if (!fs.existsSync(migrationDir)) {
      fs.mkdirSync(migrationDir, { recursive: true });
    }

    fs.writeFileSync(filePath, `-- Migration: ${name}
-- Created: ${new Date().toISOString()}

-- Add your SQL here

`);

    logger.info(`Migration created: ${filename}`);
    return filePath;
  }
}

export const migrationRunner = new MigrationRunner();
```

## Repository Pattern Implementation

### Base Repository
```javascript
// repositories/BaseRepository.js
import { db } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export class BaseRepository {
  constructor(tableName) {
    this.tableName = tableName;
    this.db = db;
  }

  // Generic find by ID with soft delete support
  findById(id) {
    const stmt = this.db.prepare(`
      SELECT * FROM ${this.tableName} 
      WHERE id = ? AND deleted_at IS NULL
    `);
    
    return stmt.get(id);
  }

  // Generic find all with pagination
  findAll(options = {}) {
    const { page = 1, limit = 20, orderBy = 'created_at', order = 'DESC' } = options;
    const offset = (page - 1) * limit;

    const stmt = this.db.prepare(`
      SELECT * FROM ${this.tableName}
      WHERE deleted_at IS NULL
      ORDER BY ${orderBy} ${order}
      LIMIT ? OFFSET ?
    `);

    const countStmt = this.db.prepare(`
      SELECT COUNT(*) as total FROM ${this.tableName} WHERE deleted_at IS NULL
    `);

    const items = stmt.all(limit, offset);
    const total = countStmt.get().total;

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  // Generic create with audit logging
  create(data, userId) {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const columns = Object.keys(data);
    const placeholders = columns.map(() => '?').join(', ');
    const values = Object.values(data);

    const stmt = this.db.prepare(`
      INSERT INTO ${this.tableName} (id, ${columns.join(', ')}, created_at, updated_at, created_by)
      VALUES (?, ${placeholders}, ?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      const result = stmt.run(id, ...values, now, now, userId);
      
      // Log to audit table
      this.logAudit(id, 'INSERT', null, { id, ...data }, userId);
      
      return this.findById(id);
    });

    return transaction();
  }

  // Generic update with audit logging
  update(id, data, userId) {
    const oldRecord = this.findById(id);
    if (!oldRecord) {
      throw new Error(`Record not found: ${id}`);
    }

    const now = new Date().toISOString();
    const columns = Object.keys(data);
    const setClause = columns.map(col => `${col} = ?`).join(', ');
    const values = Object.values(data);

    const stmt = this.db.prepare(`
      UPDATE ${this.tableName} 
      SET ${setClause}, updated_at = ?, updated_by = ?
      WHERE id = ? AND deleted_at IS NULL
    `);

    const transaction = this.db.transaction(() => {
      const result = stmt.run(...values, now, userId, id);
      
      if (result.changes === 0) {
        throw new Error(`Failed to update record: ${id}`);
      }
      
      // Log to audit table
      this.logAudit(id, 'UPDATE', oldRecord, { ...oldRecord, ...data }, userId);
      
      return this.findById(id);
    });

    return transaction();
  }

  // Soft delete with audit logging
  softDelete(id, userId) {
    const oldRecord = this.findById(id);
    if (!oldRecord) {
      throw new Error(`Record not found: ${id}`);
    }

    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE ${this.tableName} 
      SET deleted_at = ?, updated_by = ?
      WHERE id = ? AND deleted_at IS NULL
    `);

    const transaction = this.db.transaction(() => {
      const result = stmt.run(now, userId, id);
      
      if (result.changes === 0) {
        throw new Error(`Failed to delete record: ${id}`);
      }
      
      // Log to audit table
      this.logAudit(id, 'DELETE', oldRecord, { ...oldRecord, deleted_at: now }, userId);
      
      return true;
    });

    return transaction();
  }

  // Audit logging helper
  logAudit(recordId, action, oldValues, newValues, userId) {
    const auditStmt = this.db.prepare(`
      INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, user_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    auditStmt.run(
      this.tableName,
      recordId,
      action,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      userId
    );
  }
}
```

### Patient Repository
```javascript
// repositories/PatientRepository.js
import { BaseRepository } from './BaseRepository.js';

export class PatientRepository extends BaseRepository {
  constructor() {
    super('patients');
  }

  // Find patients by search term
  searchPatients(searchTerm, options = {}) {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;
    
    // Use FTS for better search performance
    const stmt = this.db.prepare(`
      SELECT p.* FROM patients p
      JOIN patients_fts fts ON p.rowid = fts.rowid
      WHERE patients_fts MATCH ? AND p.deleted_at IS NULL
      ORDER BY rank
      LIMIT ? OFFSET ?
    `);

    const countStmt = this.db.prepare(`
      SELECT COUNT(*) as total FROM patients p
      JOIN patients_fts fts ON p.rowid = fts.rowid
      WHERE patients_fts MATCH ? AND p.deleted_at IS NULL
    `);

    const searchQuery = searchTerm.split(' ').map(term => `"${term}"*`).join(' OR ');
    
    const items = stmt.all(searchQuery, limit, offset);
    const total = countStmt.get(searchQuery).total;

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  // Find patient by phone number
  findByPhone(phone) {
    const stmt = this.db.prepare(`
      SELECT * FROM patients 
      WHERE phone = ? AND deleted_at IS NULL
    `);
    
    return stmt.get(phone);
  }

  // Find patient by medical record number
  findByMedicalRecordNumber(mrn) {
    const stmt = this.db.prepare(`
      SELECT * FROM patients 
      WHERE medical_record_number = ? AND deleted_at IS NULL
    `);
    
    return stmt.get(mrn);
  }

  // Get patient with service history
  findWithServices(patientId) {
    const patient = this.findById(patientId);
    if (!patient) return null;

    const servicesStmt = this.db.prepare(`
      SELECT s.*, u.first_name as provider_first_name, u.last_name as provider_last_name
      FROM services s
      JOIN users u ON s.provider_id = u.id
      WHERE s.patient_id = ? AND s.deleted_at IS NULL
      ORDER BY s.scheduled_date DESC
    `);

    const services = servicesStmt.all(patientId);

    return {
      ...patient,
      services
    };
  }

  // Create patient with validation
  createPatient(patientData, userId) {
    // Check for duplicate phone
    const existingPatient = this.findByPhone(patientData.phone);
    if (existingPatient) {
      throw new Error('Patient with this phone number already exists');
    }

    // Generate medical record number if not provided
    if (!patientData.medical_record_number) {
      patientData.medical_record_number = this.generateMedicalRecordNumber();
    }

    // Serialize complex data
    if (typeof patientData.emergency_contact === 'object') {
      patientData.emergency_contact = JSON.stringify(patientData.emergency_contact);
    }
    if (patientData.insurance_info && typeof patientData.insurance_info === 'object') {
      patientData.insurance_info = JSON.stringify(patientData.insurance_info);
    }

    const patient = this.create(patientData, userId);

    // Update FTS index
    this.updateFTSIndex(patient);

    return patient;
  }

  // Update patient with validation
  updatePatient(id, patientData, userId) {
    // Check for duplicate phone (excluding current patient)
    if (patientData.phone) {
      const existingPatient = this.findByPhone(patientData.phone);
      if (existingPatient && existingPatient.id !== id) {
        throw new Error('Patient with this phone number already exists');
      }
    }

    // Serialize complex data
    if (patientData.emergency_contact && typeof patientData.emergency_contact === 'object') {
      patientData.emergency_contact = JSON.stringify(patientData.emergency_contact);
    }
    if (patientData.insurance_info && typeof patientData.insurance_info === 'object') {
      patientData.insurance_info = JSON.stringify(patientData.insurance_info);
    }

    const patient = this.update(id, patientData, userId);

    // Update FTS index
    this.updateFTSIndex(patient);

    return patient;
  }

  // Generate unique medical record number
  generateMedicalRecordNumber() {
    const prefix = 'MR';
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}${timestamp}${random}`;
  }

  // Update full-text search index
  updateFTSIndex(patient) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO patients_fts (rowid, id, first_name, last_name, phone)
      SELECT rowid, id, first_name, last_name, phone 
      FROM patients WHERE id = ?
    `);
    
    stmt.run(patient.id);
  }
}
```

### Service Repository
```javascript
// repositories/ServiceRepository.js
import { BaseRepository } from './BaseRepository.js';

export class ServiceRepository extends BaseRepository {
  constructor() {
    super('services');
  }

  // Find services by patient with provider details
  findByPatient(patientId, options = {}) {
    const { page = 1, limit = 50, status } = options;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE s.patient_id = ? AND s.deleted_at IS NULL';
    const params = [patientId];

    if (status) {
      whereClause += ' AND s.status = ?';
      params.push(status);
    }

    const stmt = this.db.prepare(`
      SELECT s.*, 
             u.first_name as provider_first_name, 
             u.last_name as provider_last_name,
             u.department as provider_department
      FROM services s
      JOIN users u ON s.provider_id = u.id
      ${whereClause}
      ORDER BY s.scheduled_date DESC
      LIMIT ? OFFSET ?
    `);

    const countStmt = this.db.prepare(`
      SELECT COUNT(*) as total FROM services s
      ${whereClause}
    `);

    const items = stmt.all(...params, limit, offset);
    const total = countStmt.get(...params).total;

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  // Find services by date range
  findByDateRange(startDate, endDate, options = {}) {
    const { providerId, serviceType, status } = options;

    let whereClause = 'WHERE s.scheduled_date BETWEEN ? AND ? AND s.deleted_at IS NULL';
    const params = [startDate, endDate];

    if (providerId) {
      whereClause += ' AND s.provider_id = ?';
      params.push(providerId);
    }

    if (serviceType) {
      whereClause += ' AND s.service_type = ?';
      params.push(serviceType);
    }

    if (status) {
      whereClause += ' AND s.status = ?';
      params.push(status);
    }

    const stmt = this.db.prepare(`
      SELECT s.*, 
             p.first_name as patient_first_name,
             p.last_name as patient_last_name,
             u.first_name as provider_first_name,
             u.last_name as provider_last_name
      FROM services s
      JOIN patients p ON s.patient_id = p.id
      JOIN users u ON s.provider_id = u.id
      ${whereClause}
      ORDER BY s.scheduled_date ASC
    `);

    return stmt.all(...params);
  }

  // Create service with validation
  createService(serviceData, userId) {
    // Validate patient exists
    const patientStmt = this.db.prepare('SELECT id FROM patients WHERE id = ? AND deleted_at IS NULL');
    const patient = patientStmt.get(serviceData.patient_id);
    if (!patient) {
      throw new Error('Patient not found');
    }

    // Validate provider exists
    const providerStmt = this.db.prepare('SELECT id FROM users WHERE id = ? AND is_active = 1');
    const provider = providerStmt.get(serviceData.provider_id);
    if (!provider) {
      throw new Error('Provider not found or inactive');
    }

    // Serialize complex data
    if (serviceData.diagnosis_codes && Array.isArray(serviceData.diagnosis_codes)) {
      serviceData.diagnosis_codes = JSON.stringify(serviceData.diagnosis_codes);
    }

    const service = this.create(serviceData, userId);

    // Update FTS index
    this.updateFTSIndex(service);

    return service;
  }

  // Update service status with timestamp
  updateStatus(id, status, notes, userId) {
    const updateData = { status };
    
    if (notes) {
      updateData.notes = notes;
    }

    // Set actual date when completed
    if (status === 'completed' || status === 'in-progress') {
      updateData.actual_date = new Date().toISOString();
    }

    const service = this.update(id, updateData, userId);

    // Update FTS index
    this.updateFTSIndex(service);

    return service;
  }

  // Get service statistics
  getStatistics(options = {}) {
    const { startDate, endDate, providerId } = options;

    let whereClause = 'WHERE deleted_at IS NULL';
    const params = [];

    if (startDate && endDate) {
      whereClause += ' AND scheduled_date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    if (providerId) {
      whereClause += ' AND provider_id = ?';
      params.push(providerId);
    }

    const stmt = this.db.prepare(`
      SELECT 
        service_type,
        status,
        COUNT(*) as count,
        AVG(duration) as avg_duration,
        SUM(CASE WHEN billing_amount IS NOT NULL THEN billing_amount ELSE 0 END) as total_billing
      FROM services
      ${whereClause}
      GROUP BY service_type, status
      ORDER BY service_type, status
    `);

    return stmt.all(...params);
  }

  // Update full-text search index
  updateFTSIndex(service) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO services_fts (rowid, id, notes, diagnosis_codes)
      SELECT rowid, id, notes, diagnosis_codes 
      FROM services WHERE id = ?
    `);
    
    stmt.run(service.id);
  }
}
```

## Transaction Management

### Advanced Transaction Patterns
```javascript
// services/TransactionService.js
import { db } from '../database/connection.js';
import { logger } from '../utils/logger.js';

export class TransactionService {
  // Execute multiple operations in a single transaction
  static executeTransaction(operations) {
    const transaction = db.transaction((ops) => {
      const results = [];
      
      for (const operation of ops) {
        try {
          const result = operation();
          results.push(result);
        } catch (error) {
          logger.error('Transaction operation failed', { error, operation: operation.name });
          throw error;
        }
      }
      
      return results;
    });

    return transaction(operations);
  }

  // Patient service creation with multiple related records
  static createPatientWithServices(patientData, servicesData, userId) {
    const transaction = db.transaction(() => {
      // Create patient
      const patientRepo = new PatientRepository();
      const patient = patientRepo.createPatient(patientData, userId);

      // Create services
      const serviceRepo = new ServiceRepository();
      const services = [];
      
      for (const serviceData of servicesData) {
        serviceData.patient_id = patient.id;
        const service = serviceRepo.createService(serviceData, userId);
        services.push(service);
      }

      return { patient, services };
    });

    return transaction();
  }

  // Bulk status updates with audit logging
  static bulkUpdateServiceStatus(serviceIds, status, notes, userId) {
    const transaction = db.transaction(() => {
      const serviceRepo = new ServiceRepository();
      const results = [];
      
      for (const serviceId of serviceIds) {
        const result = serviceRepo.updateStatus(serviceId, status, notes, userId);
        results.push(result);
      }
      
      return results;
    });

    return transaction();
  }

  // Backup and restore operations
  static createBackup(backupPath) {
    const transaction = db.transaction(() => {
      const backup = db.backup(backupPath);
      
      return new Promise((resolve, reject) => {
        backup.on('progress', (info) => {
          logger.info('Backup progress', info);
        });

        backup.on('done', () => {
          logger.info('Backup completed', { path: backupPath });
          resolve(backupPath);
        });

        backup.on('error', (error) => {
          logger.error('Backup failed', error);
          reject(error);
        });
      });
    });

    return transaction();
  }
}
```

## Performance Optimization

### Query Optimization
```javascript
// database/optimization.js
import { db } from './connection.js';
import { logger } from '../utils/logger.js';

export class QueryOptimizer {
  // Analyze query performance
  static analyzeQuery(sql, params = []) {
    const stmt = db.prepare(sql);
    
    // Get query plan
    const plan = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params);
    
    // Time the query execution
    const start = performance.now();
    const result = stmt.all(...params);
    const duration = performance.now() - start;
    
    logger.debug('Query analysis', {
      sql,
      duration,
      rowCount: result.length,
      queryPlan: plan
    });
    
    return { result, duration, queryPlan: plan };
  }

  // Create indexes for better performance
  static createOptimizedIndexes() {
    const indexes = [
      // Composite indexes for common queries
      'CREATE INDEX IF NOT EXISTS idx_services_patient_date ON services (patient_id, scheduled_date)',
      'CREATE INDEX IF NOT EXISTS idx_services_provider_status ON services (provider_id, status)',
      'CREATE INDEX IF NOT EXISTS idx_patients_name_phone ON patients (last_name, first_name, phone)',
      
      // Partial indexes for active records
      'CREATE INDEX IF NOT EXISTS idx_active_patients ON patients (id) WHERE deleted_at IS NULL',
      'CREATE INDEX IF NOT EXISTS idx_active_services ON services (id) WHERE deleted_at IS NULL',
      
      // Index for audit queries
      'CREATE INDEX IF NOT EXISTS idx_audit_table_action ON audit_log (table_name, action, timestamp)',
    ];

    const transaction = db.transaction(() => {
      for (const indexSql of indexes) {
        try {
          db.exec(indexSql);
          logger.info('Index created', { sql: indexSql });
        } catch (error) {
          if (!error.message.includes('already exists')) {
            logger.error('Index creation failed', { sql: indexSql, error });
          }
        }
      }
    });

    transaction();
  }

  // Database maintenance operations
  static performMaintenance() {
    const transaction = db.transaction(() => {
      // Analyze table statistics
      db.exec('ANALYZE');
      
      // Vacuum to reclaim space and optimize
      db.exec('VACUUM');
      
      // Rebuild FTS indexes
      db.exec('INSERT INTO patients_fts(patients_fts) VALUES(\'rebuild\')');
      db.exec('INSERT INTO services_fts(services_fts) VALUES(\'rebuild\')');
      
      logger.info('Database maintenance completed');
    });

    transaction();
  }

  // Monitor database size and performance
  static getDatabaseStats() {
    const stats = {};

    // Database file size
    const sizeQuery = db.prepare('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()');
    stats.databaseSize = sizeQuery.get().size;

    // Table row counts
    const tables = ['users', 'patients', 'services', 'audit_log'];
    for (const table of tables) {
      const countQuery = db.prepare(`SELECT COUNT(*) as count FROM ${table}`);
      stats[`${table}_count`] = countQuery.get().count;
    }

    // Index usage statistics
    const indexQuery = db.prepare(`
      SELECT name, tbl_name, sql 
      FROM sqlite_master 
      WHERE type = 'index' AND sql IS NOT NULL
    `);
    stats.indexes = indexQuery.all();

    return stats;
  }
}
```

## Security and Data Protection

### Data Encryption
```javascript
// utils/encryption.js
import crypto from 'crypto';

export class DataEncryption {
  static algorithm = 'aes-256-gcm';
  static keyLength = 32;
  static ivLength = 16;
  static tagLength = 16;

  static encrypt(text, key) {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipher(this.algorithm, key, { iv });
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  static decrypt(encryptedData, key) {
    const { encrypted, iv, tag } = encryptedData;
    
    const decipher = crypto.createDecipher(this.algorithm, key, {
      iv: Buffer.from(iv, 'hex')
    });
    
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  // Encrypt sensitive patient data before storing
  static encryptPatientData(patientData, encryptionKey) {
    const sensitiveFields = ['social_security_number', 'insurance_info'];
    const encrypted = { ...patientData };

    for (const field of sensitiveFields) {
      if (patientData[field]) {
        encrypted[field] = this.encrypt(patientData[field], encryptionKey);
      }
    }

    return encrypted;
  }
}
```

## Testing and Development

### Test Database Setup
```javascript
// tests/database.test.js
import { jest } from '@jest/globals';
import Database from 'better-sqlite3';
import { PatientRepository } from '../repositories/PatientRepository.js';
import { ServiceRepository } from '../repositories/ServiceRepository.js';

describe('Database Operations', () => {
  let testDb;
  let patientRepo;
  let serviceRepo;

  beforeAll(() => {
    // Create in-memory test database
    testDb = new Database(':memory:');
    testDb.pragma('foreign_keys = ON');

    // Create schema
    const schema = `
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE patients (
        id TEXT PRIMARY KEY,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        date_of_birth TEXT NOT NULL,
        phone TEXT UNIQUE NOT NULL,
        email TEXT,
        emergency_contact TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT,
        created_by TEXT NOT NULL,
        updated_by TEXT,
        FOREIGN KEY (created_by) REFERENCES users (id),
        FOREIGN KEY (updated_by) REFERENCES users (id)
      );

      CREATE TABLE services (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        service_type TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        scheduled_date TEXT NOT NULL,
        duration INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'scheduled',
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT,
        created_by TEXT NOT NULL,
        FOREIGN KEY (patient_id) REFERENCES patients (id),
        FOREIGN KEY (provider_id) REFERENCES users (id)
      );
    `;

    testDb.exec(schema);

    // Initialize repositories with test database
    patientRepo = new PatientRepository();
    patientRepo.db = testDb;
    
    serviceRepo = new ServiceRepository();
    serviceRepo.db = testDb;

    // Insert test user
    testDb.prepare(`
      INSERT INTO users (id, username, role, first_name, last_name)
      VALUES ('user-1', 'testuser', 'admin', 'Test', 'User')
    `).run();
  });

  afterAll(() => {
    testDb.close();
  });

  beforeEach(() => {
    // Clean up test data
    testDb.exec('DELETE FROM services');
    testDb.exec('DELETE FROM patients WHERE id != "patient-test"');
  });

  describe('Patient Repository', () => {
    test('should create patient', () => {
      const patientData = {
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '1985-01-15',
        phone: '5551234567',
        email: 'john@example.com',
        emergency_contact: JSON.stringify({
          name: 'Jane Doe',
          phone: '5551234568',
          relationship: 'spouse'
        })
      };

      const patient = patientRepo.createPatient(patientData, 'user-1');

      expect(patient).toMatchObject({
        first_name: 'John',
        last_name: 'Doe',
        phone: '5551234567'
      });
      expect(patient.id).toBeDefined();
      expect(patient.created_at).toBeDefined();
    });

    test('should find patient by phone', () => {
      const patientData = {
        first_name: 'Jane',
        last_name: 'Smith',
        date_of_birth: '1990-05-20',
        phone: '5559876543',
        emergency_contact: JSON.stringify({
          name: 'John Smith',
          phone: '5559876544',
          relationship: 'husband'
        })
      };

      const created = patientRepo.createPatient(patientData, 'user-1');
      const found = patientRepo.findByPhone('5559876543');

      expect(found.id).toBe(created.id);
      expect(found.first_name).toBe('Jane');
    });

    test('should soft delete patient', () => {
      const patientData = {
        first_name: 'Delete',
        last_name: 'Me',
        date_of_birth: '1995-03-10',
        phone: '5550000000',
        emergency_contact: JSON.stringify({
          name: 'Someone',
          phone: '5550000001',
          relationship: 'friend'
        })
      };

      const patient = patientRepo.createPatient(patientData, 'user-1');
      const deleted = patientRepo.softDelete(patient.id, 'user-1');

      expect(deleted).toBe(true);
      
      const found = patientRepo.findById(patient.id);
      expect(found).toBeNull();
    });
  });

  describe('Service Repository', () => {
    test('should create service', () => {
      // First create a patient
      const patient = patientRepo.createPatient({
        first_name: 'Service',
        last_name: 'Patient',
        date_of_birth: '1980-12-25',
        phone: '5556789012',
        emergency_contact: JSON.stringify({
          name: 'Emergency Contact',
          phone: '5556789013',
          relationship: 'parent'
        })
      }, 'user-1');

      const serviceData = {
        patient_id: patient.id,
        service_type: 'consultation',
        provider_id: 'user-1',
        scheduled_date: new Date().toISOString(),
        duration: 30,
        notes: 'Test consultation'
      };

      const service = serviceRepo.createService(serviceData, 'user-1');

      expect(service).toMatchObject({
        patient_id: patient.id,
        service_type: 'consultation',
        status: 'scheduled'
      });
      expect(service.id).toBeDefined();
    });

    test('should update service status', () => {
      // Create patient and service first
      const patient = patientRepo.createPatient({
        first_name: 'Status',
        last_name: 'Update',
        date_of_birth: '1975-08-14',
        phone: '5554567890',
        emergency_contact: JSON.stringify({
          name: 'Status Contact',
          phone: '5554567891',
          relationship: 'sibling'
        })
      }, 'user-1');

      const service = serviceRepo.createService({
        patient_id: patient.id,
        service_type: 'procedure',
        provider_id: 'user-1',
        scheduled_date: new Date().toISOString(),
        duration: 60
      }, 'user-1');

      const updated = serviceRepo.updateStatus(
        service.id, 
        'completed', 
        'Procedure completed successfully', 
        'user-1'
      );

      expect(updated.status).toBe('completed');
      expect(updated.notes).toBe('Procedure completed successfully');
      expect(updated.actual_date).toBeDefined();
    });
  });

  describe('Transactions', () => {
    test('should rollback on error', () => {
      const transaction = testDb.transaction(() => {
        // Create patient
        const patient = patientRepo.createPatient({
          first_name: 'Transaction',
          last_name: 'Test',
          date_of_birth: '1988-04-22',
          phone: '5557890123',
          emergency_contact: JSON.stringify({
            name: 'Transaction Contact',
            phone: '5557890124',
            relationship: 'cousin'
          })
        }, 'user-1');

        // This should fail and rollback the entire transaction
        throw new Error('Intentional error');
      });

      expect(() => transaction()).toThrow('Intentional error');
      
      // Verify patient was not created
      const found = patientRepo.findByPhone('5557890123');
      expect(found).toBeNull();
    });
  });
});
```

## Best Practices

### 1. Connection Management
- Use WAL mode for better concurrency
- Enable foreign key constraints
- Set appropriate timeouts and cache sizes

### 2. Schema Design
- Use proper data types and constraints
- Create indexes for frequently queried columns
- Implement soft deletes for audit trails

### 3. Transaction Usage
- Use transactions for multi-table operations
- Keep transactions short to avoid locking
- Handle transaction rollbacks properly

### 4. Performance
- Use prepared statements for repeated queries
- Implement full-text search for text fields
- Regular ANALYZE and VACUUM operations

### 5. Security
- Encrypt sensitive data before storage
- Implement comprehensive audit logging
- Validate all inputs to prevent SQL injection

### 6. Testing
- Use in-memory databases for tests
- Test transaction rollbacks
- Verify constraints and validations

## Resources
- [SQLite Documentation](https://sqlite.org/docs.html)
- [better-sqlite3 API](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md)
- [SQLite Performance Tuning](https://www.sqlite.org/optoverview.html)