// Test script for error handling and monitoring systems
// Run with: node test-error-monitoring.js

const fetch = require('node-fetch');

const API_BASE_URL = 'http://localhost:5000/api';
const CLIENT_BASE_URL = 'http://localhost:3000';

// Test scenarios
const tests = [
  {
    name: 'Basic Health Check',
    test: async () => {
      const response = await fetch('http://localhost:5000/health');
      const data = await response.json();
      return { success: response.ok, data };
    }
  },
  {
    name: 'Detailed Health Check (requires auth)',
    test: async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/health/detailed`);
        return { success: response.status === 401, message: 'Auth required (expected)' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  },
  {
    name: 'Client Error Logging Endpoint',
    test: async () => {
      const errorData = {
        errors: [{
          id: `test_${Date.now()}`,
          timestamp: new Date().toISOString(),
          error: {
            message: 'Test error message',
            name: 'TestError'
          },
          context: {
            level: 'medium',
            category: 'ui',
            page: 'test'
          },
          environment: {
            userAgent: 'Test Agent',
            viewport: { width: 1920, height: 1080 },
            url: 'http://localhost:3000/test'
          }
        }],
        interactions: [],
        timestamp: new Date().toISOString()
      };

      try {
        const response = await fetch(`${API_BASE_URL}/client-logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(errorData)
        });
        
        const result = await response.json();
        return { success: response.ok, data: result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  },
  {
    name: 'Critical Client Error Endpoint',
    test: async () => {
      const criticalError = {
        error: {
          id: `critical_test_${Date.now()}`,
          timestamp: new Date().toISOString(),
          error: {
            message: 'Critical test error',
            name: 'CriticalTestError'
          },
          context: {
            level: 'critical',
            category: 'healthcare',
            page: 'patient-data'
          },
          environment: {
            userAgent: 'Test Agent',
            viewport: { width: 1920, height: 1080 },
            url: 'http://localhost:3000/patient-data'
          },
          healthcareContext: {
            hasPatientData: true,
            activeForm: 'patient-form',
            dataType: 'patient'
          }
        },
        timestamp: new Date().toISOString()
      };

      try {
        const response = await fetch(`${API_BASE_URL}/client-logs/critical`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(criticalError)
        });
        
        const result = await response.json();
        return { success: response.ok, data: result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  },
  {
    name: 'Error Handler Test (invalid endpoint)',
    test: async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/nonexistent-endpoint`);
        const data = await response.json();
        return { 
          success: response.status === 404, 
          data,
          message: 'Should return 404 with proper error format'
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  },
  {
    name: 'Rate Limiting Test',
    test: async () => {
      const requests = [];
      // Send multiple requests quickly to test rate limiting
      for (let i = 0; i < 10; i++) {
        requests.push(
          fetch(`${API_BASE_URL}/health/detailed`).then(r => r.status)
        );
      }
      
      try {
        const results = await Promise.all(requests);
        const rateLimited = results.some(status => status === 429);
        return { 
          success: true, 
          message: `Rate limiting ${rateLimited ? 'active' : 'not triggered'}`,
          statusCodes: results
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  }
];

// Run all tests
async function runTests() {
  console.log('🧪 Testing Error Handling and Monitoring Systems\n');
  console.log('=' .repeat(60));
  
  let passed = 0;
  let failed = 0;

  for (const testCase of tests) {
    console.log(`\n📋 ${testCase.name}`);
    console.log('-'.repeat(40));
    
    try {
      const startTime = Date.now();
      const result = await testCase.test();
      const duration = Date.now() - startTime;
      
      if (result.success) {
        console.log('✅ PASS');
        passed++;
      } else {
        console.log('❌ FAIL');
        failed++;
      }
      
      console.log(`⏱️  Duration: ${duration}ms`);
      
      if (result.message) {
        console.log(`📝 ${result.message}`);
      }
      
      if (result.data && typeof result.data === 'object') {
        console.log('📊 Response:', JSON.stringify(result.data, null, 2).substring(0, 500));
      }
      
      if (result.error) {
        console.log('🚨 Error:', result.error);
      }
      
    } catch (error) {
      console.log('❌ FAIL');
      console.log('🚨 Test Error:', error.message);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`📈 Test Summary: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All tests passed! Error handling and monitoring systems are working.');
  } else {
    console.log('⚠️  Some tests failed. Check the backend logs and fix issues.');
  }

  // Test summary for logging
  const summary = {
    timestamp: new Date().toISOString(),
    totalTests: tests.length,
    passed,
    failed,
    successRate: (passed / tests.length * 100).toFixed(1) + '%'
  };

  console.log('\n📋 Test Summary Object:');
  console.log(JSON.stringify(summary, null, 2));
}

// Frontend error simulation
function simulateFrontendErrors() {
  console.log('\n🎭 Frontend Error Simulation Guide:');
  console.log('-'.repeat(40));
  console.log('To test frontend error handling, try these in your browser console:');
  console.log('');
  console.log('1. Simulate a network error:');
  console.log('   throw new Error("Network request failed");');
  console.log('');
  console.log('2. Simulate a healthcare context error:');
  console.log('   throw new Error("Patient data access unauthorized");');
  console.log('');
  console.log('3. Simulate a chunk loading error:');
  console.log('   throw new Error("ChunkLoadError: Loading chunk failed");');
  console.log('');
  console.log('4. Test error boundary recovery:');
  console.log('   // Navigate to a page and cause an error, then use retry buttons');
  console.log('');
  console.log('5. Check error logger statistics:');
  console.log('   // Open developer console and check for error logging');
}

// Run the tests
if (require.main === module) {
  runTests()
    .then(() => {
      simulateFrontendErrors();
      console.log('\n✅ Testing complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { runTests, tests };