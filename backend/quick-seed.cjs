const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');

// Open database
const db = new Database('./healthcare.db');

// Create admin user with simple password
const hashedPassword = bcrypt.hashSync('admin123', 10);

// Delete existing admin if exists
try {
  db.prepare('DELETE FROM users WHERE email = ?').run('admin@test.com');
} catch (e) {}

// Insert new admin
try {
  db.prepare(`
    INSERT INTO users (id, email, password_hash, role, first_name, last_name, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    '11111111-1111-1111-1111-111111111111',
    'admin@test.com',
    hashedPassword,
    'admin',
    'Admin',
    'User',
    1,
    new Date().toISOString(),
    new Date().toISOString()
  );
  
  console.log('✅ Admin user created: admin@test.com / admin123');
} catch (error) {
  console.error('❌ Error creating admin:', error.message);
}

// Create some basic data
try {
  // Insert client
  db.prepare('INSERT OR IGNORE INTO clients (name, is_active) VALUES (?, ?)').run('Test Clinic', 1);
  
  // Insert activity
  db.prepare('INSERT OR IGNORE INTO activities (name, is_active) VALUES (?, ?)').run('General Checkup', 1);
  
  // Insert outcome
  db.prepare('INSERT OR IGNORE INTO outcomes (name, is_active) VALUES (?, ?)').run('Completed', 1);
  
  console.log('✅ Basic data seeded');
} catch (error) {
  console.error('❌ Error seeding data:', error.message);
}

db.close();
console.log('✅ Setup complete!');