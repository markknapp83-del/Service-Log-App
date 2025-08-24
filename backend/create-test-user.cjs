// Simple script to create test user
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const db = new Database('./healthcare.db');

async function createTestUser() {
  try {
    // Check if user already exists
    const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get('test@test.com');
    
    if (existingUser) {
      console.log('Test user already exists');
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash('password123', 12);
    
    // Insert test user
    const result = db.prepare(`
      INSERT INTO users (
        id, email, username, password_hash, first_name, last_name, 
        role, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run([
      'test-user-id',
      'test@test.com',
      'testuser',
      hashedPassword,
      'Test',
      'User',
      'candidate',
      1,
      new Date().toISOString(),
      new Date().toISOString()
    ]);
    
    console.log('Test user created successfully:', result);
  } catch (error) {
    console.error('Error creating test user:', error);
  } finally {
    db.close();
  }
}

createTestUser();