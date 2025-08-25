const { spawn } = require('child_process');
const { performance } = require('perf_hooks');
const http = require('http');

class QuickAPITester {
  constructor() {
    this.serverProcess = null;
    this.results = {};
  }

  // Test API endpoint response time
  async testEndpoint(path, expectedStatus = [200, 401, 403]) {
    return new Promise((resolve, reject) => {
      const start = performance.now();
      
      const req = http.request({
        hostname: 'localhost',
        port: 3001, // Default backend port
        path: path,
        method: 'GET',
        timeout: 5000
      }, (res) => {
        const end = performance.now();
        const responseTime = end - start;
        
        res.on('data', () => {}); // Consume response data
        res.on('end', () => {
          resolve({
            path,
            responseTime,
            statusCode: res.statusCode,
            success: expectedStatus.includes(res.statusCode)
          });
        });
      });
      
      req.on('error', (error) => {
        const end = performance.now();
        const responseTime = end - start;
        
        // Connection refused is expected if server isn't running
        if (error.code === 'ECONNREFUSED') {
          resolve({
            path,
            responseTime,
            statusCode: 0,
            success: false,
            error: 'Server not running'
          });
        } else {
          reject(error);
        }
      });
      
      req.end();
    });
  }

  // Test multiple endpoints
  async testMultipleEndpoints() {
    console.log('\n=== QUICK API RESPONSE TIME TEST ===');
    
    const endpoints = [
      { path: '/health', name: 'Health Check' },
      { path: '/api/service-logs/clients', name: 'Service Log Clients' },
      { path: '/api/admin/clients', name: 'Admin Clients' },
      { path: '/api/auth/verify', name: 'Auth Verify' }
    ];
    
    console.log('Testing API endpoints (server must be running on port 3001)...');
    
    for (const endpoint of endpoints) {
      try {
        const result = await this.testEndpoint(endpoint.path);
        
        if (result.error) {
          console.log(`${endpoint.name} (${endpoint.path}): ${result.error}`);
        } else {
          console.log(`${endpoint.name} (${endpoint.path}): ${result.responseTime.toFixed(2)}ms (${result.statusCode})`);
        }
        
        this.results[endpoint.name] = result;
      } catch (error) {
        console.log(`${endpoint.name} (${endpoint.path}): ERROR - ${error.message}`);
        this.results[endpoint.name] = { error: error.message };
      }
    }
    
    return this.results;
  }

  // Generate quick report
  generateQuickReport() {
    console.log('\n=== QUICK API PERFORMANCE SUMMARY ===');
    
    const healthResult = this.results['Health Check'];
    if (healthResult && !healthResult.error) {
      console.log(`\nHealth Endpoint Performance:`);
      console.log(`- Response Time: ${healthResult.responseTime.toFixed(2)}ms`);
      console.log(`- Status Code: ${healthResult.statusCode}`);
      console.log(`- Target Met (<100ms): ${healthResult.responseTime < 100 ? 'YES' : 'NO'}`);
    }
    
    const clientsResult = this.results['Service Log Clients'];
    if (clientsResult && !clientsResult.error) {
      console.log(`\nService Log Clients Endpoint:`);
      console.log(`- Response Time: ${clientsResult.responseTime.toFixed(2)}ms`);
      console.log(`- Status Code: ${clientsResult.statusCode}`);
      console.log(`- Target Met (<200ms): ${clientsResult.responseTime < 200 ? 'YES' : 'NO'}`);
    }
    
    console.log('\nNote: 401/403 status codes are expected for protected endpoints without auth tokens.');
    console.log('What matters is the response time, not the authentication status.');
    
    return this.results;
  }

  async runQuickTest() {
    console.log('Starting Quick API Performance Test...');
    console.log('\nNOTE: Make sure backend server is running on port 3001');
    console.log('Run: cd backend && npm run dev\n');
    
    try {
      await this.testMultipleEndpoints();
      return this.generateQuickReport();
    } catch (error) {
      console.error('Quick API test failed:', error);
      return { success: false, error: error.message };
    }
  }
}

// Run the quick test
if (require.main === module) {
  const tester = new QuickAPITester();
  tester.runQuickTest().then(() => {
    console.log('\nQuick API test completed.');
    console.log('For complete performance testing, see PHASE_7_1_PERFORMANCE_REPORT.md');
  });
}

module.exports = QuickAPITester;
