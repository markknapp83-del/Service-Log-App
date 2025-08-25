const axios = require('axios');

async function testAuthAndMetrics() {
  const baseURL = 'http://localhost:5003/api';
  
  console.log('=== AUTHENTICATION & METRICS TEST ===');

  try {
    console.log('1. Testing login...');
    const loginResponse = await axios.post(`${baseURL}/auth/login`, {
      email: 'admin@healthcare.local',
      password: 'admin123'
    });

    if (loginResponse.data.success) {
      const token = loginResponse.data.data.token;
      console.log('✓ Login successful, got token');

      console.log('2. Testing metrics endpoint with authentication...');
      const metricsResponse = await axios.get(`${baseURL}/admin/reports/metrics`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (metricsResponse.data.success) {
        console.log('✓ Metrics endpoint working!');
        console.log('Database metrics:', JSON.stringify(metricsResponse.data.data.database, null, 2));
        console.log('Healthcare metrics:', JSON.stringify(metricsResponse.data.data.healthcare, null, 2));
        console.log('\n🎉 ALL TESTS PASSED!');
        console.log('✓ Authentication is working');
        console.log('✓ Database connectivity is resolved');
        console.log('✓ Healthcare metrics collection is working');
      } else {
        console.error('❌ Metrics endpoint failed:', metricsResponse.data);
      }
    } else {
      console.error('❌ Login failed:', loginResponse.data);
    }
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    if (error.response?.status === 500) {
      console.error('This indicates a server-side error. Check backend logs.');
    }
  }
}

testAuthAndMetrics();