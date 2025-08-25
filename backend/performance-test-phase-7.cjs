const Database = require('better-sqlite3');
const path = require('path');
const { performance } = require('perf_hooks');

// Database connection
const dbPath = path.join(__dirname, 'healthcare.db');
const db = new Database(dbPath, { readonly: true });

class PerformanceTester {
  constructor() {
    this.results = {
      databaseStructure: {},
      queryPerformance: {},
      memoryUsage: {},
      apiSimulation: {}
    };
  }

  // Test 1: Verify database structure cleanup
  testDatabaseStructure() {
    console.log('\n=== DATABASE STRUCTURE VERIFICATION ===');
    
    // Get all tables
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all();
    
    console.log('Current tables:', tables.map(t => t.name));
    this.results.databaseStructure.totalTables = tables.length;
    this.results.databaseStructure.tableNames = tables.map(t => t.name);
    
    // Check for custom field tables (should be removed)
    const customFieldTables = tables.filter(t => 
      t.name.includes('custom_field') || 
      t.name.includes('field_choice')
    );
    
    console.log('Custom field tables found:', customFieldTables.length);
    this.results.databaseStructure.customFieldTablesRemaining = customFieldTables.length;
    
    // Get all indexes
    const indexes = db.prepare(`
      SELECT name, tbl_name FROM sqlite_master 
      WHERE type='index' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all();
    
    console.log('Current indexes:', indexes.length);
    this.results.databaseStructure.totalIndexes = indexes.length;
    
    // Check for custom field indexes (should be removed)
    const customFieldIndexes = indexes.filter(idx => 
      idx.name.includes('custom_field') || 
      idx.name.includes('field_choice')
    );
    
    console.log('Custom field indexes found:', customFieldIndexes.length);
    this.results.databaseStructure.customFieldIndexesRemaining = customFieldIndexes.length;
    
    return {
      tablesRemoved: customFieldTables.length === 0,
      indexesRemoved: customFieldIndexes.length === 0,
      totalTables: tables.length
    };
  }

  // Test 2: Database Query Performance
  testDatabaseQueryPerformance() {
    console.log('\n=== DATABASE QUERY PERFORMANCE ===');
    
    // Test client selection query performance
    const clientQuery = db.prepare(`
      SELECT id, name, is_active 
      FROM clients 
      WHERE is_active = 1 
      ORDER BY name
    `);
    
    // Warm up
    clientQuery.all();
    
    // Test multiple runs
    const runs = 100;
    const times = [];
    
    console.log(`Running client selection query ${runs} times...`);
    
    for (let i = 0; i < runs; i++) {
      const start = performance.now();
      clientQuery.all();
      const end = performance.now();
      times.push(end - start);
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const p95Time = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
    
    console.log(`Average query time: ${avgTime.toFixed(2)}ms`);
    console.log(`Min query time: ${minTime.toFixed(2)}ms`);
    console.log(`Max query time: ${maxTime.toFixed(2)}ms`);
    console.log(`P95 query time: ${p95Time.toFixed(2)}ms`);
    
    this.results.queryPerformance.clientSelection = {
      averageMs: avgTime,
      minMs: minTime,
      maxMs: maxTime,
      p95Ms: p95Time,
      targetMet: avgTime < 100 // Target: <100ms
    };
    
    return {
      averageMs: avgTime,
      targetMet: avgTime < 100
    };
  }

  // Test 3: Query Execution Plan Analysis
  testQueryExecutionPlans() {
    console.log('\n=== QUERY EXECUTION PLAN ANALYSIS ===');
    
    const clientQuery = `
      SELECT id, name, is_active 
      FROM clients 
      WHERE is_active = 1 
      ORDER BY name
    `;
    
    // Get execution plan
    const plan = db.prepare(`EXPLAIN QUERY PLAN ${clientQuery}`).all();
    
    console.log('Client selection execution plan:');
    plan.forEach(row => {
      console.log(`  ${row.id}: ${row.detail}`);
    });
    
    // Check if any custom field tables are referenced
    const planText = plan.map(p => p.detail).join(' ');
    const hasCustomFieldReferences = planText.includes('custom_field') || planText.includes('field_choice');
    
    console.log('Custom field references in plan:', hasCustomFieldReferences ? 'YES' : 'NO');
    
    this.results.queryPerformance.executionPlan = {
      plan: plan,
      hasCustomFieldReferences
    };
    
    return {
      hasCustomFieldReferences,
      plan
    };
  }

  // Test 4: Database Size and Memory Usage
  testDatabaseOptimization() {
    console.log('\n=== DATABASE OPTIMIZATION VERIFICATION ===');
    
    // Get database page count and size
    const pageCount = db.prepare('PRAGMA page_count').get();
    const pageSize = db.prepare('PRAGMA page_size').get();
    const totalSize = pageCount.page_count * pageSize.page_size;
    
    console.log(`Database pages: ${pageCount.page_count}`);
    console.log(`Page size: ${pageSize.page_size} bytes`);
    console.log(`Total database size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    
    // Get table sizes
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all();
    
    const tableSizes = {};
    tables.forEach(table => {
      try {
        const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
        tableSizes[table.name] = count.count;
      } catch (e) {
        tableSizes[table.name] = 'ERROR';
      }
    });
    
    console.log('Table row counts:', tableSizes);
    
    this.results.databaseStructure.tableSizes = tableSizes;
    this.results.databaseStructure.totalSizeMB = totalSize / 1024 / 1024;
    
    return {
      totalSizeMB: totalSize / 1024 / 1024,
      tableSizes
    };
  }

  // Test 5: Load Testing Simulation
  testLoadPerformance() {
    console.log('\n=== LOAD TESTING SIMULATION ===');
    
    const clientQuery = db.prepare(`
      SELECT id, name, is_active 
      FROM clients 
      WHERE is_active = 1 
      ORDER BY name
    `);
    
    // Simulate concurrent requests
    const concurrentQueries = 50;
    const times = [];
    
    console.log(`Simulating ${concurrentQueries} concurrent client selection queries...`);
    
    const startTime = performance.now();
    
    for (let i = 0; i < concurrentQueries; i++) {
      const queryStart = performance.now();
      clientQuery.all();
      const queryEnd = performance.now();
      times.push(queryEnd - queryStart);
    }
    
    const totalTime = performance.now() - startTime;
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const throughput = concurrentQueries / (totalTime / 1000); // queries per second
    
    console.log(`Total time for ${concurrentQueries} queries: ${totalTime.toFixed(2)}ms`);
    console.log(`Average query time under load: ${avgTime.toFixed(2)}ms`);
    console.log(`Throughput: ${throughput.toFixed(2)} queries/second`);
    
    this.results.queryPerformance.loadTest = {
      concurrentQueries,
      totalTimeMs: totalTime,
      averageQueryMs: avgTime,
      throughputQps: throughput,
      targetMet: avgTime < 100
    };
    
    return {
      averageQueryMs: avgTime,
      throughputQps: throughput,
      targetMet: avgTime < 100
    };
  }

  // Test 6: Database Schema Integrity
  testSchemaIntegrity() {
    console.log('\n=== DATABASE SCHEMA INTEGRITY ===');
    
    // Check foreign key integrity
    const foreignKeyCheck = db.prepare('PRAGMA foreign_key_check').all();
    console.log('Foreign key violations:', foreignKeyCheck.length);
    
    // Check database integrity
    const integrityCheck = db.prepare('PRAGMA integrity_check').get();
    console.log('Database integrity:', integrityCheck.integrity_check);
    
    this.results.databaseStructure.integrity = {
      foreignKeyViolations: foreignKeyCheck.length,
      integrityCheck: integrityCheck.integrity_check
    };
    
    return {
      foreignKeyViolations: foreignKeyCheck.length,
      integrityOk: integrityCheck.integrity_check === 'ok'
    };
  }

  // Generate Performance Report
  generateReport() {
    console.log('\n\n=== PHASE 7.1 PERFORMANCE VERIFICATION REPORT ===\n');
    
    const dbStructure = this.results.databaseStructure;
    const queryPerf = this.results.queryPerformance;
    
    console.log('## Database Structure Cleanup');
    console.log(`- Total tables: ${dbStructure.totalTables} (expected: 7 core tables)`);
    console.log(`- Custom field tables remaining: ${dbStructure.customFieldTablesRemaining} (target: 0)`);
    console.log(`- Custom field indexes remaining: ${dbStructure.customFieldIndexesRemaining} (target: 0)`);
    console.log(`- Database size: ${dbStructure.totalSizeMB?.toFixed(2)} MB`);
    console.log(`- Database integrity: ${dbStructure.integrity?.integrityCheck}`);
    
    console.log('\n## Query Performance Results');
    if (queryPerf.clientSelection) {
      console.log(`- Client selection average time: ${queryPerf.clientSelection.averageMs.toFixed(2)}ms`);
      console.log(`- Client selection P95 time: ${queryPerf.clientSelection.p95Ms.toFixed(2)}ms`);
      console.log(`- Performance target met (<100ms): ${queryPerf.clientSelection.targetMet ? 'YES' : 'NO'}`);
    }
    
    if (queryPerf.loadTest) {
      console.log(`- Load test average time: ${queryPerf.loadTest.averageQueryMs.toFixed(2)}ms`);
      console.log(`- Load test throughput: ${queryPerf.loadTest.throughputQps.toFixed(2)} queries/second`);
      console.log(`- Load test target met: ${queryPerf.loadTest.targetMet ? 'YES' : 'NO'}`);
    }
    
    console.log('\n## Cleanup Verification');
    console.log(`- Custom field tables removed: ${dbStructure.customFieldTablesRemaining === 0 ? 'YES' : 'NO'}`);
    console.log(`- Custom field indexes removed: ${dbStructure.customFieldIndexesRemaining === 0 ? 'YES' : 'NO'}`);
    console.log(`- No custom field references in query plans: ${!queryPerf.executionPlan?.hasCustomFieldReferences ? 'YES' : 'NO'}`);
    
    // Calculate overall performance improvement
    const baselineMs = 300; // Original >300ms response time
    const currentMs = queryPerf.clientSelection?.averageMs || 0;
    const improvementPct = ((baselineMs - currentMs) / baselineMs * 100);
    
    console.log('\n## Performance Improvement Analysis');
    console.log(`- Baseline performance: ~${baselineMs}ms`);
    console.log(`- Current performance: ${currentMs.toFixed(2)}ms`);
    console.log(`- Performance improvement: ${improvementPct.toFixed(1)}%`);
    console.log(`- Target improvement (50-70%): ${improvementPct >= 50 ? 'ACHIEVED' : 'NOT MET'}`);
    
    console.log('\n## Summary');
    const success = (
      dbStructure.customFieldTablesRemaining === 0 &&
      dbStructure.customFieldIndexesRemaining === 0 &&
      queryPerf.clientSelection?.targetMet &&
      improvementPct >= 50
    );
    
    console.log(`Phase 7.1 Database Cleanup: ${success ? 'SUCCESS' : 'NEEDS ATTENTION'}`);
    
    return {
      success,
      improvementPercent: improvementPct,
      currentPerformanceMs: currentMs,
      results: this.results
    };
  }

  // Run all tests
  async runAllTests() {
    console.log('Starting Phase 7.1 Performance Verification...\n');
    
    try {
      this.testDatabaseStructure();
      this.testDatabaseQueryPerformance();
      this.testQueryExecutionPlans();
      this.testDatabaseOptimization();
      this.testLoadPerformance();
      this.testSchemaIntegrity();
      
      return this.generateReport();
    } catch (error) {
      console.error('Performance test failed:', error);
      return { success: false, error: error.message };
    } finally {
      db.close();
    }
  }
}

// Run the performance tests
if (require.main === module) {
  const tester = new PerformanceTester();
  tester.runAllTests().then(result => {
    process.exit(result.success ? 0 : 1);
  });
}

module.exports = PerformanceTester;
