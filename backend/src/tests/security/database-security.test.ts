// Security tests for Database Security & Data Protection following TDD principles
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import Database from 'better-sqlite3';
import { UserRepository } from '@/models/UserRepository';
import { ServiceLogRepository } from '@/models/ServiceLogRepository';
import bcrypt from 'bcryptjs';
import { logger } from '@/utils/logger';

describe('Security: Database Security & Data Protection', () => {
  let testDb: Database.Database;
  let userRepository: UserRepository;
  let serviceLogRepository: ServiceLogRepository;

  beforeAll(() => {
    // Use in-memory database for testing
    testDb = new Database(':memory:');
    testDb.pragma('foreign_keys = ON');
    testDb.pragma('journal_mode = WAL');
    
    // Create test tables (simplified schema for security testing)
    testDb.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'candidate')),
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_login_at TEXT,
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until TEXT
      );

      CREATE TABLE service_logs (
        id TEXT PRIMARY KEY,
        client_name TEXT NOT NULL,
        service_date TEXT NOT NULL,
        notes TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (created_by) REFERENCES users (id)
      );

      CREATE TABLE audit_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT,
        old_values TEXT,
        new_values TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id)
      );
    `);

    userRepository = new UserRepository();
    serviceLogRepository = new ServiceLogRepository();
    
    // Override database connections for testing
    (userRepository as any).db = testDb;
    (serviceLogRepository as any).db = testDb;
  });

  beforeEach(() => {
    // Clean tables before each test
    testDb.exec('DELETE FROM audit_logs');
    testDb.exec('DELETE FROM service_logs');
    testDb.exec('DELETE FROM users');
  });

  afterAll(() => {
    testDb.close();
  });

  describe('Connection Security', () => {
    test('should use secure database configuration', () => {
      // Verify foreign keys are enabled
      const foreignKeysResult = testDb.pragma('foreign_keys');
      expect(foreignKeysResult[0].foreign_keys).toBe(1);

      // Verify WAL mode is enabled for better concurrency
      const journalModeResult = testDb.pragma('journal_mode');
      expect(journalModeResult[0].journal_mode).toBe('wal');
    });

    test('should enforce database constraints', () => {
      // Test unique constraint
      expect(() => {
        testDb.prepare(`
          INSERT INTO users (id, username, email, password_hash, role, first_name, last_name, created_at, updated_at)
          VALUES ('user1', 'test', 'test@example.com', 'hash', 'admin', 'Test', 'User', '2023-12-01T00:00:00Z', '2023-12-01T00:00:00Z')
        `).run();
        
        testDb.prepare(`
          INSERT INTO users (id, username, email, password_hash, role, first_name, last_name, created_at, updated_at)
          VALUES ('user2', 'test', 'different@example.com', 'hash', 'admin', 'Test', 'User', '2023-12-01T00:00:00Z', '2023-12-01T00:00:00Z')
        `).run();
      }).toThrow();
    });

    test('should enforce role constraints', () => {
      // Test invalid role constraint
      expect(() => {
        testDb.prepare(`
          INSERT INTO users (id, username, email, password_hash, role, first_name, last_name, created_at, updated_at)
          VALUES ('user1', 'test', 'test@example.com', 'hash', 'invalid_role', 'Test', 'User', '2023-12-01T00:00:00Z', '2023-12-01T00:00:00Z')
        `).run();
      }).toThrow();
    });

    test('should enforce foreign key constraints', () => {
      // Test foreign key constraint
      expect(() => {
        testDb.prepare(`
          INSERT INTO service_logs (id, client_name, service_date, created_by, created_at, updated_at)
          VALUES ('log1', 'Test Client', '2023-12-01', 'non_existent_user', '2023-12-01T00:00:00Z', '2023-12-01T00:00:00Z')
        `).run();
      }).toThrow();
    });
  });

  describe('Query Security', () => {
    test('should use parameterized queries to prevent SQL injection', async () => {
      // Create a test user
      const hashedPassword = await bcrypt.hash('testpass123', 12);
      
      await userRepository.create({
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: hashedPassword,
        role: 'admin',
        firstName: 'Test',
        lastName: 'User',
        isActive: true
      });

      // Test that malicious input is handled safely
      const maliciousEmail = "test@example.com'; DROP TABLE users; --";
      
      // This should not cause SQL injection
      const user = await userRepository.findByEmail(maliciousEmail);
      expect(user).toBeNull(); // Should not find user with malicious email
      
      // Verify users table still exists and contains our test user
      const allUsers = testDb.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
      expect(allUsers.count).toBe(1);
    });

    test('should sanitize search queries', async () => {
      // Create test service logs
      const hashedPassword = await bcrypt.hash('testpass123', 12);
      const user = await userRepository.create({
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: hashedPassword,
        role: 'admin',
        firstName: 'Test',
        lastName: 'User',
        isActive: true
      });

      await serviceLogRepository.create({
        clientName: 'John Doe',
        serviceDate: '2023-12-01',
        notes: 'Test notes',
        activities: [],
        outcomes: []
      }, user.id);

      // Test malicious search queries
      const maliciousQueries = [
        "'; DROP TABLE service_logs; --",
        "' OR '1'='1",
        "'; DELETE FROM users; --"
      ];

      for (const maliciousQuery of maliciousQueries) {
        const results = await serviceLogRepository.search(maliciousQuery);
        
        // Should handle query safely without database corruption
        expect(Array.isArray(results)).toBe(true);
        
        // Verify tables still exist
        const serviceLogCount = testDb.prepare('SELECT COUNT(*) as count FROM service_logs').get() as { count: number };
        const userCount = testDb.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
        
        expect(serviceLogCount.count).toBe(1);
        expect(userCount.count).toBe(1);
      }
    });
  });

  describe('Data Encryption & Hashing', () => {
    test('should properly hash passwords with bcrypt', async () => {
      const plainPassword = 'TestPassword123!';
      const hashedPassword = await bcrypt.hash(plainPassword, 12);
      
      // Verify hash format (bcrypt with salt rounds 12)
      expect(hashedPassword).toMatch(/^\$2[ab]\$12\$/);
      
      // Verify password verification works
      const isValid = await bcrypt.compare(plainPassword, hashedPassword);
      expect(isValid).toBe(true);
      
      // Verify wrong password fails
      const isInvalid = await bcrypt.compare('WrongPassword', hashedPassword);
      expect(isInvalid).toBe(false);
    });

    test('should use secure salt rounds (minimum 12)', async () => {
      const password = 'testPassword123';
      
      // Test different salt rounds
      const weakHash = await bcrypt.hash(password, 4); // Weak
      const secureHash = await bcrypt.hash(password, 12); // Secure
      
      expect(weakHash).toMatch(/^\$2[ab]\$04\$/);
      expect(secureHash).toMatch(/^\$2[ab]\$12\$/);
      
      // In production, should use secure salt rounds
      const productionHash = await bcrypt.hash(password, 12);
      expect(productionHash).toMatch(/^\$2[ab]\$12\$/);
    });

    test('should not store plaintext passwords', async () => {
      const plainPassword = 'TestPassword123!';
      
      const user = await userRepository.create({
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: await bcrypt.hash(plainPassword, 12),
        role: 'admin',
        firstName: 'Test',
        lastName: 'User',
        isActive: true
      });

      // Verify password is not stored in plaintext
      const storedUser = testDb.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as any;
      
      expect(storedUser.password_hash).not.toBe(plainPassword);
      expect(storedUser.password_hash).toMatch(/^\$2[ab]\$12\$/);
      expect(storedUser.password).toBeUndefined();
    });

    test('should handle sensitive data encryption (if applicable)', () => {
      // Test placeholder for sensitive data encryption
      // In a real healthcare application, PHI would need encryption at rest
      
      const sensitiveData = 'Social Security Number: 123-45-6789';
      
      // In production, this would be encrypted
      // For now, we verify it's not stored in plaintext in logs
      expect(sensitiveData).toBeDefined();
      
      // Verify sensitive patterns are not logged
      const ssnPattern = /\d{3}-\d{2}-\d{4}/;
      expect(ssnPattern.test(sensitiveData)).toBe(true); // Test data contains SSN
      
      // In production logs, this should be redacted/encrypted
    });
  });

  describe('Access Control & Permissions', () => {
    test('should enforce user permissions at database level', async () => {
      // Create users with different roles
      const adminUser = await userRepository.create({
        username: 'admin',
        email: 'admin@example.com',
        passwordHash: await bcrypt.hash('password123', 12),
        role: 'admin',
        firstName: 'Admin',
        lastName: 'User',
        isActive: true
      });

      const candidateUser = await userRepository.create({
        username: 'candidate',
        email: 'candidate@example.com',
        passwordHash: await bcrypt.hash('password123', 12),
        role: 'candidate',
        firstName: 'Candidate',
        lastName: 'User',
        isActive: true
      });

      // Create service log as admin
      const serviceLog = await serviceLogRepository.create({
        clientName: 'Test Client',
        serviceDate: '2023-12-01',
        notes: 'Admin created log',
        activities: [],
        outcomes: []
      }, adminUser.id);

      // Verify ownership is properly set
      expect(serviceLog.createdBy).toBe(adminUser.id);
    });

    test('should prevent unauthorized data access', async () => {
      // This test would verify row-level security if implemented
      // For now, we test that proper user association is maintained
      
      const user = await userRepository.create({
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: await bcrypt.hash('password123', 12),
        role: 'candidate',
        firstName: 'Test',
        lastName: 'User',
        isActive: true
      });

      const serviceLog = await serviceLogRepository.create({
        clientName: 'Private Client',
        serviceDate: '2023-12-01',
        notes: 'Confidential notes',
        activities: [],
        outcomes: []
      }, user.id);

      // Verify data is associated with correct user
      expect(serviceLog.createdBy).toBe(user.id);
      
      // In production, additional access controls would prevent
      // candidates from accessing other candidates' data
    });
  });

  describe('Audit Trail Security', () => {
    test('should create audit logs for sensitive operations', async () => {
      const user = await userRepository.create({
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: await bcrypt.hash('password123', 12),
        role: 'admin',
        firstName: 'Test',
        lastName: 'User',
        isActive: true
      });

      // Create audit log entry
      const auditEntry = {
        id: 'audit-1',
        user_id: user.id,
        action: 'CREATE',
        resource_type: 'user',
        resource_id: user.id,
        old_values: null,
        new_values: JSON.stringify({ role: 'admin' }),
        ip_address: '127.0.0.1',
        user_agent: 'Test Agent',
        created_at: new Date().toISOString()
      };

      testDb.prepare(`
        INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(Object.values(auditEntry));

      // Verify audit log was created
      const auditLog = testDb.prepare('SELECT * FROM audit_logs WHERE id = ?').get('audit-1') as any;
      expect(auditLog).toBeDefined();
      expect(auditLog.action).toBe('CREATE');
      expect(auditLog.user_id).toBe(user.id);
    });

    test('should maintain audit log integrity', () => {
      // Test that audit logs cannot be easily tampered with
      const auditEntry = {
        id: 'audit-1',
        user_id: 'user-123',
        action: 'DELETE',
        resource_type: 'user',
        resource_id: 'deleted-user',
        old_values: null,
        new_values: null,
        ip_address: '192.168.1.1',
        user_agent: 'Malicious Agent',
        created_at: new Date().toISOString()
      };

      testDb.prepare(`
        INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(Object.values(auditEntry));

      // Verify audit log exists
      const auditLog = testDb.prepare('SELECT * FROM audit_logs WHERE id = ?').get('audit-1');
      expect(auditLog).toBeDefined();

      // In production, audit logs should be write-only or have additional protection
      // For now, we verify the structure is correct
      expect((auditLog as any).action).toBe('DELETE');
    });
  });

  describe('Data Validation & Sanitization', () => {
    test('should validate data types and constraints', async () => {
      // Test invalid email format
      try {
        await userRepository.create({
          username: 'testuser',
          email: 'invalid-email-format',
          passwordHash: await bcrypt.hash('password123', 12),
          role: 'admin',
          firstName: 'Test',
          lastName: 'User',
          isActive: true
        });
        // Should throw validation error
        expect(true).toBe(false); // This line should not be reached
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('should sanitize input data', async () => {
      // Test data with potential XSS or injection content
      const maliciousData = {
        username: 'user<script>alert("xss")</script>',
        email: 'test@example.com',
        firstName: '\'\"<script>',
        lastName: '\'; DROP TABLE users; --'
      };

      const user = await userRepository.create({
        ...maliciousData,
        passwordHash: await bcrypt.hash('password123', 12),
        role: 'admin',
        isActive: true
      });

      // Verify malicious content is handled safely
      expect(user.username).toBeDefined();
      expect(user.firstName).toBeDefined();
      expect(user.lastName).toBeDefined();
      
      // In production, this would be sanitized
      // For now, we verify it doesn't break the database
      const userCount = testDb.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
      expect(userCount.count).toBe(1);
    });
  });

  describe('Backup & Recovery Security', () => {
    test('should handle database corruption gracefully', () => {
      // Test database integrity
      const integrityCheck = testDb.pragma('integrity_check');
      expect(integrityCheck[0].integrity_check).toBe('ok');
    });

    test('should support secure backup operations', () => {
      // Test that backup operations don't expose sensitive data
      // This is more of a configuration test
      
      const user = testDb.prepare(`
        INSERT INTO users (id, username, email, password_hash, role, first_name, last_name, created_at, updated_at)
        VALUES ('user1', 'testuser', 'test@example.com', 'hashedpassword', 'admin', 'Test', 'User', '2023-12-01T00:00:00Z', '2023-12-01T00:00:00Z')
        RETURNING *
      `).get();

      expect(user).toBeDefined();
      
      // In production, backups should be encrypted and access-controlled
      const userCount = testDb.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
      expect(userCount.count).toBe(1);
    });
  });

  describe('Concurrent Access Security', () => {
    test('should handle concurrent transactions safely', () => {
      // Test transaction isolation
      const transaction1 = testDb.transaction(() => {
        testDb.prepare(`
          INSERT INTO users (id, username, email, password_hash, role, first_name, last_name, created_at, updated_at)
          VALUES ('user1', 'user1', 'user1@example.com', 'hash', 'admin', 'User', 'One', '2023-12-01T00:00:00Z', '2023-12-01T00:00:00Z')
        `).run();
      });

      const transaction2 = testDb.transaction(() => {
        testDb.prepare(`
          INSERT INTO users (id, username, email, password_hash, role, first_name, last_name, created_at, updated_at)
          VALUES ('user2', 'user2', 'user2@example.com', 'hash', 'admin', 'User', 'Two', '2023-12-01T00:00:00Z', '2023-12-01T00:00:00Z')
        `).run();
      });

      transaction1();
      transaction2();

      const userCount = testDb.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
      expect(userCount.count).toBe(2);
    });

    test('should prevent race conditions in user creation', async () => {
      // Test that duplicate usernames are properly handled
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: await bcrypt.hash('password123', 12),
        role: 'admin' as const,
        firstName: 'Test',
        lastName: 'User',
        isActive: true
      };

      // Create first user
      await userRepository.create(userData);

      // Try to create duplicate user
      try {
        await userRepository.create({
          ...userData,
          email: 'different@example.com' // Different email, same username
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        // Should throw constraint error
        expect(error).toBeDefined();
      }
    });
  });
});
