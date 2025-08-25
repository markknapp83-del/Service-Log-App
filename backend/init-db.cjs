// Direct database initialization script
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = './database/healthcare.db';
const db = new Database(dbPath);

console.log('Initializing database:', dbPath);

// Enable foreign key constraints
db.pragma('foreign_keys = ON');

// Create tables
console.log('Creating tables...');

// Users table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'candidate')),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    last_login_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  )
`);

// Clients table
db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
  )
`);

// Activities table  
db.exec(`
  CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
  )
`);

// Outcomes table
db.exec(`
  CREATE TABLE IF NOT EXISTS outcomes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
  )
`);

// Service logs table
db.exec(`
  CREATE TABLE IF NOT EXISTS service_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    client_id INTEGER NOT NULL,
    activity_id INTEGER NOT NULL,
    service_date TEXT NOT NULL,
    patient_count INTEGER NOT NULL DEFAULT 0,
    is_draft INTEGER DEFAULT 0,
    submitted_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (client_id) REFERENCES clients(id),
    FOREIGN KEY (activity_id) REFERENCES activities(id)
  )
`);

// Patient entries table
db.exec(`
  CREATE TABLE IF NOT EXISTS patient_entries (
    id TEXT PRIMARY KEY,
    service_log_id TEXT NOT NULL,
    appointment_type TEXT NOT NULL CHECK (appointment_type IN ('new', 'followup', 'dna')),
    outcome_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,
    FOREIGN KEY (service_log_id) REFERENCES service_logs(id) ON DELETE CASCADE,
    FOREIGN KEY (outcome_id) REFERENCES outcomes(id)
  )
`);

console.log('Tables created successfully');

// Insert seed data
console.log('Inserting seed data...');

// Clear existing data first
db.prepare('DELETE FROM clients').run();
db.prepare('DELETE FROM activities').run();
db.prepare('DELETE FROM outcomes').run();

// Insert clients with proper structure
const clientData = [
  'Main Hospital',
  'Community Health Center', 
  'Outpatient Center',
  'Emergency Department',
  'Pediatric Ward'
];

for (const name of clientData) {
  try {
    db.prepare('INSERT INTO clients (name, is_active) VALUES (?, 1)').run(name);
    console.log(`Inserted client: ${name}`);
  } catch (err) {
    console.log('Client insert error:', err.message);
  }
}

// Insert activities  
const activityData = [
  'General Checkup',
  'Physical Therapy',
  'Diagnostic Imaging', 
  'Laboratory Tests',
  'Preventive Care',
  'Emergency Treatment'
];

for (const name of activityData) {
  try {
    db.prepare('INSERT INTO activities (name, is_active) VALUES (?, 1)').run(name);
    console.log(`Inserted activity: ${name}`);
  } catch (err) {
    console.log('Activity insert error:', err.message);
  }
}

// Insert outcomes
const outcomeData = [
  'Completed',
  'Follow-up Required',
  'Referred to Specialist', 
  'Treatment Declined',
  'No Show',
  'Emergency Intervention'
];

for (const name of outcomeData) {
  try {
    db.prepare('INSERT INTO outcomes (name, is_active) VALUES (?, 1)').run(name);
    console.log(`Inserted outcome: ${name}`);
  } catch (err) {
    console.log('Outcome insert error:', err.message);
  }
}

// Check final counts
console.log('\nFinal counts:');
console.log('Clients:', db.prepare('SELECT COUNT(*) as count FROM clients').get().count);
console.log('Activities:', db.prepare('SELECT COUNT(*) as count FROM activities').get().count);  
console.log('Outcomes:', db.prepare('SELECT COUNT(*) as count FROM outcomes').get().count);

console.log('\n=== Sample Data ===');
console.log('Clients:', db.prepare('SELECT id, name FROM clients LIMIT 3').all());
console.log('Activities:', db.prepare('SELECT id, name FROM activities LIMIT 3').all());
console.log('Outcomes:', db.prepare('SELECT id, name FROM outcomes LIMIT 3').all());

db.close();
console.log('Database initialization completed successfully!');