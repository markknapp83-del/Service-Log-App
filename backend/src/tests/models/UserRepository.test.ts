// UserRepository tests following Jest documentation patterns
import { describe, test, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import Database from 'better-sqlite3';
import { UserRepository } from '@/models/UserRepository.js';
import { ConflictError, NotFoundError } from '@/utils/errors.js';

describe('UserRepository', () => {
  let db: Database.Database;
  let repository: UserRepository;

  beforeAll(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    
    // Create users table
    db.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'candidate')),
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        last_login_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    repository = new UserRepository();
    // Override the repository's database connection for testing
    (repository as any).statements = {
      findById: db.prepare(`SELECT * FROM users WHERE id = ? AND is_active = 1`),
      findByEmail: db.prepare(`SELECT * FROM users WHERE email = ? AND is_active = 1`),
      findByUsername: db.prepare(`SELECT * FROM users WHERE username = ? AND is_active = 1`),
      insert: db.prepare(`
        INSERT INTO users (
          id, username, email, password_hash, role, first_name, last_name,
          is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `),
      update: db.prepare(`
        UPDATE users 
        SET first_name = ?, last_name = ?, email = ?, updated_at = datetime('now')
        WHERE id = ? AND is_active = 1
      `),
      softDelete: db.prepare(`
        UPDATE users SET is_active = 0, updated_at = datetime('now') WHERE id = ?
      `),
      getAllActive: db.prepare(`
        SELECT * FROM users WHERE is_active = 1 ORDER BY created_at DESC
      `)
    };
  });

  beforeEach(() => {
    // Clean up users table before each test
    db.exec('DELETE FROM users');
  });

  afterAll(() => {
    db.close();
  });

  describe('create', () => {
    test('creates user with valid data', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@healthcare.local',
        passwordHash: '$2a$12$hashedpassword',
        role: 'admin' as const,
        firstName: 'Test',
        lastName: 'User',
        isActive: true,
        lastLoginAt: undefined
      };

      const user = await repository.create(userData);

      expect(user.id).toBeDefined();
      expect(user.username).toBe('testuser');
      expect(user.email).toBe('test@healthcare.local');
      expect(user.role).toBe('admin');
      expect(user.firstName).toBe('Test');
      expect(user.lastName).toBe('User');
      expect(user.isActive).toBe(true);
      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();
    });

    test('throws error for duplicate email', async () => {
      const userData1 = {
        username: 'user1',
        email: 'duplicate@healthcare.local',
        passwordHash: '$2a$12$hashedpassword',
        role: 'admin' as const,
        firstName: 'User',
        lastName: 'One',
        isActive: true,
        lastLoginAt: undefined
      };

      const userData2 = {
        username: 'user2',
        email: 'duplicate@healthcare.local', // Same email
        passwordHash: '$2a$12$hashedpassword',
        role: 'candidate' as const,
        firstName: 'User',
        lastName: 'Two',
        isActive: true,
        lastLoginAt: undefined
      };

      // Create first user
      await repository.create(userData1);

      // Try to create second user with same email
      await expect(repository.create(userData2)).rejects.toThrow(ConflictError);
    });

    test('throws error for duplicate username', async () => {
      const userData1 = {
        username: 'duplicateuser',
        email: 'user1@healthcare.local',
        passwordHash: '$2a$12$hashedpassword',
        role: 'admin' as const,
        firstName: 'User',
        lastName: 'One',
        isActive: true,
        lastLoginAt: undefined
      };

      const userData2 = {
        username: 'duplicateuser', // Same username
        email: 'user2@healthcare.local',
        passwordHash: '$2a$12$hashedpassword',
        role: 'candidate' as const,
        firstName: 'User',
        lastName: 'Two',
        isActive: true,
        lastLoginAt: undefined
      };

      // Create first user
      await repository.create(userData1);

      // Try to create second user with same username
      await expect(repository.create(userData2)).rejects.toThrow(ConflictError);
    });
  });

  describe('findById', () => {
    test('returns user by id', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@healthcare.local',
        passwordHash: '$2a$12$hashedpassword',
        role: 'admin' as const,
        firstName: 'Test',
        lastName: 'User',
        isActive: true,
        lastLoginAt: undefined
      };

      const created = await repository.create(userData);
      const found = await repository.findById(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.username).toBe('testuser');
      expect(found?.email).toBe('test@healthcare.local');
    });

    test('returns null for non-existent id', async () => {
      const found = await repository.findById('non-existent-id');
      expect(found).toBeNull();
    });

    test('does not return soft-deleted users', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@healthcare.local',
        passwordHash: '$2a$12$hashedpassword',
        role: 'admin' as const,
        firstName: 'Test',
        lastName: 'User',
        isActive: true,
        lastLoginAt: undefined
      };

      const created = await repository.create(userData);
      
      // Soft delete the user
      await repository.delete(created.id);
      
      const found = await repository.findById(created.id);
      expect(found).toBeNull();
    });
  });

  describe('findByEmail', () => {
    test('returns user by email', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@healthcare.local',
        passwordHash: '$2a$12$hashedpassword',
        role: 'admin' as const,
        firstName: 'Test',
        lastName: 'User',
        isActive: true,
        lastLoginAt: undefined
      };

      await repository.create(userData);
      const found = await repository.findByEmail('test@healthcare.local');

      expect(found).toBeDefined();
      expect(found?.email).toBe('test@healthcare.local');
      expect(found?.username).toBe('testuser');
    });

    test('returns null for non-existent email', async () => {
      const found = await repository.findByEmail('nonexistent@healthcare.local');
      expect(found).toBeNull();
    });
  });

  describe('findByUsername', () => {
    test('returns user by username', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@healthcare.local',
        passwordHash: '$2a$12$hashedpassword',
        role: 'admin' as const,
        firstName: 'Test',
        lastName: 'User',
        isActive: true,
        lastLoginAt: undefined
      };

      await repository.create(userData);
      const found = await repository.findByUsername('testuser');

      expect(found).toBeDefined();
      expect(found?.username).toBe('testuser');
      expect(found?.email).toBe('test@healthcare.local');
    });

    test('returns null for non-existent username', async () => {
      const found = await repository.findByUsername('nonexistentuser');
      expect(found).toBeNull();
    });
  });

  describe('update', () => {
    test('updates user successfully', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@healthcare.local',
        passwordHash: '$2a$12$hashedpassword',
        role: 'admin' as const,
        firstName: 'Test',
        lastName: 'User',
        isActive: true,
        lastLoginAt: undefined
      };

      const created = await repository.create(userData);
      const updateData = { 
        firstName: 'Updated',
        email: 'updated@healthcare.local'
      };

      const updated = await repository.update(created.id, updateData);

      expect(updated.firstName).toBe('Updated');
      expect(updated.email).toBe('updated@healthcare.local');
      expect(updated.lastName).toBe('User'); // Unchanged
      expect(updated.updatedAt).not.toBe(created.updatedAt);
    });

    test('throws error when user not found', async () => {
      const updateData = { firstName: 'Updated' };

      await expect(
        repository.update('non-existent-id', updateData)
      ).rejects.toThrow(NotFoundError);
    });

    test('prevents email duplication during update', async () => {
      // Create first user
      const userData1 = {
        username: 'user1',
        email: 'user1@healthcare.local',
        passwordHash: '$2a$12$hashedpassword',
        role: 'admin' as const,
        firstName: 'User',
        lastName: 'One',
        isActive: true,
        lastLoginAt: undefined
      };
      const user1 = await repository.create(userData1);

      // Create second user
      const userData2 = {
        username: 'user2',
        email: 'user2@healthcare.local',
        passwordHash: '$2a$12$hashedpassword',
        role: 'candidate' as const,
        firstName: 'User',
        lastName: 'Two',
        isActive: true,
        lastLoginAt: undefined
      };
      const user2 = await repository.create(userData2);

      // Try to update user2's email to user1's email
      await expect(
        repository.update(user2.id, { email: 'user1@healthcare.local' })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('delete', () => {
    test('soft deletes user successfully', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@healthcare.local',
        passwordHash: '$2a$12$hashedpassword',
        role: 'admin' as const,
        firstName: 'Test',
        lastName: 'User',
        isActive: true,
        lastLoginAt: undefined
      };

      const created = await repository.create(userData);
      
      await repository.delete(created.id);

      // User should not be found by normal queries
      const found = await repository.findById(created.id);
      expect(found).toBeNull();
    });

    test('throws error when user not found', async () => {
      await expect(
        repository.delete('non-existent-id')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('findAll', () => {
    test('returns all active users', async () => {
      const usersData = [
        {
          username: 'user1',
          email: 'user1@healthcare.local',
          passwordHash: '$2a$12$hashedpassword',
          role: 'admin' as const,
          firstName: 'User',
          lastName: 'One',
          isActive: true,
          lastLoginAt: undefined
        },
        {
          username: 'user2',
          email: 'user2@healthcare.local',
          passwordHash: '$2a$12$hashedpassword',
          role: 'candidate' as const,
          firstName: 'User',
          lastName: 'Two',
          isActive: true,
          lastLoginAt: undefined
        }
      ];

      // Create users
      await repository.create(usersData[0]);
      const user2 = await repository.create(usersData[1]);

      // Soft delete one user
      await repository.delete(user2.id);

      const allUsers = await repository.findAll();

      // Should only return active users
      expect(allUsers).toHaveLength(1);
      expect(allUsers[0].username).toBe('user1');
    });

    test('returns empty array when no users exist', async () => {
      const allUsers = await repository.findAll();
      expect(allUsers).toHaveLength(0);
    });
  });

  describe('updateLastLogin', () => {
    test('updates last login timestamp', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@healthcare.local',
        passwordHash: '$2a$12$hashedpassword',
        role: 'admin' as const,
        firstName: 'Test',
        lastName: 'User',
        isActive: true,
        lastLoginAt: undefined
      };

      const created = await repository.create(userData);
      expect(created.lastLoginAt).toBeUndefined();

      await repository.updateLastLogin(created.id);

      const updated = await repository.findById(created.id);
      expect(updated?.lastLoginAt).toBeDefined();
    });
  });
});