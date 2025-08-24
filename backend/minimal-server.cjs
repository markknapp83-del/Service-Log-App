// Minimal backend server to test login functionality
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');

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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Login endpoint
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

// Mock service log options
app.get('/api/service-logs/options', (req, res) => {
  res.json({
    success: true,
    data: {
      clients: [{ id: '1', name: 'Test Clinic', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
      activities: [{ id: '1', name: 'Test Activity', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
      outcomes: [{ id: '1', name: 'Test Outcome', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]
    },
    timestamp: new Date().toISOString()
  });
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

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Minimal test server running on port ${PORT}`);
  console.log('Test credentials: test@test.com / password123');
});

process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});