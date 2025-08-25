// Simple test script for submissions API
const http = require('http');

function testEndpoint(path, expectedStatusCode = 200) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: `/api${path}`,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log(`✅ ${path}: Status ${res.statusCode}`);
          console.log(`   Success: ${parsed.success}`);
          if (path === '/service-logs' && parsed.data && parsed.data.serviceLogs) {
            console.log(`   Service logs: ${parsed.data.serviceLogs.length} records`);
          }
          resolve(parsed);
        } catch (e) {
          console.log(`❌ ${path}: Status ${res.statusCode}, Invalid JSON`);
          resolve({ error: 'Invalid JSON response' });
        }
      });
    });

    req.on('error', (err) => {
      console.log(`❌ ${path}: Connection error - ${err.message}`);
      resolve({ error: err.message });
    });

    req.setTimeout(5000, () => {
      req.abort();
      console.log(`❌ ${path}: Request timeout`);
      resolve({ error: 'Timeout' });
    });

    req.end();
  });
}

async function runTests() {
  console.log('🚀 Testing Submissions API endpoints...\n');
  
  // Test health endpoint first
  await testEndpoint('/health');
  
  // Test service logs endpoints
  await testEndpoint('/service-logs/options');
  await testEndpoint('/service-logs');
  await testEndpoint('/service-logs/service-log-001');
  
  // Test export endpoint
  await testEndpoint('/reports/export?format=csv');
  
  console.log('\n✅ API tests completed');
}

// Wait a bit for servers to start, then run tests
setTimeout(runTests, 3000);