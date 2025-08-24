// Authentication API tests following Jest documentation patterns
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '@/app';
import { UserRepository } from '@/models/UserRepository';
import bcrypt from 'bcryptjs';

describe('Authentication API', () => {
  let userRepository: UserRepository;

  beforeAll(() => {
    userRepository = new UserRepository();
  });

  beforeEach(async () => {
    // Create test user for authentication tests
    const hashedPassword = await bcrypt.hash('testpassword123', 12);
    
    try {
      await userRepository.create({
        username: 'testuser',
        email: 'test@healthcare.local',
        passwordHash: hashedPassword,
        role: 'admin',
        firstName: 'Test',
        lastName: 'User',
        isActive: true,
        lastLoginAt: undefined
      });
    } catch (error) {
      // User might already exist, that's okay for tests
    }
  });

  describe('POST /api/auth/login', () => {
    test('successfully logs in user with valid credentials', async () => {
      const loginData = {
        email: 'test@healthcare.local',
        password: 'testpassword123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.user.email).toBe('test@healthcare.local');
      expect(response.body.data.user.passwordHash).toBeUndefined();
      expect(response.body.data.expiresAt).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });

    test('returns 401 for invalid email', async () => {
      const loginData = {
        email: 'nonexistent@healthcare.local',
        password: 'testpassword123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
      expect(response.body.error.message).toMatch(/invalid credentials/i);
    });

    test('returns 401 for invalid password', async () => {
      const loginData = {
        email: 'test@healthcare.local',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    test('returns 400 for invalid input format', async () => {
      const invalidData = {
        email: 'invalid-email',
        password: ''
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toBeDefined();
    });

    test('returns 429 after too many failed attempts', async () => {
      const loginData = {
        email: 'test@healthcare.local',
        password: 'wrongpassword'
      };

      // Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send(loginData);
      }

      // 6th attempt should be rate limited
      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(429);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_RATE_LIMIT_EXCEEDED');
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Get a valid refresh token first
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@healthcare.local',
          password: 'testpassword123'
        });

      refreshToken = loginResponse.body.data.refreshToken;
    });

    test('successfully refreshes access token with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.expiresAt).toBeDefined();
    });

    test('returns 401 for invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    test('returns 400 for missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/logout', () => {
    let authToken: string;

    beforeEach(async () => {
      // Get a valid auth token first
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@healthcare.local',
          password: 'testpassword123'
        });

      authToken = loginResponse.body.data.token;
    });

    test('successfully logs out user', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toMatch(/logged out successfully/i);
    });

    test('returns 401 without authentication token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  describe('GET /api/auth/verify', () => {
    let authToken: string;

    beforeEach(async () => {
      // Get a valid auth token first
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@healthcare.local',
          password: 'testpassword123'
        });

      authToken = loginResponse.body.data.token;
    });

    test('successfully verifies valid token', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('test@healthcare.local');
    });

    test('returns 401 for invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    test('returns 401 without authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/verify')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });
  });
});