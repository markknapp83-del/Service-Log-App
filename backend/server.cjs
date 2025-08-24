// Full backend server with Phase 3.5 database schema
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const app = express();
const db = new Database('./healthcare.db');
const JWT_SECRET = 'test-secret-key-for-development';

// Middleware
app.use(cors({
  origin: ['http://localhost:3011', 'http://localhost:3000', 'http://localhost:3005'],
  credentials: true
}));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, req.body);
  next();
});

// Initialize database with new Phase 3.5 schema
function initializeDatabase() {
  console.log('Initializing database with Phase 3.5 schema...');
  
  // Drop and recreate tables to match new schema
  try {
    // Drop existing patient_entries table if it exists (old structure)
    db.exec('DROP TABLE IF EXISTS patient_entries');
    db.exec('DROP TABLE IF EXISTS service_logs');
    
    // Create service_logs table with serviceDate field
    db.exec(`
      CREATE TABLE IF NOT EXISTS service_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        client_id INTEGER NOT NULL,
        activity_id INTEGER NOT NULL,
        service_date TEXT NOT NULL,
        patient_count INTEGER NOT NULL DEFAULT 0,
        is_draft INTEGER DEFAULT 0,
        submitted_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (client_id) REFERENCES clients(id),
        FOREIGN KEY (activity_id) REFERENCES activities(id)
      )
    `);
    
    // Create patient_entries table with appointment-based structure
    db.exec(`
      CREATE TABLE IF NOT EXISTS patient_entries (
        id TEXT PRIMARY KEY,
        service_log_id TEXT NOT NULL,
        appointment_type TEXT NOT NULL CHECK (appointment_type IN ('new', 'followup', 'dna')),
        outcome_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (service_log_id) REFERENCES service_logs(id) ON DELETE CASCADE,
        FOREIGN KEY (outcome_id) REFERENCES outcomes(id)
      )
    `);
    
    // Create reference data tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    
    db.exec(`
      CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    
    db.exec(`
      CREATE TABLE IF NOT EXISTS outcomes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    
    // Seed reference data
    const clientCount = db.prepare('SELECT COUNT(*) as count FROM clients').get().count;
    if (clientCount === 0) {
      console.log('Seeding reference data...');
      
      // Seed clients
      db.prepare('INSERT INTO clients (name) VALUES (?)').run('Downtown Clinic');
      db.prepare('INSERT INTO clients (name) VALUES (?)').run('Community Health Center');
      db.prepare('INSERT INTO clients (name) VALUES (?)').run('Regional Hospital');
      db.prepare('INSERT INTO clients (name) VALUES (?)').run('Primary Care Practice');
      
      // Seed activities
      db.prepare('INSERT INTO activities (name) VALUES (?)').run('General Consultation');
      db.prepare('INSERT INTO activities (name) VALUES (?)').run('Physiotherapy');
      db.prepare('INSERT INTO activities (name) VALUES (?)').run('Mental Health Counseling');
      db.prepare('INSERT INTO activities (name) VALUES (?)').run('Preventive Care');
      db.prepare('INSERT INTO activities (name) VALUES (?)').run('Chronic Disease Management');
      
      // Seed outcomes
      db.prepare('INSERT INTO outcomes (name) VALUES (?)').run('Treatment Completed');
      db.prepare('INSERT INTO outcomes (name) VALUES (?)').run('Referred to Specialist');
      db.prepare('INSERT INTO outcomes (name) VALUES (?)').run('Follow-up Required');
      db.prepare('INSERT INTO outcomes (name) VALUES (?)').run('Emergency Care Needed');
      db.prepare('INSERT INTO outcomes (name) VALUES (?)').run('Patient Education Provided');
    }
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

// JWT middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_REQUIRED', message: 'Access token is required' },
      timestamp: new Date().toISOString()
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
        timestamp: new Date().toISOString()
      });
    }
    req.user = user;
    next();
  });
};

