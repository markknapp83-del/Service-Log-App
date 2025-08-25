const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

async function createAdminUser() {
  const db = new Database('./healthcare.db');
  
  try {
    // Check if admin exists
    const existingAdmin = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@healthcare.local');
    
    if (existingAdmin) {
      console.log('Admin user already exists');
      return;
    }
    
    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    const result = db.prepare(`
      INSERT INTO users (username, email, password_hash, role, first_name, last_name, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'admin',
      'admin@healthcare.local', 
      hashedPassword,
      'admin',
      'System',
      'Administrator',
      1,
      new Date().toISOString()
    );
    
    console.log('Admin user created successfully:', result);
    
    // Create some basic data
    console.log('Creating basic clients...');
    const clientInsert = db.prepare(`
      INSERT INTO clients (name, is_active) VALUES (?, ?)
    `);
    clientInsert.run('Downtown Clinic', 1);
    clientInsert.run('North Campus Medical', 1);
    clientInsert.run('Community Health Center', 1);
    
    console.log('Creating basic activities...');
    const activityInsert = db.prepare(`
      INSERT INTO activities (name, is_active) VALUES (?, ?)
    `);
    activityInsert.run('General Consultation', 1);
    activityInsert.run('Follow-up Visit', 1);
    activityInsert.run('Health Screening', 1);
    
    console.log('Creating basic outcomes...');
    const outcomeInsert = db.prepare(`
      INSERT INTO outcomes (name, is_active) VALUES (?, ?)
    `);
    outcomeInsert.run('Completed Successfully', 1);
    outcomeInsert.run('Referred to Specialist', 1);
    outcomeInsert.run('Follow-up Required', 1);
    
    console.log('Database seeded successfully!');
    
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    db.close();
  }
}

createAdminUser();