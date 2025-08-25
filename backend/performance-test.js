// Performance Benchmarking Script for Healthcare Service Log Portal
// Following documented SQLite optimization and Express.js performance patterns

import { performance } from 'perf_hooks';
import Database from 'better-sqlite3';
import fetch from 'node-fetch';

class PerformanceBenchmark {
  constructor() {
    this.apiBaseUrl = 'http://localhost:5000/api';
    this.authToken = null;
    this.db = null;
    this.results = {
      databaseTests: {},
      apiTests: {},
      memoryTests: {},
      summary: {}
    };
  }

  async setup() {
    console.log('🔧 Setting up performance benchmark environment...');
    
    // Setup database connection for direct testing
    this.db = new Database('./healthcare.db');
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = -64000');
    this.db.pragma('temp_store = memory');

    // Authenticate for API tests
    try {
      const loginResponse = await fetch(`${this.apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123'
        })
      });
      
      const loginData = await loginResponse.json();
      this.authToken = loginData.data?.token;
      
      if (!this.authToken) {
        console.warn('⚠️  Authentication failed, API tests will be skipped');
      }
    } catch (error) {
      console.warn('⚠️  Could not authenticate, API tests will be skipped:', error.message);
    }

    console.log('✅ Performance benchmark setup complete');
  }

  // Database Performance Tests
  async testDatabasePerformance() {
    console.log('\n📊 Running database performance tests...');

    // Test 1: Service log query performance
    await this.measureOperation('Basic Service Log Query', async () => {
      const stmt = this.db.prepare(`
        SELECT * FROM service_logs 
        WHERE user_id = ? AND is_draft = 0 
        ORDER BY created_at DESC 
        LIMIT 50
      `);
      return stmt.all('user-1');
    });

    // Test 2: Complex join query performance
    await this.measureOperation('Complex Service Log Join', async () => {
      const stmt = this.db.prepare(`
        SELECT 
          sl.*,
          c.name as client_name,
          a.name as activity_name,
          COUNT(pe.id) as patient_count
        FROM service_logs sl
        LEFT JOIN clients c ON sl.client_id = c.id
        LEFT JOIN activities a ON sl.activity_id = a.id
        LEFT JOIN patient_entries pe ON sl.id = pe.service_log_id
        WHERE sl.service_date >= date('now', '-30 days')
        GROUP BY sl.id
        ORDER BY sl.created_at DESC
        LIMIT 100
      `);
      return stmt.all();
    });

    // Test 3: Statistics aggregation query
    await this.measureOperation('Statistics Aggregation', async () => {
      const stmt = this.db.prepare(`
        SELECT 
          COUNT(*) as total_logs,
          SUM(CASE WHEN is_draft = 1 THEN 1 ELSE 0 END) as total_drafts,
          SUM(CASE WHEN is_draft = 0 THEN 1 ELSE 0 END) as total_submitted,
          SUM(patient_count) as total_patients,
          AVG(CAST(patient_count AS FLOAT)) as avg_patients_per_log
        FROM service_logs sl
        WHERE sl.service_date >= date('now', '-90 days')
        AND (sl.deleted_at IS NULL OR sl.deleted_at = '')
      `);
      return stmt.get();
    });

    // Test 4: Bulk insert performance
    await this.measureOperation('Bulk Insert (100 records)', async () => {
      const stmt = this.db.prepare(`
        INSERT INTO patient_entries (id, service_log_id, appointment_type, outcome_id)
        VALUES (?, ?, ?, ?)
      `);
      
      const transaction = this.db.transaction((entries) => {
        for (const entry of entries) {
          stmt.run(...entry);
        }
      });

      const testEntries = Array.from({ length: 100 }, (_, i) => [
        `test-entry-${i}`,
        'test-service-log-1',
        'new',
        1
      ]);

      return transaction(testEntries);
    });

    // Test 5: Index effectiveness
    await this.testIndexEffectiveness();

    console.log('✅ Database performance tests completed');
  }

  async testIndexEffectiveness() {
    console.log('   🔍 Testing index effectiveness...');

    // Test query plans for critical queries
    const queries = [
      {
        name: 'Service Log by User',
        query: 'SELECT * FROM service_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
      },
      {
        name: 'Service Log by Date Range',
        query: 'SELECT * FROM service_logs WHERE service_date BETWEEN ? AND ? ORDER BY service_date'
      },
      {
        name: 'Patient Entries by Service Log',
        query: 'SELECT * FROM patient_entries WHERE service_log_id = ?'
      }
    ];

    for (const { name, query } of queries) {
      try {
        const explainStmt = this.db.prepare(`EXPLAIN QUERY PLAN ${query}`);
        const plan = explainStmt.all('param1', 'param2');
        
        const usesIndex = plan.some(row => 
          row.detail && row.detail.toLowerCase().includes('using index')
        );

        console.log(`     ${name}: ${usesIndex ? '✅ Uses Index' : '❌ No Index'}`);
      } catch (error) {
        console.log(`     ${name}: ❌ Error testing: ${error.message}`);
      }
    }
  }

  // API Performance Tests
  async testApiPerformance() {
    if (!this.authToken) {
      console.log('\n⚠️  Skipping API tests - no authentication token');
      return;
    }

    console.log('\n🌐 Running API performance tests...');

    // Test 1: Service logs list endpoint
    await this.measureApiOperation('GET /api/service-logs', async () => {
      return fetch(`${this.apiBaseUrl}/service-logs?page=1&limit=50`, {
        headers: { 'Authorization': `Bearer ${this.authToken}` }
      });
    });

    // Test 2: Export endpoint
    await this.measureApiOperation('GET /api/reports/export', async () => {
      return fetch(`${this.apiBaseUrl}/reports/export?format=csv&dateFrom=2023-01-01&dateTo=2024-12-31`, {
        headers: { 'Authorization': `Bearer ${this.authToken}` }
      });
    });

    // Test 3: Summary report endpoint
    await this.measureApiOperation('GET /api/reports/summary', async () => {
      return fetch(`${this.apiBaseUrl}/reports/summary?dateFrom=2023-01-01&dateTo=2024-12-31`, {
        headers: { 'Authorization': `Bearer ${this.authToken}` }
      });
    });

    console.log('✅ API performance tests completed');
  }

  // Memory Usage Tests
  async testMemoryUsage() {
    console.log('\n💾 Running memory usage tests...');

    const initialMemory = process.memoryUsage();
    
    // Simulate large data processing
    await this.measureOperation('Large Dataset Processing', async () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => ({
        id: `item-${i}`,
        data: `data-${Math.random().toString(36).substring(7)}`,
        timestamp: new Date().toISOString()
      }));

      // Process data
      return largeArray
        .filter(item => item.data.length > 5)
        .map(item => ({ ...item, processed: true }))
        .sort((a, b) => a.id.localeCompare(b.id));
    });

    const finalMemory = process.memoryUsage();
    
    this.results.memoryTests = {
      initialHeapUsed: Math.round(initialMemory.heapUsed / 1024 / 1024),
      finalHeapUsed: Math.round(finalMemory.heapUsed / 1024 / 1024),
      heapDifference: Math.round((finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024),
      rss: Math.round(finalMemory.rss / 1024 / 1024),
      external: Math.round(finalMemory.external / 1024 / 1024)
    };

    console.log(`   Initial Heap: ${this.results.memoryTests.initialHeapUsed} MB`);
    console.log(`   Final Heap: ${this.results.memoryTests.finalHeapUsed} MB`);
    console.log(`   Heap Growth: ${this.results.memoryTests.heapDifference} MB`);
    console.log(`   RSS: ${this.results.memoryTests.rss} MB`);

    console.log('✅ Memory usage tests completed');
  }

  // Helper Methods
  async measureOperation(name, operation) {
    const iterations = 10;
    const times = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      try {
        await operation();
        const end = performance.now();
        times.push(end - start);
      } catch (error) {
        console.error(`   ❌ ${name} failed:`, error.message);
        return;
      }
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];

    const result = {
      average: Math.round(avg * 100) / 100,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      p95: Math.round(p95 * 100) / 100,
      iterations
    };

    this.results.databaseTests[name] = result;

    const status = avg < 200 ? '✅' : avg < 500 ? '⚠️' : '❌';
    console.log(`   ${status} ${name}: ${result.average}ms avg (min: ${result.min}ms, p95: ${result.p95}ms)`);

    return result;
  }

  async measureApiOperation(name, operation) {
    const iterations = 5;
    const times = [];
    const sizes = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      try {
        const response = await operation();
        const end = performance.now();
        
        if (response.ok) {
          times.push(end - start);
          const contentLength = response.headers.get('content-length');
          if (contentLength) {
            sizes.push(parseInt(contentLength));
          }
        } else {
          console.error(`   ❌ ${name} failed: ${response.status} ${response.statusText}`);
          return;
        }
      } catch (error) {
        console.error(`   ❌ ${name} failed:`, error.message);
        return;
      }
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    const avgSize = sizes.length > 0 ? sizes.reduce((a, b) => a + b, 0) / sizes.length : 0;

    const result = {
      average: Math.round(avg * 100) / 100,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      averageSize: Math.round(avgSize / 1024 * 100) / 100,
      iterations
    };

    this.results.apiTests[name] = result;

    const status = avg < 200 ? '✅' : avg < 500 ? '⚠️' : '❌';
    console.log(`   ${status} ${name}: ${result.average}ms avg (${result.averageSize}KB)`);

    return result;
  }

  generateReport() {
    console.log('\n📋 Performance Benchmark Report');
    console.log('================================');
    
    // Performance targets validation
    const targets = {
      pageLoad: 2000,
      apiResponse: 200,
      searchResults: 500,
      exportGeneration: 5000
    };

    console.log('\n🎯 Performance Targets vs Results:');
    
    // Database performance summary
    const dbResults = Object.values(this.results.databaseTests);
    if (dbResults.length > 0) {
      const avgDbTime = dbResults.reduce((sum, r) => sum + r.average, 0) / dbResults.length;
      console.log(`   Database Queries: ${avgDbTime.toFixed(2)}ms avg (Target: <${targets.apiResponse}ms) ${avgDbTime < targets.apiResponse ? '✅' : '❌'}`);
    }

    // API performance summary
    const apiResults = Object.values(this.results.apiTests);
    if (apiResults.length > 0) {
      const avgApiTime = apiResults.reduce((sum, r) => sum + r.average, 0) / apiResults.length;
      console.log(`   API Endpoints: ${avgApiTime.toFixed(2)}ms avg (Target: <${targets.apiResponse}ms) ${avgApiTime < targets.apiResponse ? '✅' : '❌'}`);
    }

    // Memory usage summary
    if (this.results.memoryTests.heapDifference !== undefined) {
      console.log(`   Memory Usage: ${this.results.memoryTests.heapDifference}MB growth (RSS: ${this.results.memoryTests.rss}MB)`);
    }

    console.log('\n📊 Detailed Results:');
    console.log(JSON.stringify(this.results, null, 2));

    return this.results;
  }

  async cleanup() {
    // Clean up test data
    if (this.db) {
      try {
        this.db.exec(`DELETE FROM patient_entries WHERE id LIKE 'test-entry-%'`);
        this.db.close();
      } catch (error) {
        console.warn('Cleanup warning:', error.message);
      }
    }
    console.log('\n🧹 Cleanup completed');
  }

  async run() {
    try {
      await this.setup();
      await this.testDatabasePerformance();
      await this.testApiPerformance();
      await this.testMemoryUsage();
      
      const report = this.generateReport();
      
      return report;
    } catch (error) {
      console.error('❌ Performance benchmark failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

// Run benchmark if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const benchmark = new PerformanceBenchmark();
  benchmark.run()
    .then(() => {
      console.log('\n✅ Performance benchmark completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Performance benchmark failed:', error);
      process.exit(1);
    });
}

export default PerformanceBenchmark;