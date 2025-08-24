// Migration script to add client_id column to custom_fields table
// This enables client-specific custom form fields

const Database = require('better-sqlite3');
const path = require('path');

// Database path
const dbPath = path.join(__dirname, 'src', 'database', 'healthcare.db');

console.log('Starting migration: Add client_id column to custom_fields table');
console.log(`Database path: ${dbPath}`);

try {
  // Connect to database
  const db = new Database(dbPath);
  
  // Check if client_id column already exists
  const checkColumn = db.prepare(`
    PRAGMA table_info(custom_fields)
  `);
  
  const columns = checkColumn.all();
  const hasClientId = columns.some(col => col.name === 'client_id');
  
  if (hasClientId) {
    console.log('✅ client_id column already exists in custom_fields table');
    db.close();
    process.exit(0);
  }
  
  console.log('📋 Current custom_fields table structure:');
  columns.forEach(col => {
    console.log(`  - ${col.name}: ${col.type}${col.pk ? ' (PRIMARY KEY)' : ''}`);
  });
  
  // Begin transaction
  db.exec('BEGIN TRANSACTION');
  
  try {
    // Step 1: Add client_id column (nullable for backward compatibility)
    console.log('\n🔧 Adding client_id column...');
    db.exec(`
      ALTER TABLE custom_fields 
      ADD COLUMN client_id INTEGER REFERENCES clients(id)
    `);
    
    // Step 2: Create new indexes for client-specific queries
    console.log('📊 Creating indexes for client-specific queries...');
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_custom_fields_client 
      ON custom_fields (client_id)
    `);
    
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_custom_fields_client_active 
      ON custom_fields (client_id, is_active, field_order)
    `);
    
    // Step 3: Verify the migration
    console.log('🔍 Verifying migration...');
    const verifyColumns = db.prepare('PRAGMA table_info(custom_fields)').all();
    const clientIdColumn = verifyColumns.find(col => col.name === 'client_id');
    
    if (!clientIdColumn) {
      throw new Error('client_id column was not added successfully');
    }
    
    console.log(`✅ client_id column added successfully: ${clientIdColumn.type}`);
    
    // Step 4: Check existing custom fields
    const existingFieldsCount = db.prepare('SELECT COUNT(*) as count FROM custom_fields').get();
    console.log(`📊 Existing custom fields: ${existingFieldsCount.count}`);
    
    if (existingFieldsCount.count > 0) {
      console.log('ℹ️  Note: Existing custom fields have client_id = NULL (global fields)');
      console.log('   These fields will continue to work as before.');
      console.log('   New client-specific fields will have a specific client_id value.');
    }
    
    // Commit transaction
    db.exec('COMMIT');
    console.log('\n✅ Migration completed successfully!');
    
    // Display final schema
    console.log('\n📋 Final custom_fields table structure:');
    const finalColumns = db.prepare('PRAGMA table_info(custom_fields)').all();
    finalColumns.forEach(col => {
      console.log(`  - ${col.name}: ${col.type}${col.pk ? ' (PRIMARY KEY)' : ''}`);
    });
    
  } catch (error) {
    // Rollback on error
    db.exec('ROLLBACK');
    throw error;
  }
  
  // Close database connection
  db.close();
  console.log('\n🔒 Database connection closed');
  
} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  console.error(error);
  process.exit(1);
}

console.log('\n🎉 Migration completed successfully!');
console.log('\nNext steps:');
console.log('1. Restart the backend server to pick up schema changes');
console.log('2. Update CustomFieldRepository to handle client-specific queries');
console.log('3. Create API endpoints for client-specific field management');
console.log('4. Update frontend to show client-specific fields');