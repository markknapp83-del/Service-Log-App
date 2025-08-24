// Test form submission with browser console debug
console.log('=== TESTING FORM SUBMISSION ===');

// Test the validation schema with sample data
const testData = {
  clientId: "1",
  activityId: "2", 
  serviceDate: "2025-08-24",
  patientCount: 2,
  patientEntries: [
    { appointmentType: "new", outcomeId: "1" },
    { appointmentType: "followup", outcomeId: "2" }
  ]
};

console.log('Test data:', testData);
console.log('This should help debug validation issues');

// Instructions for manual testing
console.log(`
MANUAL TESTING STEPS:
1. Open browser dev tools (F12)
2. Go to the service log form
3. Fill out the form completely:
   - Select a client/site
   - Select an activity  
   - Set service date to today
   - Set patient count to 2
   - Fill both patient entries with appointment types and outcomes
4. Click "Save Service Log"
5. Check console for errors
6. Check network tab for API calls
`);