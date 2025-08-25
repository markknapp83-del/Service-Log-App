const Database = require('better-sqlite3');
const path = require('path');

console.log('=== DATABASE CONNECTION TEST ===');

const dbPath = path.join(__dirname, 'healthcare.db');
const db = new Database(dbPath);

try {
  console.log('1. Testing basic connectivity...');
  db.exec('SELECT 1');
  console.log('✓ Database connected successfully');

  console.log('\n2. Testing audit_log table...');
  const auditCount = db.prepare('SELECT COUNT(*) as count FROM audit_log').get();
  console.log(`✓ audit_log table has ${auditCount.count} records`);

  console.log('\n3. Testing healthcare metrics queries...');
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  // Test active users query
  const activeUsers = db.prepare(`
    SELECT COUNT(DISTINCT user_id) as count
    FROM audit_log 
    WHERE timestamp > ?
  `).get(oneDayAgo);
  console.log(`✓ Active users in last 24h: ${activeUsers.count}`);
  
  // Test patient access query
  const patientAccess = db.prepare(`
    SELECT COUNT(*) as count
    FROM audit_log 
    WHERE action LIKE '%patient%' AND timestamp > ?
  `).get(oneDayAgo);
  console.log(`✓ Patient access events in last 24h: ${patientAccess.count}`);
  
  // Test service logs query
  const serviceLogs = db.prepare(`
    SELECT COUNT(*) as count
    FROM service_logs 
    WHERE created_at > ?
  `).get(oneDayAgo);
  console.log(`✓ Service logs created in last 24h: ${serviceLogs.count}`);

  console.log('\n4. Testing database performance metrics...');
  const startTime = Date.now();
  db.exec('SELECT 1');
  const responseTime = Date.now() - startTime;
  console.log(`✓ Database response time: ${responseTime}ms`);

  console.log('\n5. Testing database health info...');
  const walMode = db.pragma('journal_mode', { simple: true });
  const cacheSize = db.pragma('cache_size', { simple: true });
  const pageCount = db.pragma('page_count', { simple: true });
  const freePages = db.pragma('freelist_count', { simple: true });
  const integrityCheck = db.pragma('quick_check', { simple: true });
  
  console.log(`✓ WAL mode: ${walMode}`);
  console.log(`✓ Cache size: ${cacheSize}`);
  console.log(`✓ Page count: ${pageCount}`);
  console.log(`✓ Free pages: ${freePages}`);
  console.log(`✓ Integrity check: ${integrityCheck}`);

  console.log('\n🎉 ALL DATABASE TESTS PASSED!');
  console.log('✓ Database connectivity is working properly');
  console.log('✓ Healthcare metrics queries are functional');
  console.log('✓ Performance monitoring should work correctly');

} catch (error) {
  console.error('\n❌ DATABASE TEST FAILED:', error.message);
  console.error('Stack:', error.stack);
} finally {
  db.close();
}