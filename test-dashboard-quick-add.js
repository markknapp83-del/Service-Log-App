// Quick test script to verify Dashboard Quick Add functionality
const { execSync } = require('child_process');

console.log('Testing Dashboard Quick Add Phase 7.2 Implementation...\n');

// Test 1: Check if backend API endpoints exist
console.log('1. Testing Backend API Endpoints:');
try {
  // Get auth token
  const loginResponse = execSync(
    'curl -s -X POST -H "Content-Type: application/json" -d "{\\"email\\":\\"admin@healthcare.local\\",\\"password\\":\\"admin123\\"}" http://localhost:5003/api/auth/login',
    { encoding: 'utf8' }
  );
  
  const loginData = JSON.parse(loginResponse);
  if (loginData.success && loginData.data.token) {
    console.log('  ✅ Admin login successful');
    
    const token = loginData.data.token;
    
    // Test clients endpoint
    const clientsResponse = execSync(
      `curl -s -H "Authorization: Bearer ${token}" http://localhost:5003/api/admin/templates/clients`,
      { encoding: 'utf8' }
    );
    const clientsData = JSON.parse(clientsResponse);
    if (clientsData.success) {
      console.log(`  ✅ Clients API: ${clientsData.data.length} clients found`);
    } else {
      console.log('  ❌ Clients API failed');
    }
    
    // Test activities endpoint
    const activitiesResponse = execSync(
      `curl -s -H "Authorization: Bearer ${token}" http://localhost:5003/api/admin/templates/activities`,
      { encoding: 'utf8' }
    );
    const activitiesData = JSON.parse(activitiesResponse);
    if (activitiesData.success) {
      console.log(`  ✅ Activities API: ${activitiesData.data.length} activities found`);
    } else {
      console.log('  ❌ Activities API failed');
    }
    
    // Test outcomes endpoint
    const outcomesResponse = execSync(
      `curl -s -H "Authorization: Bearer ${token}" http://localhost:5003/api/admin/templates/outcomes`,
      { encoding: 'utf8' }
    );
    const outcomesData = JSON.parse(outcomesResponse);
    if (outcomesData.success) {
      console.log(`  ✅ Outcomes API: ${outcomesData.data.length} outcomes found`);
    } else {
      console.log('  ❌ Outcomes API failed');
    }
    
  } else {
    console.log('  ❌ Admin login failed');
  }
} catch (error) {
  console.log('  ❌ Backend API test failed:', error.message);
}

// Test 2: Check if frontend files exist
console.log('\n2. Testing Frontend Files:');
const fs = require('fs');
const path = require('path');

const filesToCheck = [
  'frontend/src/pages/DashboardPage.tsx',
  'frontend/src/components/EntityModal.tsx'
];

filesToCheck.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    console.log(`  ✅ ${file} exists`);
    
    // Check if DashboardPage contains Quick Add
    if (file.includes('DashboardPage')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('Quick Add')) {
        console.log('  ✅ DashboardPage contains "Quick Add" section');
      } else {
        console.log('  ❌ DashboardPage missing "Quick Add" section');
      }
      
      if (content.includes('EntityModal')) {
        console.log('  ✅ DashboardPage imports EntityModal');
      } else {
        console.log('  ❌ DashboardPage missing EntityModal import');
      }
      
      if (content.includes('loadEntityCounts')) {
        console.log('  ✅ DashboardPage has loadEntityCounts function');
      } else {
        console.log('  ❌ DashboardPage missing loadEntityCounts function');
      }
    }
  } else {
    console.log(`  ❌ ${file} does not exist`);
  }
});

// Test 3: Check Phase 7.2 Success Criteria
console.log('\n3. Phase 7.2 Success Criteria Check:');
const dashboardPath = path.join(__dirname, 'frontend/src/pages/DashboardPage.tsx');
if (fs.existsSync(dashboardPath)) {
  const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
  
  const criteria = [
    { name: 'Quick Add section for admin only', check: content => content.includes(`{user?.role === 'admin' && (`) && content.includes('Quick Add') },
    { name: 'Entity count display', check: content => content.includes('entityCounts.clients') && content.includes('entityCounts.activities') && content.includes('entityCounts.outcomes') },
    { name: 'Modal integration', check: content => content.includes('<EntityModal') && content.includes('isOpen={quickAddModalOpen}') },
    { name: 'API integration', check: content => content.includes('/api/admin/templates/clients') && content.includes('loadEntityCounts') },
    { name: 'Success handling', check: content => content.includes('handleQuickAddSuccess') && content.includes('loadEntityCounts()') },
    { name: 'Template Management link', check: content => content.includes('to="/admin/templates"') }
  ];
  
  criteria.forEach(criterion => {
    if (criterion.check(dashboardContent)) {
      console.log(`  ✅ ${criterion.name}`);
    } else {
      console.log(`  ❌ ${criterion.name}`);
    }
  });
} else {
  console.log('  ❌ Cannot check criteria - DashboardPage.tsx not found');
}

console.log('\n🎉 Phase 7.2 Dashboard Entity Management Integration Test Complete!');
console.log('\nTo manually test:');
console.log('1. Open frontend in browser (http://localhost:3000 or similar)');
console.log('2. Login as admin (admin@healthcare.local / admin123)');  
console.log('3. Navigate to Dashboard');
console.log('4. Look for "Quick Add" section with entity counts');
console.log('5. Click "Add Client", "Add Activity", or "Add Outcome" buttons');
console.log('6. Verify EntityModal opens and new entities can be created');
console.log('7. Verify entity counts update after successful creation');