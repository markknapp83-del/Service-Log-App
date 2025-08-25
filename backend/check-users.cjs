const Database = require("better-sqlite3");
const db = new Database("healthcare.db");

console.log("=== USER VALIDATION ===");
try {
  const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get();
  console.log(`Total users: ${userCount.count}`);
  
  if (userCount.count > 0) {
    const users = db.prepare("SELECT id, email, role, is_active FROM users LIMIT 5").all();
    users.forEach(user => console.log(`- ${user.id}: ${user.email} (${user.role}) - Active: ${user.is_active}`));
  } else {
    console.log("No users found - need to create test user");
  }
} catch (error) {
  console.log(`Error: ${error.message}`);
}

db.close();
