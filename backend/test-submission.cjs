// Test script to verify service log submission works end-to-end
const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function testServiceLogSubmission() {
  console.log('=== TESTING SERVICE LOG SUBMISSION ===');
  
  try {
    // Step 1: Login to get authentication token
    console.log('1. Logging in...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'test@test.com',
      password: 'password123'
    });
    
    if (!loginResponse.data.success) {
      throw new Error('Login failed');
    }
    
    const token = loginResponse.data.data.token;
    console.log('✓ Login successful, got token');
    
    // Step 2: Get form options
    console.log('2. Getting form options...');
    const optionsResponse = await axios.get(`${API_BASE}/service-logs/options`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!optionsResponse.data.success) {
      throw new Error('Failed to get form options');
    }
    
    const { clients, activities, outcomes } = optionsResponse.data.data;
    console.log('✓ Form options retrieved:');
    console.log(`  - ${clients.length} clients available`);
    console.log(`  - ${activities.length} activities available`);  
    console.log(`  - ${outcomes.length} outcomes available`);
    
    // Step 3: Submit a service log with Phase 3.5 appointment-based structure
    console.log('3. Submitting service log...');
    const serviceLogData = {
      clientId: clients[0].id,
      activityId: activities[0].id,
      serviceDate: '2025-08-24', // Today's date
      patientCount: 3,
      patientEntries: [
        {
          appointmentType: 'new',
          outcomeId: outcomes[0].id
        },
        {
          appointmentType: 'followup', 
          outcomeId: outcomes[1].id
        },
        {
          appointmentType: 'dna',
          outcomeId: outcomes[2].id
        }
      ],
      isDraft: false
    };
    
    console.log('Submitting data:', JSON.stringify(serviceLogData, null, 2));
    
    const submissionResponse = await axios.post(`${API_BASE}/service-logs`, serviceLogData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!submissionResponse.data.success) {
      throw new Error(`Submission failed: ${submissionResponse.data.error?.message || 'Unknown error'}`);
    }
    
    console.log('✓ Service log submitted successfully!');
    console.log('Response:', JSON.stringify(submissionResponse.data, null, 2));
    
    // Calculate and display totals
    const totals = serviceLogData.patientEntries.reduce(
      (acc, entry) => ({
        total: acc.total + 1,
        new: acc.new + (entry.appointmentType === 'new' ? 1 : 0),
        followup: acc.followup + (entry.appointmentType === 'followup' ? 1 : 0),
        dna: acc.dna + (entry.appointmentType === 'dna' ? 1 : 0),
      }),
      { total: 0, new: 0, followup: 0, dna: 0 }
    );
    
    console.log('\n🎉 END-TO-END TEST SUCCESSFUL!');
    console.log('Summary:');
    console.log(`  - Client: ${clients[0].name}`);
    console.log(`  - Activity: ${activities[0].name}`);
    console.log(`  - Service Date: ${serviceLogData.serviceDate}`);
    console.log(`  - Total Entries: ${totals.total}`);
    console.log(`  - New Patients: ${totals.new}`);
    console.log(`  - Follow-up Patients: ${totals.followup}`);
    console.log(`  - DNA (Did Not Attend): ${totals.dna}`);
    console.log(`  - Service Log ID: ${submissionResponse.data.data.id}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

// Run the test
testServiceLogSubmission();