const sqlite = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');

const db = sqlite('./healthcare.db');

async function createTestData() {
  try {
    console.log('Creating test data...');

    // Create admin user
    const adminPasswordHash = await bcrypt.hash('admin123', 12);
    const adminId = uuid();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT OR IGNORE INTO users (id, username, email, password_hash, role, first_name, last_name, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(adminId, 'admin', 'admin@healthcare.local', adminPasswordHash, 'admin', 'Admin', 'User', 1, now, now);

    // Create candidate user  
    const candidatePasswordHash = await bcrypt.hash('candidate123', 12);
    const candidateId = uuid();

    db.prepare(`
      INSERT OR IGNORE INTO users (id, username, email, password_hash, role, first_name, last_name, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(candidateId, 'candidate', 'candidate@healthcare.local', candidatePasswordHash, 'candidate', 'Candidate', 'User', 1, now, now);

    // Create test clients
    db.prepare(`INSERT OR IGNORE INTO clients (name, is_active, created_at, updated_at) VALUES (?, ?, ?, ?)`).run('Memorial Hospital', 1, now, now);
    db.prepare(`INSERT OR IGNORE INTO clients (name, is_active, created_at, updated_at) VALUES (?, ?, ?, ?)`).run('City Medical Center', 1, now, now);
    db.prepare(`INSERT OR IGNORE INTO clients (name, is_active, created_at, updated_at) VALUES (?, ?, ?, ?)`).run('Regional Health Clinic', 1, now, now);

    // Create test activities
    db.prepare(`INSERT OR IGNORE INTO activities (name, is_active, created_at, updated_at) VALUES (?, ?, ?, ?)`).run('Cardiology', 1, now, now);
    db.prepare(`INSERT OR IGNORE INTO activities (name, is_active, created_at, updated_at) VALUES (?, ?, ?, ?)`).run('Emergency Medicine', 1, now, now);
    db.prepare(`INSERT OR IGNORE INTO activities (name, is_active, created_at, updated_at) VALUES (?, ?, ?, ?)`).run('Internal Medicine', 1, now, now);

    // Create test outcomes
    db.prepare(`INSERT OR IGNORE INTO outcomes (name, is_active, created_at, updated_at) VALUES (?, ?, ?, ?)`).run('Discharged Home', 1, now, now);
    db.prepare(`INSERT OR IGNORE INTO outcomes (name, is_active, created_at, updated_at) VALUES (?, ?, ?, ?)`).run('Admitted', 1, now, now);
    db.prepare(`INSERT OR IGNORE INTO outcomes (name, is_active, created_at, updated_at) VALUES (?, ?, ?, ?)`).run('Referred', 1, now, now);

    console.log('✅ Test data created successfully!');
    console.log('\n📝 Login credentials:');
    console.log('👨‍💼 Admin: admin@healthcare.local / admin123');
    console.log('👩‍⚕️ Candidate: candidate@healthcare.local / candidate123');

  } catch (error) {
    console.log('Note: Some test data might already exist, which is fine.');
    console.log(error.message);
  } finally {
    db.close();
  }
}

createTestData();