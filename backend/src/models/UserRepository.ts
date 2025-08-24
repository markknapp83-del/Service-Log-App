// User repository following SQLite documentation patterns
import { db } from '@/database/connection';
import { User, DatabaseUser, UserId } from '@/types/index';
import { v4 as uuidv4 } from 'uuid';
import { NotFoundError, ConflictError } from '@/utils/errors';
import { logger } from '@/utils/logger';

export class UserRepository {
  private findByIdStmt: any;
  private findByEmailStmt: any;
  private findByUsernameStmt: any;
  private createStmt: any;
  private updateLastLoginStmt: any;
  private softDeleteStmt: any;
  private findAllStmt: any;

  constructor() {
    // Prepare statements for better performance with better-sqlite3
    this.findByIdStmt = db.prepare(`
      SELECT * FROM users WHERE id = ? AND is_active = 1
    `);
    this.findByEmailStmt = db.prepare(`
      SELECT * FROM users WHERE email = ? AND is_active = 1
    `);
    this.findByUsernameStmt = db.prepare(`
      SELECT * FROM users WHERE username = ? AND is_active = 1
    `);
    this.createStmt = db.prepare(`
      INSERT INTO users (
        id, email, username, password_hash, first_name, last_name, 
        role, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.updateLastLoginStmt = db.prepare(`
      UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?
    `);
    this.softDeleteStmt = db.prepare(`
      UPDATE users SET is_active = 0, updated_at = ? WHERE id = ? AND is_active = 1
    `);
    this.findAllStmt = db.prepare(`
      SELECT * FROM users WHERE is_active = 1 ORDER BY created_at DESC
    `);
  }

  findById(id: UserId): User | null {
    try {
      const row = this.findByIdStmt.get(id);
      return row ? this.mapDatabaseUser(row) : null;
    } catch (error) {
      logger.error('Error finding user by id', { id, error });
      throw error;
    }
  }

  findByEmail(email: string): User | null {
    try {
      const row = this.findByEmailStmt.get(email);
      return row ? this.mapDatabaseUser(row) : null;
    } catch (error) {
      logger.error('Error finding user by email', { email, error });
      throw error;
    }
  }

  findByUsername(username: string): User | null {
    try {
      const row = this.findByUsernameStmt.get(username);
      return row ? this.mapDatabaseUser(row) : null;
    } catch (error) {
      logger.error('Error finding user by username', { username, error });
      throw error;
    }
  }

  create(userData: Omit<User, 'id' | 'createdAt'>): User {
    const id = uuidv4();
    const now = new Date();
    
    try {
      // Check if email already exists
      const existingUser = this.findByEmail(userData.email);
      if (existingUser) {
        throw new ConflictError('User with this email already exists');
      }

      // Check if username already exists (if provided)
      if (userData.username) {
        const existingUsername = this.findByUsername(userData.username);
        if (existingUsername) {
          throw new ConflictError('User with this username already exists');
        }
      }

      const result = this.createStmt.run([
        id,
        userData.email,
        userData.username || null,
        userData.passwordHash,
        userData.firstName,
        userData.lastName,
        userData.role,
        userData.isActive !== false ? 1 : 0,
        now.toISOString(),
        now.toISOString()
      ]);

      logger.info('User created successfully', { 
        id, 
        email: userData.email,
        role: userData.role
      });

      // Return the created user
      const createdUser = this.findById(id as UserId);
      if (!createdUser) {
        throw new Error('Failed to retrieve created user');
      }

      return createdUser;
    } catch (error) {
      logger.error('Error creating user', { userData: { ...userData, passwordHash: '[REDACTED]' }, error });
      throw error;
    }
  }

  update(id: UserId, updates: Partial<Omit<User, 'id' | 'createdAt'>>): User {
    try {
      const existingUser = this.findById(id);
      if (!existingUser) {
        throw new NotFoundError('User not found');
      }

      // Build dynamic update query
      const updateFields: string[] = [];
      const values: any[] = [];

      if (updates.email !== undefined) {
        // Check for email conflicts
        const emailConflict = this.findByEmail(updates.email);
        if (emailConflict && emailConflict.id !== id) {
          throw new ConflictError('User with this email already exists');
        }
        updateFields.push('email = ?');
        values.push(updates.email);
      }
      if (updates.username !== undefined) {
        // Check for username conflicts
        const usernameConflict = this.findByUsername(updates.username);
        if (usernameConflict && usernameConflict.id !== id) {
          throw new ConflictError('User with this username already exists');
        }
        updateFields.push('username = ?');
        values.push(updates.username);
      }
      if (updates.passwordHash !== undefined) {
        updateFields.push('password_hash = ?');
        values.push(updates.passwordHash);
      }
      if (updates.firstName !== undefined) {
        updateFields.push('first_name = ?');
        values.push(updates.firstName);
      }
      if (updates.lastName !== undefined) {
        updateFields.push('last_name = ?');
        values.push(updates.lastName);
      }
      if (updates.role !== undefined) {
        updateFields.push('role = ?');
        values.push(updates.role);
      }
      if (updates.isActive !== undefined) {
        updateFields.push('is_active = ?');
        values.push(updates.isActive ? 1 : 0);
      }

      if (updateFields.length === 0) {
        return existingUser; // No updates to make
      }

      updateFields.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(id);

      const updateStmt = db.prepare(`
        UPDATE users SET ${updateFields.join(', ')} WHERE id = ?
      `);
      updateStmt.run(values);

      logger.info('User updated successfully', { id, updates });

      // Return the updated user
      const updatedUser = this.findById(id);
      if (!updatedUser) {
        throw new Error('Failed to retrieve updated user');
      }

      return updatedUser;
    } catch (error) {
      logger.error('Error updating user', { id, updates, error });
      throw error;
    }
  }

  delete(id: UserId): void {
    try {
      const result = this.softDeleteStmt.run([new Date().toISOString(), id]);

      if (result.changes === 0) {
        throw new NotFoundError('User not found or already deleted');
      }

      logger.info('User soft deleted successfully', { id });
    } catch (error) {
      logger.error('Error soft deleting user', { id, error });
      throw error;
    }
  }

  // Alias for delete method
  softDelete(id: UserId): void {
    return this.delete(id);
  }

  findAll(): User[] {
    try {
      const rows = this.findAllStmt.all();
      return rows.map(row => this.mapDatabaseUser(row));
    } catch (error) {
      logger.error('Error finding all users', { error });
      throw error;
    }
  }

  updateLastLogin(id: UserId): void {
    try {
      this.updateLastLoginStmt.run([new Date().toISOString(), new Date().toISOString(), id]);
      logger.debug('User last login updated', { id });
    } catch (error) {
      logger.error('Error updating last login', { id, error });
      throw error;
    }
  }

  private mapDatabaseUser(dbUser: DatabaseUser): User {
    return {
      id: dbUser.id as UserId,
      email: dbUser.email,
      username: dbUser.username || undefined,
      passwordHash: dbUser.password_hash,
      firstName: dbUser.first_name,
      lastName: dbUser.last_name,
      role: dbUser.role,
      isActive: Boolean(dbUser.is_active),
      createdAt: new Date(dbUser.created_at),
      updatedAt: dbUser.updated_at ? new Date(dbUser.updated_at) : undefined
    };
  }
}