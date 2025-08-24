// UserRepository tests following Jest documentation patterns
import { describe, test, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import Database from 'better-sqlite3';
import { UserRepository } from '@/models/UserRepository';
import { ConflictError, NotFoundError } from '@/utils/errors';
import { createTables } from '@/database/schema';

describe('UserRepository', () => {
  let db: Database.Database;
  let repository: UserRepository;

  beforeAll(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    
    // Override the global database connection for testing
    const dbConnection = require('@/database/connection');
    dbConnection.db.getDb = () => db;
    
    // Override database methods to use test db
    dbConnection.db.prepare = (sql: string) => db.prepare(sql);
    dbConnection.db.exec = (sql: string) => db.exec(sql);
    dbConnection.db.run = (sql: string, params?: any[]) => db.prepare(sql).run(...(params || []));
    dbConnection.db.get = (sql: string, params?: any[]) => db.prepare(sql).get(...(params || []));
    dbConnection.db.all = (sql: string, params?: any[]) => db.prepare(sql).all(...(params || []));
    
    // Create database schema
    createTables();
    
    // Create repository instance
    repository = new UserRepository();
  });

  beforeEach(() => {
    // Clear users table before each test
    db.exec('DELETE FROM users');
  });

  afterAll(() => {
    db.close();
  });

  describe('create', () => {
    test('creates user with valid data', () => {
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        passwordHash: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User',
        role: 'candidate' as const,
        isActive: true
      };

      const user = repository.create(userData);

      expect(user.id).toBeDefined();
      expect(user.email).toBe(userData.email);
      expect(user.username).toBe(userData.username);
      expect(user.firstName).toBe(userData.firstName);
      expect(user.lastName).toBe(userData.lastName);
      expect(user.role).toBe(userData.role);
      expect(user.isActive).toBe(true);
      expect(user.createdAt).toBeInstanceOf(Date);
    });

    test('throws error for duplicate email', () => {
      const userData = {
        email: 'duplicate@example.com',
        username: 'user1',
        passwordHash: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User',
        role: 'candidate' as const,
        isActive: true
      };

      repository.create(userData);
      
      expect(() => {
        repository.create({ ...userData, username: 'user2' });
      }).toThrow(ConflictError);
    });

    test('throws error for duplicate username', () => {
      const userData1 = {
        email: 'user1@example.com',
        username: 'duplicateuser',
        passwordHash: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User',
        role: 'candidate' as const,
        isActive: true
      };

      const userData2 = {
        email: 'user2@example.com',
        username: 'duplicateuser',
        passwordHash: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User',
        role: 'candidate' as const,
        isActive: true
      };

      repository.create(userData1);
      
      expect(() => {
        repository.create(userData2);
      }).toThrow(ConflictError);
    });
  });

  describe('findById', () => {
    test('returns user by id', () => {
      const userData = {
        email: 'findbyid@example.com',
        username: 'findbyiduser',
        passwordHash: 'hashedpassword',
        firstName: 'Find',
        lastName: 'User',
        role: 'candidate' as const,
        isActive: true
      };

      const createdUser = repository.create(userData);
      const foundUser = repository.findById(createdUser.id);

      expect(foundUser).toMatchObject({
        id: createdUser.id,
        email: userData.email,
        username: userData.username,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role
      });
    });

    test('returns null for non-existent id', () => {
      const user = repository.findById('non-existent-id' as any);
      expect(user).toBeNull();
    });

    test('does not return soft-deleted users', () => {
      const userData = {
        email: 'softdelete@example.com',
        username: 'softdeleteuser',
        passwordHash: 'hashedpassword',
        firstName: 'Delete',
        lastName: 'User',
        role: 'candidate' as const,
        isActive: true
      };

      const createdUser = repository.create(userData);
      repository.delete(createdUser.id);
      
      const foundUser = repository.findById(createdUser.id);
      expect(foundUser).toBeNull();
    });
  });

  describe('findByEmail', () => {
    test('returns user by email', () => {
      const userData = {
        email: 'findbyemail@example.com',
        username: 'findbyemailuser',
        passwordHash: 'hashedpassword',
        firstName: 'Find',
        lastName: 'User',
        role: 'candidate' as const,
        isActive: true
      };

      repository.create(userData);
      const foundUser = repository.findByEmail(userData.email);

      expect(foundUser).toMatchObject({
        email: userData.email,
        username: userData.username,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role
      });
    });

    test('returns null for non-existent email', () => {
      const user = repository.findByEmail('nonexistent@example.com');
      expect(user).toBeNull();
    });
  });

  describe('findByUsername', () => {
    test('returns user by username', () => {
      const userData = {
        email: 'findbyusername@example.com',
        username: 'findbyusernameuser',
        passwordHash: 'hashedpassword',
        firstName: 'Find',
        lastName: 'User',
        role: 'candidate' as const,
        isActive: true
      };

      repository.create(userData);
      const foundUser = repository.findByUsername(userData.username!);

      expect(foundUser).toMatchObject({
        email: userData.email,
        username: userData.username,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role
      });
    });

    test('returns null for non-existent username', () => {
      const user = repository.findByUsername('nonexistentuser');
      expect(user).toBeNull();
    });
  });

  describe('update', () => {
    test('updates user successfully', () => {
      const userData = {
        email: 'update@example.com',
        username: 'updateuser',
        passwordHash: 'hashedpassword',
        firstName: 'Update',
        lastName: 'User',
        role: 'candidate' as const,
        isActive: true
      };

      const createdUser = repository.create(userData);
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
        email: 'updated@example.com'
      };

      const updatedUser = repository.update(createdUser.id, updateData);

      expect(updatedUser.firstName).toBe('Updated');
      expect(updatedUser.lastName).toBe('Name');
      expect(updatedUser.email).toBe('updated@example.com');
      expect(updatedUser.username).toBe(userData.username);
    });

    test('throws error when user not found', () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name'
      };

      expect(() => {
        repository.update('non-existent-id' as any, updateData);
      }).toThrow(NotFoundError);
    });

    test('prevents email duplication during update', () => {
      const userData1 = {
        email: 'user1@example.com',
        username: 'user1',
        passwordHash: 'hashedpassword',
        firstName: 'User',
        lastName: 'One',
        role: 'candidate' as const,
        isActive: true
      };

      const userData2 = {
        email: 'user2@example.com',
        username: 'user2',
        passwordHash: 'hashedpassword',
        firstName: 'User',
        lastName: 'Two',
        role: 'candidate' as const,
        isActive: true
      };

      const user1 = repository.create(userData1);
      const user2 = repository.create(userData2);

      expect(() => {
        repository.update(user2.id, { email: 'user1@example.com' });
      }).toThrow(ConflictError);
    });
  });

  describe('delete', () => {
    test('soft deletes user successfully', () => {
      const userData = {
        email: 'delete@example.com',
        username: 'deleteuser',
        passwordHash: 'hashedpassword',
        firstName: 'Delete',
        lastName: 'User',
        role: 'candidate' as const,
        isActive: true
      };

      const createdUser = repository.create(userData);
      
      expect(() => {
        repository.delete(createdUser.id);
      }).not.toThrow();

      // Verify user is soft deleted
      const foundUser = repository.findById(createdUser.id);
      expect(foundUser).toBeNull();
    });

    test('throws error when user not found', () => {
      expect(() => {
        repository.delete('non-existent-id' as any);
      }).toThrow(NotFoundError);
    });
  });

  describe('findAll', () => {
    test('returns all active users', () => {
      const userData1 = {
        email: 'all1@example.com',
        username: 'alluser1',
        passwordHash: 'hashedpassword',
        firstName: 'All',
        lastName: 'User1',
        role: 'candidate' as const,
        isActive: true
      };

      const userData2 = {
        email: 'all2@example.com',
        username: 'alluser2',
        passwordHash: 'hashedpassword',
        firstName: 'All',
        lastName: 'User2',
        role: 'admin' as const,
        isActive: true
      };

      repository.create(userData1);
      repository.create(userData2);

      const users = repository.findAll();
      expect(users).toHaveLength(2);
      expect(users.map(u => u.email)).toContain(userData1.email);
      expect(users.map(u => u.email)).toContain(userData2.email);
    });

    test('returns empty array when no users exist', () => {
      const users = repository.findAll();
      expect(users).toEqual([]);
    });
  });

  describe('updateLastLogin', () => {
    test('updates last login timestamp', () => {
      const userData = {
        email: 'lastlogin@example.com',
        username: 'lastloginuser',
        passwordHash: 'hashedpassword',
        firstName: 'Last',
        lastName: 'Login',
        role: 'candidate' as const,
        isActive: true
      };

      const createdUser = repository.create(userData);
      
      expect(() => {
        repository.updateLastLogin(createdUser.id);
      }).not.toThrow();
    });
  });
});