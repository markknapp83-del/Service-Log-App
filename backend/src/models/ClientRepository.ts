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
      id: dbRow.id,
      name: dbRow.name,
      isActive: this.convertBooleanFromDb(dbRow.is_active),
      createdAt: dbRow.created_at,
      updatedAt: dbRow.updated_at
    };
  }

  // Convert domain object to database row
  protected toDatabase(domain: Partial<Client>): Partial<DatabaseClient> {
    const result: Partial<DatabaseClient> = {};

    if (domain.id !== undefined) result.id = domain.id;
    if (domain.name !== undefined) result.name = domain.name;
    if (domain.isActive !== undefined) result.is_active = this.convertBooleanToDb(domain.isActive);
    if (domain.createdAt !== undefined) result.created_at = domain.createdAt;
    if (domain.updatedAt !== undefined) result.updated_at = domain.updatedAt;

    return result;
  }

  // Find clients by name (case-insensitive search)
  async findByName(name: string): Promise<Client[]> {
    try {
      const stmt = await this.db.prepare(`
        SELECT * FROM ${this.tableName}
        WHERE LOWER(name) LIKE LOWER(?) 
        AND (deleted_at IS NULL OR deleted_at = '')
        AND is_active = 1
        ORDER BY name ASC
      `);

      const rows = await stmt.all(`%${name}%`) as DatabaseClient[];
      return rows.map(row => this.fromDatabase(row));
    } catch (error) {
      throw new Error(`Failed to search clients by name: ${error}`);
    }
  }

  // Get all active clients
  async findActive(): Promise<Client[]> {
    try {
      const stmt = await this.db.prepare(`
        SELECT * FROM ${this.tableName}
        WHERE is_active = 1 
        AND (deleted_at IS NULL OR deleted_at = '')
        ORDER BY name ASC
      `);

      const rows = await stmt.all() as DatabaseClient[];
      return rows.map(row => this.fromDatabase(row));
    } catch (error) {
      throw new Error(`Failed to find active clients: ${error}`);
    }
  }

  // Check if client name already exists
  async isNameTaken(name: string, excludeId?: ClientId): Promise<boolean> {
    try {
      let query = `
        SELECT COUNT(*) as count FROM ${this.tableName}
        WHERE LOWER(name) = LOWER(?) 
        AND (deleted_at IS NULL OR deleted_at = '')
      `;
      const params: any[] = [name];

      if (excludeId) {
        query += ' AND id != ?';
        params.push(excludeId);
      }

      const stmt = await this.db.prepare(query);
      const result = await stmt.get(...params) as { count: number };
      
      return result.count > 0;
    } catch (error) {
      throw new Error(`Failed to check client name uniqueness: ${error}`);
    }
  }

  // Create client with name uniqueness validation
  async createClient(data: ClientCreateRequest, userId: string): Promise<Client> {
    // Validate name uniqueness
    const nameExists = await this.isNameTaken(data.name);
    if (nameExists) {
      throw new Error(`Client name '${data.name}' already exists`);
    }

    return await this.create(data, userId);
  }

  // Update client with name uniqueness validation
  async updateClient(id: ClientId, data: Partial<Client>, userId: string): Promise<Client> {
    // Validate name uniqueness if name is being updated
    if (data.name) {
      const nameExists = await this.isNameTaken(data.name, id);
      if (nameExists) {
        throw new Error(`Client name '${data.name}' already exists`);
      }
    }

    return await this.update(id, data, userId);
  }

  // Toggle client active status
  async toggleActive(id: ClientId, userId: string): Promise<Client> {
    const client = await this.findById(id);
    if (!client) {
      throw new Error(`Client not found: ${id}`);
    }

    return await this.update(id, { isActive: !client.isActive }, userId);
  }

  // Get clients with usage statistics
  async findWithStats(): Promise<Array<Client & { serviceLogCount: number; lastUsed?: ISODateString }>> {
    try {
      const stmt = await this.db.prepare(`
        SELECT 
          c.*,
          COUNT(sl.id) as service_log_count,
          MAX(sl.created_at) as last_used
        FROM ${this.tableName} c
        LEFT JOIN service_logs sl ON c.id = sl.client_id 
          AND (sl.deleted_at IS NULL OR sl.deleted_at = '')
        WHERE (c.deleted_at IS NULL OR c.deleted_at = '')
        GROUP BY c.id
        ORDER BY c.name ASC
      `);

      const rows = await stmt.all() as Array<DatabaseClient & { 
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

  // Bulk create clients
  async bulkCreateClients(clients: ClientCreateRequest[], userId: string): Promise<Client[]> {
    // Validate all names are unique
    const names = clients.map(c => c.name.toLowerCase());
    const uniqueNames = new Set(names);
    
    if (names.length !== uniqueNames.size) {
      throw new Error('Duplicate client names in bulk create request');
    }

    // Check against existing clients
    for (const client of clients) {
      const nameExists = await this.isNameTaken(client.name);
      if (nameExists) {
        throw new Error(`Client name '${client.name}' already exists`);
      }
    }

    return await this.bulkCreate(clients, userId);
  }
}