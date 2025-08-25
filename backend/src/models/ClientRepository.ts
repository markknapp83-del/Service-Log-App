// Client Repository following documented healthcare patterns
import { BaseRepository } from './BaseRepository';
import { 
  Client, 
  DatabaseClient, 
  ClientId, 
  ClientCreateRequest,
  ISODateString 
} from '@/types/index';

export class ClientRepository extends BaseRepository<Client, DatabaseClient, ClientId> {
  constructor() {
    super('clients');
  }

  // Convert database row to domain object
  protected fromDatabase(dbRow: DatabaseClient): Client {
    return {
      id: String(dbRow.id), // Convert number to string for frontend consistency
      name: dbRow.name,
      isActive: this.convertBooleanFromDb(dbRow.is_active),
      createdAt: dbRow.created_at,
      updatedAt: dbRow.updated_at
    };
  }

  // Convert domain object to database row
  protected toDatabase(domain: Partial<Client>): Partial<DatabaseClient> {
    const result: Partial<DatabaseClient> = {};

    if (domain.id !== undefined) result.id = Number(domain.id); // Convert string back to number for database
    if (domain.name !== undefined) result.name = domain.name;
    if (domain.isActive !== undefined) result.is_active = this.convertBooleanToDb(domain.isActive);
    if (domain.createdAt !== undefined) result.created_at = domain.createdAt;
    if (domain.updatedAt !== undefined) result.updated_at = domain.updatedAt;

    return result;
  }

  // Find clients by name (case-insensitive search)
  findByName(name: string): Client[] {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM ${this.tableName}
        WHERE LOWER(name) LIKE LOWER(?) 
        AND is_active = 1
        ORDER BY name ASC
      `);

      const rows = stmt.all(`%${name}%`) as DatabaseClient[];
      return rows.map(row => this.fromDatabase(row));
    } catch (error) {
      throw new Error(`Failed to search clients by name: ${error}`);
    }
  }

  // Get all active clients
  findActive(): Client[] {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM ${this.tableName}
        WHERE is_active = 1 
        ORDER BY name ASC
      `);

      const rows = stmt.all() as DatabaseClient[];
      return rows.map(row => this.fromDatabase(row));
    } catch (error) {
      throw new Error(`Failed to find active clients: ${error}`);
    }
  }

  // Check if client name already exists
  isNameTaken(name: string, excludeId?: ClientId): boolean {
    try {
      let query = `
        SELECT COUNT(*) as count FROM ${this.tableName}
        WHERE LOWER(name) = LOWER(?) 
        AND is_active = 1
      `;
      const params: any[] = [name];

      if (excludeId) {
        query += ' AND id != ?';
        params.push(excludeId);
      }

      const stmt = this.db.prepare(query);
      const result = stmt.get(...params) as { count: number };
      
      return result.count > 0;
    } catch (error) {
      throw new Error(`Failed to check client name uniqueness: ${error}`);
    }
  }

  // Create client with name uniqueness validation
  createClient(data: ClientCreateRequest, userId: string): Client {
    // Validate name uniqueness
    const nameExists = this.isNameTaken(data.name);
    if (nameExists) {
      throw new Error(`Client name '${data.name}' already exists`);
    }

    return this.createWithAutoIncrement(data, userId);
  }

  // Update client with name uniqueness validation
  updateClient(id: ClientId, data: Partial<Client>, userId: string): Client {
    // Validate name uniqueness if name is being updated
    if (data.name) {
      const nameExists = this.isNameTaken(data.name, id);
      if (nameExists) {
        throw new Error(`Client name '${data.name}' already exists`);
      }
    }

    return this.update(id, data, userId);
  }

  // Toggle client active status
  toggleActive(id: ClientId, userId: string): Client {
    const client = this.findById(id);
    if (!client) {
      throw new Error(`Client not found: ${id}`);
    }

    return this.update(id, { isActive: !client.isActive }, userId);
  }

  // Get clients with usage statistics
  findWithStats(): Array<Client & { serviceLogCount: number; lastUsed?: ISODateString }> {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          c.*,
          COUNT(sl.id) as service_log_count,
          MAX(sl.created_at) as last_used
        FROM ${this.tableName} c
        LEFT JOIN service_logs sl ON c.id = sl.client_id
        GROUP BY c.id
        ORDER BY c.name ASC
      `);

      const rows = stmt.all() as Array<DatabaseClient & { 
        service_log_count: number; 
        last_used: string | null;
      }>;

      return rows.map(row => ({
        ...this.fromDatabase(row),
        serviceLogCount: row.service_log_count,
        lastUsed: row.last_used || undefined
      }));
    } catch (error) {
      throw new Error(`Failed to find clients with stats: ${error}`);
    }
  }

  // Delete client (soft delete)
  delete(id: ClientId, userId: string): boolean {
    return this.softDelete(id, userId);
  }

  // Bulk create clients
  bulkCreateClients(clients: ClientCreateRequest[], userId: string): Client[] {
    // Validate all names are unique
    const names = clients.map(c => c.name.toLowerCase());
    const uniqueNames = new Set(names);
    
    if (names.length !== uniqueNames.size) {
      throw new Error('Duplicate client names in bulk create request');
    }

    // Check against existing clients
    for (const client of clients) {
      const nameExists = this.isNameTaken(client.name);
      if (nameExists) {
        throw new Error(`Client name '${client.name}' already exists`);
      }
    }

    return this.bulkCreate(clients, userId);
  }
}