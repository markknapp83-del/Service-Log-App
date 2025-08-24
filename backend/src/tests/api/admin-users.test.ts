// Admin User Management API Tests - Following Jest documentation patterns
// Phase 4: Admin Portal - User Management tests as specified in plan.md
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '@/app';
import { UserRepository } from '@/models/UserRepository';
import { AuthService } from '@/services/AuthService';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

describe('Admin User Management API', () => {
  let userRepository: UserRepository;
  let authService: AuthService;
  let adminToken: string;
  let candidateToken: string;
  let testUsers: any[] = [];

  beforeAll(async () => {
    // Initialize repositories
    userRepository = new UserRepository();
    authService = new AuthService(userRepository);
    
    // Create admin and candidate users for testing
    const adminUser = await userRepository.create({
      email: 'admin@test.com',
      passwordHash: await bcrypt.hash('adminpassword', 10),
      firstName: 'Test',
      lastName: 'Admin',
      role: 'admin',
      isActive: true
    });

    const candidateUser = await userRepository.create({
      email: 'candidate@test.com', 
      passwordHash: await bcrypt.hash('candidatepassword', 10),
      firstName: 'Test',
      lastName: 'Candidate',
      role: 'candidate',
      isActive: true
    });

    testUsers.push(adminUser, candidateUser);

    // Get tokens for authentication
    const adminLoginResult = await authService.login({ 
      email: 'admin@test.com', 
      password: 'adminpassword' 
    });
    const candidateLoginResult = await authService.login({ 
      email: 'candidate@test.com', 
      password: 'candidatepassword' 
    });

    adminToken = adminLoginResult.data!.accessToken;
    candidateToken = candidateLoginResult.data!.accessToken;
  });

  afterAll(async () => {
    // Clean up test users
    for (const user of testUsers) {
      try {
        await userRepository.delete(user.id);
      } catch (error) {
        // User might already be deleted
      }
    }
  });

  describe('GET /api/admin/users', () => {
    test('should return paginated users for admin', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          users: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(String),
              email: expect.any(String),
              firstName: expect.any(String),
              lastName: expect.any(String),
              role: expect.any(String),
              isActive: expect.any(Boolean)
            })
          ]),
          pagination: expect.objectContaining({
            page: expect.any(Number),
            limit: expect.any(Number),
            total: expect.any(Number),
            totalPages: expect.any(Number)
          })
        }),
        timestamp: expect.any(String)
      });

      // Should not include password hashes
      expect(response.body.data.users[0]).not.toHaveProperty('passwordHash');
    });

    test('should reject candidate access', async () => {
      await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(403);
    });

    test('should reject unauthenticated requests', async () => {
      await request(app)
        .get('/api/admin/users')
        .expect(401);
    });

    test('should support pagination', async () => {
      const response = await request(app)
        .get('/api/admin/users?page=1&limit=1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.users).toHaveLength(1);
      expect(response.body.data.pagination).toMatchObject({
        page: 1,
        limit: 1
      });
    });

    test('should support search filtering', async () => {
      const response = await request(app)
        .get('/api/admin/users?search=admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.users).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            email: 'admin@test.com'
          })
        ])
      );
    });
  });

  describe('POST /api/admin/users', () => {
    test('should create new candidate account', async () => {
      const newUserData = {
        email: 'newcandidate@test.com',
        password: 'newpassword123',
        firstName: 'New',
        lastName: 'Candidate',
        role: 'candidate'
      };

      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newUserData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: expect.any(String),
          email: 'newcandidate@test.com',
          firstName: 'New',
          lastName: 'Candidate',
          role: 'candidate',
          isActive: true
        })
      });

      // Should not return password hash
      expect(response.body.data).not.toHaveProperty('passwordHash');
      
      // Track for cleanup
      testUsers.push(response.body.data);
    });

    test('should validate required fields', async () => {
      const invalidUserData = {
        email: 'invalid-email',
        // missing required fields
      };

      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidUserData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should reject duplicate email', async () => {
      const duplicateUserData = {
        email: 'admin@test.com', // Already exists
        password: 'password123',
        firstName: 'Duplicate',
        lastName: 'User',
        role: 'candidate'
      };

      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(duplicateUserData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CONFLICT_ERROR');
    });

    test('should reject candidate creating users', async () => {
      const newUserData = {
        email: 'test@test.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        role: 'candidate'
      };

      await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${candidateToken}`)
        .send(newUserData)
        .expect(403);
    });
  });

  describe('PUT /api/admin/users/:id', () => {
    let testUserId: string;

    beforeEach(async () => {
      const testUser = await userRepository.create({
        email: `testupdate${Date.now()}@test.com`,
        passwordHash: await bcrypt.hash('password', 10),
        firstName: 'Test',
        lastName: 'Update',
        role: 'candidate',
        isActive: true
      });
      testUserId = testUser.id;
      testUsers.push(testUser);
    });

    test('should update user details', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'User',
        role: 'admin'
      };

      const response = await request(app)
        .put(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: testUserId,
          firstName: 'Updated',
          lastName: 'User',
          role: 'admin'
        })
      });
    });

    test('should validate user ID format', async () => {
      const updateData = { firstName: 'Updated' };

      await request(app)
        .put('/api/admin/users/invalid-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(400);
    });

    test('should handle non-existent user', async () => {
      const nonExistentId = uuidv4();
      const updateData = { firstName: 'Updated' };

      await request(app)
        .put(`/api/admin/users/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(404);
    });

    test('should reject candidate access', async () => {
      const updateData = { firstName: 'Updated' };

      await request(app)
        .put(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .send(updateData)
        .expect(403);
    });
  });

  describe('DELETE /api/admin/users/:id', () => {
    let testUserId: string;

    beforeEach(async () => {
      const testUser = await userRepository.create({
        email: `testdelete${Date.now()}@test.com`,
        passwordHash: await bcrypt.hash('password', 10),
        firstName: 'Test',
        lastName: 'Delete',
        role: 'candidate',
        isActive: true
      });
      testUserId = testUser.id;
      testUsers.push(testUser);
    });

    test('should soft delete user (deactivate)', async () => {
      const response = await request(app)
        .delete(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.any(String)
      });

      // Verify user is deactivated
      const user = userRepository.findById(testUserId);
      expect(user).toBeNull(); // Should not be found since it's soft deleted
    });

    test('should validate user ID format', async () => {
      await request(app)
        .delete('/api/admin/users/invalid-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    test('should handle non-existent user', async () => {
      const nonExistentId = uuidv4();

      await request(app)
        .delete(`/api/admin/users/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    test('should reject candidate access', async () => {
      await request(app)
        .delete(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(403);
    });
  });

  describe('POST /api/admin/users/:id/reset-password', () => {
    let testUserId: string;

    beforeEach(async () => {
      const testUser = await userRepository.create({
        email: `testreset${Date.now()}@test.com`,
        passwordHash: await bcrypt.hash('oldpassword', 10),
        firstName: 'Test',
        lastName: 'Reset',
        role: 'candidate',
        isActive: true
      });
      testUserId = testUser.id;
      testUsers.push(testUser);
    });

    test('should reset user password', async () => {
      const resetData = {
        newPassword: 'newpassword123'
      };

      const response = await request(app)
        .post(`/api/admin/users/${testUserId}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(resetData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('password reset')
      });
    });

    test('should validate new password strength', async () => {
      const resetData = {
        newPassword: '123' // Too weak
      };

      const response = await request(app)
        .post(`/api/admin/users/${testUserId}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(resetData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should reject candidate access', async () => {
      const resetData = {
        newPassword: 'newpassword123'
      };

      await request(app)
        .post(`/api/admin/users/${testUserId}/reset-password`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .send(resetData)
        .expect(403);
    });
  });
});