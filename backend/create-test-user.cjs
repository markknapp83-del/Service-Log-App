const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const db = Database('./healthcare.db');

async function createTestUser() {
  try {
    const hashedPassword = await bcrypt.hash('password123', 12);
    const now = new Date().toISOString();
    
    const userId = uuidv4();
    
    const stmt = db.prepare(`
      INSERT INTO users (id, email, password_hash, role, first_name, last_name, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(userId, 'test@test.com', hashedPassword, 'candidate', 'Test', 'User', 1, now, now);
    
    console.log('Test user created successfully:', {
      id: userId,
      email: 'test@test.com',
      role: 'candidate'
    });
    
  } catch (error) {
    console.error('Error creating test user:', error);
  } finally {
    db.close();
  }
}

createTestUser();
