// Script to create admin user for testing
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const db = new Database('./healthcare.db');

async function createAdminUser() {
  try {
    // Check if admin user already exists
    const existingAdmin = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@test.com');
    
    if (existingAdmin) {
      console.log('Admin user already exists');
      db.close();
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    // Insert admin user
    const adminId = uuidv4();
    const now = new Date().toISOString();
    
    const result = db.prepare(`
      INSERT INTO users (
        id, email, username, password_hash, first_name, last_name, 
        role, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      adminId,
      'admin@test.com',
      'admin_user',
      hashedPassword,
      'Admin',
      'User',
      'admin',
      1,
      now,
      now
    );
    
    console.log('Admin user created successfully:', {
      id: adminId,
      email: 'admin@test.com',
      role: 'admin'
    });
    console.log('Login credentials: admin@test.com / admin123');
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    db.close();
  }
}

createAdminUser();