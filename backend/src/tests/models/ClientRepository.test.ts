// Client Repository tests following Jest documentation patterns
import { describe, test, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import Database from 'better-sqlite3';
import { ClientRepository } from '@/models/ClientRepository';
import { Client, DatabaseClient } from '@/types/index';

describe('ClientRepository', () => {
  let db: Database.Database;
  let repository: ClientRepository;
  const testUserId = 'test-user-123';

  beforeAll(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    
    // Create clients table
    db.exec(`
      CREATE TABLE clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT
      );
    `);

    // Create audit log table for testing
    db.exec(`
      CREATE TABLE audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        action TEXT NOT NULL,
        old_values TEXT,
        new_values TEXT,
        user_id TEXT NOT NULL,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    repository = new ClientRepository();
    // Override the repository's database connection for testing
    (repository as any).db = db;
  });

  beforeEach(() => {
    // Clean up clients table before each test
    db.exec('DELETE FROM clients');
    db.exec('DELETE FROM audit_log');
  });

  afterAll(() => {
    db.close();
  });

  describe('fromDatabase', () => {
    test('converts database row to domain object correctly', () => {
      const dbRow: DatabaseClient = {
        id: 1,
        name: 'Test Client',
        is_active: 1,
        created_at: '2023-12-01T10:00:00Z',
        updated_at: '2023-12-01T10:00:00Z'
      };

      const domain = (repository as any).fromDatabase(dbRow) as Client;

      expect(domain).toEqual({
        id: 1,
        name: 'Test Client',
        isActive: true,
        createdAt: '2023-12-01T10:00:00Z',
        updatedAt: '2023-12-01T10:00:00Z'
      });
    });

    test('handles inactive client correctly', () => {
      const dbRow: DatabaseClient = {
        id: 2,
        name: 'Inactive Client',
        is_active: 0,
        created_at: '2023-12-01T10:00:00Z',
        updated_at: '2023-12-01T10:00:00Z'
      };

      const domain = (repository as any).fromDatabase(dbRow) as Client;

      expect(domain.isActive).toBe(false);
    });
  });

  describe('toDatabase', () => {
    test('converts domain object to database row correctly', () => {
      const domain: Partial<Client> = {
        id: 1,
        name: 'Test Client',
        isActive: true,
        createdAt: '2023-12-01T10:00:00Z',
        updatedAt: '2023-12-01T10:00:00Z'
      };

      const dbRow = (repository as any).toDatabase(domain) as Partial<DatabaseClient>;

      expect(dbRow).toEqual({
        id: 1,
        name: 'Test Client',
        is_active: 1,
        created_at: '2023-12-01T10:00:00Z',
        updated_at: '2023-12-01T10:00:00Z'
      });
    });
  });

  describe('createClient', () => {
    test('creates client with valid data', async () => {
      const clientData = {
        name: 'New Hospital',
        isActive: true
      };

      const client = await repository.createClient(clientData, testUserId);

      expect(client.id).toBeDefined();
      expect(client.name).toBe('New Hospital');
      expect(client.isActive).toBe(true);
      expect(client.createdAt).toBeDefined();
      expect(client.updatedAt).toBeDefined();
    });

    test('throws error for duplicate client name', async () => {
      const clientData = {
        name: 'Duplicate Hospital',
        isActive: true
      };

      // Create first client
      await repository.createClient(clientData, testUserId);

      // Try to create second client with same name
      await expect(
        repository.createClient(clientData, testUserId)
      ).rejects.toThrow("Client name 'Duplicate Hospital' already exists");
    });

    test('creates audit log entry on creation', async () => {
      const clientData = {
        name: 'Audit Test Hospital',
        isActive: true
      };

      await repository.createClient(clientData, testUserId);

      const auditEntries = db.prepare('SELECT * FROM audit_log WHERE action = ?').all('INSERT');
      expect(auditEntries).toHaveLength(1);
      expect(auditEntries[0].table_name).toBe('clients');
      expect(auditEntries[0].user_id).toBe(testUserId);
    });
  });

  describe('findById', () => {
    test('returns client by id', async () => {
      const clientData = {
        name: 'Find By ID Hospital',
        isActive: true
      };

      const created = await repository.createClient(clientData, testUserId);
      const found = await repository.findById(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.name).toBe('Find By ID Hospital');
    });

    test('returns null for non-existent id', async () => {
      const found = await repository.findById(999);
      expect(found).toBeNull();
    });

    test('does not return soft-deleted clients', async () => {
      const clientData = {
        name: 'To Be Deleted Hospital',
        isActive: true
      };

      const created = await repository.createClient(clientData, testUserId);
      
      // Soft delete the client
      await repository.softDelete(created.id, testUserId);
      
      const found = await repository.findById(created.id);
      expect(found).toBeNull();
    });
  });

  describe('findByName', () => {
    beforeEach(async () => {
      // Insert test clients
      const clients = [
        { name: 'General Hospital', isActive: true },
        { name: 'Specialty Clinic', isActive: true },
        { name: 'Emergency Center', isActive: true },
        { name: 'Inactive Hospital', isActive: false }
      ];

      for (const client of clients) {
        await repository.createClient(client, testUserId);
      }
    });

    test('finds clients by partial name match', async () => {
      const results = await repository.findByName('Hospital');

      expect(results).toHaveLength(1); // Only active General Hospital
      expect(results[0].name).toBe('General Hospital');
    });

    test('case-insensitive search', async () => {
      const results = await repository.findByName('hospital');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('General Hospital');
    });

    test('returns empty array for no matches', async () => {
      const results = await repository.findByName('NonExistent');
      expect(results).toHaveLength(0);
    });

    test('only returns active clients', async () => {
      const results = await repository.findByName('Hospital');
      expect(results.every(c => c.isActive)).toBe(true);
    });
  });

  describe('findActive', () => {
    beforeEach(async () => {
      const clients = [
        { name: 'Active Hospital 1', isActive: true },
        { name: 'Active Hospital 2', isActive: true },
        { name: 'Inactive Hospital', isActive: false }
      ];

      for (const client of clients) {
        await repository.createClient(client, testUserId);
      }
    });

    test('returns only active clients', async () => {
      const results = await repository.findActive();

      expect(results).toHaveLength(2);
      expect(results.every(c => c.isActive)).toBe(true);
      expect(results.map(c => c.name).sort()).toEqual([
        'Active Hospital 1',
        'Active Hospital 2'
      ]);
    });

    test('returns empty array when no active clients', async () => {
      // Deactivate all clients
      const allClients = await repository.findAll();
      for (const client of allClients.items) {
        await repository.update(client.id, { isActive: false }, testUserId);
      }

      const results = await repository.findActive();
      expect(results).toHaveLength(0);
    });
  });

  describe('isNameTaken', () => {
    beforeEach(async () => {
      await repository.createClient({ name: 'Existing Hospital', isActive: true }, testUserId);
    });

    test('returns true for existing name', async () => {
      const isTaken = await repository.isNameTaken('Existing Hospital');
      expect(isTaken).toBe(true);
    });

    test('case-insensitive check', async () => {
      const isTaken = await repository.isNameTaken('existing hospital');
      expect(isTaken).toBe(true);
    });

    test('returns false for non-existing name', async () => {
      const isTaken = await repository.isNameTaken('New Hospital');
      expect(isTaken).toBe(false);
    });

    test('excludes specified id from check', async () => {
      const client = await repository.createClient({ name: 'Update Test Hospital', isActive: true }, testUserId);
      
      // Should return false when excluding the client's own id
      const isTaken = await repository.isNameTaken('Update Test Hospital', client.id);
      expect(isTaken).toBe(false);
    });
  });

  describe('updateClient', () => {
    test('updates client successfully', async () => {
      const client = await repository.createClient({ name: 'Original Name', isActive: true }, testUserId);
      
      const updated = await repository.updateClient(client.id, { name: 'Updated Name' }, testUserId);

      expect(updated.name).toBe('Updated Name');
      expect(updated.id).toBe(client.id);
    });

    test('throws error for duplicate name on update', async () => {
      await repository.createClient({ name: 'Hospital A', isActive: true }, testUserId);
      const clientB = await repository.createClient({ name: 'Hospital B', isActive: true }, testUserId);

      await expect(
        repository.updateClient(clientB.id, { name: 'Hospital A' }, testUserId)
      ).rejects.toThrow("Client name 'Hospital A' already exists");
    });

    test('creates audit log entry on update', async () => {
      const client = await repository.createClient({ name: 'Original', isActive: true }, testUserId);
      
      await repository.updateClient(client.id, { name: 'Updated' }, testUserId);

      const auditEntries = db.prepare('SELECT * FROM audit_log WHERE action = ?').all('UPDATE');
      expect(auditEntries).toHaveLength(1);
      expect(auditEntries[0].record_id).toBe(client.id.toString());
    });
  });

  describe('toggleActive', () => {
    test('toggles client active status', async () => {
      const client = await repository.createClient({ name: 'Toggle Test', isActive: true }, testUserId);

      const toggled = await repository.toggleActive(client.id, testUserId);
      expect(toggled.isActive).toBe(false);

      const toggledAgain = await repository.toggleActive(client.id, testUserId);
      expect(toggledAgain.isActive).toBe(true);
    });

    test('throws error for non-existent client', async () => {
      await expect(
        repository.toggleActive(999, testUserId)
      ).rejects.toThrow('Client not found: 999');
    });
  });

  describe('bulkCreateClients', () => {
    test('creates multiple clients successfully', async () => {
      const clients = [
        { name: 'Bulk Hospital 1', isActive: true },
        { name: 'Bulk Hospital 2', isActive: true },
        { name: 'Bulk Hospital 3', isActive: true }
      ];

      const created = await repository.bulkCreateClients(clients, testUserId);

      expect(created).toHaveLength(3);
      expect(created.map(c => c.name).sort()).toEqual([
        'Bulk Hospital 1',
        'Bulk Hospital 2',
        'Bulk Hospital 3'
      ]);
    });

    test('throws error for duplicate names within batch', async () => {
      const clients = [
        { name: 'Duplicate', isActive: true },
        { name: 'Duplicate', isActive: true }
      ];

      await expect(
        repository.bulkCreateClients(clients, testUserId)
      ).rejects.toThrow('Duplicate client names in bulk create request');
    });

    test('throws error if name already exists in database', async () => {
      await repository.createClient({ name: 'Existing', isActive: true }, testUserId);

      const clients = [
        { name: 'Existing', isActive: true },
        { name: 'New Client', isActive: true }
      ];

      await expect(
        repository.bulkCreateClients(clients, testUserId)
      ).rejects.toThrow("Client name 'Existing' already exists");
    });
  });

  describe('softDelete', () => {
    test('soft deletes client successfully', async () => {
      const client = await repository.createClient({ name: 'To Delete', isActive: true }, testUserId);
      
      const deleted = await repository.softDelete(client.id, testUserId);
      expect(deleted).toBe(true);

      const found = await repository.findById(client.id);
      expect(found).toBeNull();
    });

    test('creates audit log entry on deletion', async () => {
      const client = await repository.createClient({ name: 'Delete Audit', isActive: true }, testUserId);
      
      await repository.softDelete(client.id, testUserId);

      const auditEntries = db.prepare('SELECT * FROM audit_log WHERE action = ?').all('DELETE');
      expect(auditEntries).toHaveLength(1);
      expect(auditEntries[0].record_id).toBe(client.id.toString());
    });
  });

  describe('error handling', () => {
    test('handles database connection errors gracefully', async () => {
      // Close the database connection to simulate error
      db.close();

      await expect(
        repository.createClient({ name: 'Error Test', isActive: true }, testUserId)
      ).rejects.toThrow();
    });
  });
});