// Admin role middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: { code: 'ACCESS_DENIED', message: 'Admin access required' },
      timestamp: new Date().toISOString()
    });
  }
  next();
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth endpoints
app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('Login attempt:', { email: req.body.email });
    
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email and password are required' },
        timestamp: new Date().toISOString()
      });
    }
    
    // Find user
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email);
    console.log('User found:', user ? { id: user.id, email: user.email } : 'null');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTH_ERROR', message: 'Invalid credentials' },
        timestamp: new Date().toISOString()
      });
    }
    
    // Verify password
    console.log('Verifying password...');
    const isValid = await bcrypt.compare(password, user.password_hash);
    console.log('Password valid:', isValid);
    
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTH_ERROR', message: 'Invalid credentials' },
        timestamp: new Date().toISOString()
      });
    }
    
    // Generate token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    console.log('Login successful for user:', user.email);
    
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role
        },
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Login failed' },
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: { user: req.user },
    timestamp: new Date().toISOString()
  });
});

app.post('/api/auth/logout', (req, res) => {
  res.json({
    success: true,
    data: { message: 'Logged out successfully' },
    timestamp: new Date().toISOString()
  });
});

// Admin endpoints
app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    
    let query = 'SELECT id, username, email, first_name, last_name, role, is_active, last_login_at, created_at, updated_at FROM users';
    let params = [];
    
    if (search) {
      query += ' WHERE email LIKE ? OR first_name LIKE ? OR last_name LIKE ?';
      const searchTerm = `%${search}%`;
      params = [searchTerm, searchTerm, searchTerm];
    }
    
    query += ' ORDER BY created_at DESC';
    
    const users = db.prepare(query).all(...params);
    
    // Convert to frontend format
    const formattedUsers = users.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      isActive: Boolean(user.is_active),
      lastLoginAt: user.last_login_at,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    }));
    
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const total = formattedUsers.length;
    const totalPages = Math.ceil(total / limitNum);
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedUsers = formattedUsers.slice(startIndex, startIndex + limitNum);
    
    res.json({
      success: true,
      data: {
        users: paginatedUsers,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Admin users fetch error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch users' },
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { email, password, firstName, lastName, role = 'candidate' } = req.body;
    
    // Validate required fields
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email, password, first name, and last name are required' },
        timestamp: new Date().toISOString()
      });
    }
    
    // Check if user already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: { code: 'USER_EXISTS', message: 'User with this email already exists' },
        timestamp: new Date().toISOString()
      });
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Create user
    const userId = uuidv4();
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO users (id, username, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(userId, email, email, passwordHash, firstName, lastName, role, now, now);
    
    // Return created user (without password hash)
    res.status(201).json({
      success: true,
      data: {
        id: userId,
        username: email,
        email,
        firstName,
        lastName,
        role,
        isActive: true,
        createdAt: now,
        updatedAt: now
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Admin user creation error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create user' },
      timestamp: new Date().toISOString()
    });
  }
});

app.put('/api/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, role, isActive } = req.body;
    
    // Validate user exists
    const existingUser = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        timestamp: new Date().toISOString()
      });
    }
    
    // Build update query
    const updates = [];
    const params = [];
    
    if (firstName !== undefined) {
      updates.push('first_name = ?');
      params.push(firstName);
    }
    if (lastName !== undefined) {
      updates.push('last_name = ?');
      params.push(lastName);
    }
    if (role !== undefined) {
      updates.push('role = ?');
      params.push(role);
    }
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(isActive ? 1 : 0);
    }
    
    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);
    
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    
    // Fetch updated user
    const updatedUser = db.prepare('SELECT id, username, email, first_name, last_name, role, is_active, last_login_at, created_at, updated_at FROM users WHERE id = ?').get(id);
    
    res.json({
      success: true,
      data: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        role: updatedUser.role,
        isActive: Boolean(updatedUser.is_active),
        lastLoginAt: updatedUser.last_login_at,
        createdAt: updatedUser.created_at,
        updatedAt: updatedUser.updated_at
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Admin user update error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update user' },
      timestamp: new Date().toISOString()
    });
  }
});

