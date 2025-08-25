const fetch = require('node-fetch');

async function testFeatureFlag() {
  const baseUrl = 'http://localhost:5003';
  
  try {
    // First login as admin
    console.log('🔐 Logging in as admin...');
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@test.com',
        password: 'TestPass123!'
      })
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status} ${loginResponse.statusText}`);
    }

    const loginData = await loginResponse.json();
    console.log('✅ Login successful');
    
    const token = loginData.data.token;
    const authHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // Test protected endpoint - should return 403 due to feature flag
    console.log('🧪 Testing protected client field creation endpoint...');
    const createFieldResponse = await fetch(`${baseUrl}/api/admin/clients/1/fields`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        fieldLabel: 'Test Field',
        fieldType: 'text'
      })
    });

    const createFieldData = await createFieldResponse.json();
    console.log('📋 Response status:', createFieldResponse.status);
    console.log('📋 Response data:', JSON.stringify(createFieldData, null, 2));

    if (createFieldResponse.status === 403 && createFieldData.error?.code === 'FEATURE_DISABLED') {
      console.log('✅ Feature flag protection working correctly!');
      console.log('✅ Custom form creation is properly disabled');
    } else {
      console.log('❌ Feature flag protection not working as expected');
    }

    // Test unprotected endpoint - should work
    console.log('\n🧪 Testing unprotected clients endpoint...');
    const clientsResponse = await fetch(`${baseUrl}/api/admin/templates/clients`, {
      headers: authHeaders
    });

    if (clientsResponse.ok) {
      console.log('✅ Unprotected endpoint working correctly');
    } else {
      console.log('❌ Unprotected endpoint failed');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testFeatureFlag();