app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate user exists
    const existingUser = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        timestamp: new Date().toISOString()
      });
    }
    
    // Prevent deleting own account
    if (req.user.userId === id) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_OPERATION', message: 'Cannot delete your own account' },
        timestamp: new Date().toISOString()
      });
    }
    
    // Soft delete (deactivate)
    db.prepare('UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), id);
    
    res.json({
      success: true,
      message: 'User has been deactivated successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Admin user deletion error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete user' },
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/api/admin/users/:id/reset-password', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    
    if (!newPassword) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'New password is required' },
        timestamp: new Date().toISOString()
      });
    }
    
    // Validate user exists
    const existingUser = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        timestamp: new Date().toISOString()
      });
    }
    
    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);
    
    // Update password
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(passwordHash, new Date().toISOString(), id);
    
    res.json({
      success: true,
      message: 'Password has been reset successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Admin password reset error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to reset password' },
      timestamp: new Date().toISOString()
    });
  }
});

// Service logs options endpoint
app.get('/api/service-logs/options', authenticateToken, (req, res) => {
  try {
    const clients = db.prepare('SELECT * FROM clients WHERE is_active = 1 ORDER BY name').all();
    const activities = db.prepare('SELECT * FROM activities WHERE is_active = 1 ORDER BY name').all();
    const outcomes = db.prepare('SELECT * FROM outcomes WHERE is_active = 1 ORDER BY name').all();
    
    res.json({
      success: true,
      data: {
        clients: clients.map(c => ({
          id: c.id.toString(),
          name: c.name,
          isActive: Boolean(c.is_active),
          createdAt: c.created_at,
          updatedAt: c.updated_at
        })),
        activities: activities.map(a => ({
          id: a.id.toString(),
          name: a.name,
          isActive: Boolean(a.is_active),
          createdAt: a.created_at,
          updatedAt: a.updated_at
        })),
        outcomes: outcomes.map(o => ({
          id: o.id.toString(),
          name: o.name,
          isActive: Boolean(o.is_active),
          createdAt: o.created_at,
          updatedAt: o.updated_at
        }))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Options fetch error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch options' },
      timestamp: new Date().toISOString()
    });
  }
});

// Service logs endpoint - Phase 3.5 structure
app.post('/api/service-logs', authenticateToken, async (req, res) => {
  try {
    console.log('Service log creation request:', JSON.stringify(req.body, null, 2));
    
    const { clientId, activityId, serviceDate, patientCount, patientEntries, isDraft = false } = req.body;
    const userId = req.user.userId;
    
    // Validate required fields
    if (!clientId || !activityId || !serviceDate || !patientCount || !patientEntries) {
      return res.status(400).json({
        success: false,
        error: { 
          code: 'VALIDATION_ERROR', 
          message: 'Missing required fields: clientId, activityId, serviceDate, patientCount, patientEntries' 
        },
        timestamp: new Date().toISOString()
      });
    }
    
    // Validate that client and activity exist
    const client = db.prepare('SELECT * FROM clients WHERE id = ? AND is_active = 1').get(clientId);
    const activity = db.prepare('SELECT * FROM activities WHERE id = ? AND is_active = 1').get(activityId);
    
    if (!client) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid or inactive client' },
        timestamp: new Date().toISOString()
      });
    }
    
    if (!activity) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid or inactive activity' },
        timestamp: new Date().toISOString()
      });
    }
    
    // Validate patient entries
    if (!Array.isArray(patientEntries) || patientEntries.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'At least one patient entry is required' },
        timestamp: new Date().toISOString()
      });
    }
    
    // Validate patient entries match count
    if (patientEntries.length !== patientCount) {
      return res.status(400).json({
        success: false,
        error: { 
          code: 'VALIDATION_ERROR', 
          message: `Patient entries count (${patientEntries.length}) does not match specified count (${patientCount})` 
        },
        timestamp: new Date().toISOString()
      });
    }
    
    // Validate each patient entry
    for (const [index, entry] of patientEntries.entries()) {
      if (!entry.appointmentType || !['new', 'followup', 'dna'].includes(entry.appointmentType)) {
        return res.status(400).json({
          success: false,
          error: { 
            code: 'VALIDATION_ERROR', 
            message: `Invalid appointment type for entry ${index + 1}: ${entry.appointmentType}` 
          },
          timestamp: new Date().toISOString()
        });
      }
      
      if (!entry.outcomeId) {
        return res.status(400).json({
          success: false,
          error: { 
            code: 'VALIDATION_ERROR', 
            message: `Outcome is required for entry ${index + 1}` 
          },
          timestamp: new Date().toISOString()
        });
      }
      
      // Validate outcome exists
      const outcome = db.prepare('SELECT * FROM outcomes WHERE id = ? AND is_active = 1').get(entry.outcomeId);
      if (!outcome) {
        return res.status(400).json({
          success: false,
          error: { 
            code: 'VALIDATION_ERROR', 
            message: `Invalid outcome ID for entry ${index + 1}: ${entry.outcomeId}` 
          },
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Create service log and patient entries in a transaction
    const transaction = db.transaction(() => {
      // Create service log
      const serviceLogId = uuidv4();
      const now = new Date().toISOString();
      
      db.prepare(`
        INSERT INTO service_logs (
          id, user_id, client_id, activity_id, service_date, patient_count, 
          is_draft, submitted_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        serviceLogId,
        userId,
        clientId,
        activityId,
        serviceDate,
        patientCount,
        isDraft ? 1 : 0,
        isDraft ? null : now,
        now,
        now
      );
      
      // Create patient entries
      const createdEntries = [];
      for (const entry of patientEntries) {
        const patientEntryId = uuidv4();
        
        db.prepare(`
          INSERT INTO patient_entries (
            id, service_log_id, appointment_type, outcome_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          patientEntryId,
          serviceLogId,
          entry.appointmentType,
          entry.outcomeId,
          now,
          now
        );
        
        createdEntries.push({
          id: patientEntryId,
          serviceLogId,
          appointmentType: entry.appointmentType,
          outcomeId: parseInt(entry.outcomeId),
          createdAt: now,
          updatedAt: now
        });
      }
      
      return { serviceLogId, createdEntries };
    });
    
    const result = transaction();
    
    // Calculate totals for response
    const totals = patientEntries.reduce(
      (acc, entry) => ({
        totalEntries: acc.totalEntries + 1,
        newPatients: acc.newPatients + (entry.appointmentType === 'new' ? 1 : 0),
        followupPatients: acc.followupPatients + (entry.appointmentType === 'followup' ? 1 : 0),
        dnaCount: acc.dnaCount + (entry.appointmentType === 'dna' ? 1 : 0),
      }),
      { totalEntries: 0, newPatients: 0, followupPatients: 0, dnaCount: 0 }
    );
    
    console.log('Service log created successfully:', {
      serviceLogId: result.serviceLogId,
      userId,
      totals,
      isDraft
    });
    
    res.status(201).json({
      success: true,
      data: {
        id: result.serviceLogId,
        userId,
        clientId: parseInt(clientId),
        activityId: parseInt(activityId),
        serviceDate,
        patientCount,
        isDraft,
        patientEntries: result.createdEntries,
        totals
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Service log creation error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create service log' },
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    timestamp: new Date().toISOString()
  });
});

// Initialize database and start server
initializeDatabase();

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Healthcare Service Log Server running on port ${PORT}`);
  console.log('Phase 3.5 features: Appointment-based patient entries + Service date tracking');
  console.log('Test credentials: test@test.com / password123');
});

process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});