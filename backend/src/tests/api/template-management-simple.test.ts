// Template Management API Tests - Simplified version
// Basic tests to verify template management endpoints work correctly
import { describe, test, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import appPromise from '@/app';
import { UserRepository } from '@/models/UserRepository';
import bcrypt from 'bcryptjs';

describe('Template Management API - Basic Tests', () => {
  let app: any;
  let userRepository: UserRepository;
  let adminToken: string;
  let candidateToken: string;

  beforeEach(async () => {
    app = await appPromise; // Wait for app to be created
    userRepository = new UserRepository();
    
    // Create test admin user and get token
    const hashedPassword = await bcrypt.hash('testpassword123', 12);
    
    try {
      await userRepository.create({
        username: 'testadmin',
        email: 'admin@healthcare.local',
        passwordHash: hashedPassword,
        role: 'admin',
        firstName: 'Test',
        lastName: 'Admin',
        isActive: true,
        lastLoginAt: undefined
      });
    } catch (error) {
      // User might already exist
    }

    // Get admin token
    const adminLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@healthcare.local',
        password: 'testpassword123'
      });

    adminToken = adminLoginResponse.body.data.token;

    // Create test candidate user and get token
    try {
      await userRepository.create({
        username: 'testcandidate',
        email: 'candidate@healthcare.local',
        passwordHash: hashedPassword,
        role: 'candidate',
        firstName: 'Test',
        lastName: 'Candidate',
        isActive: true,
        lastLoginAt: undefined
      });
    } catch (error) {
      // User might already exist
    }

    // Get candidate token
    const candidateLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'candidate@healthcare.local',
        password: 'testpassword123'
      });

    candidateToken = candidateLoginResponse.body.data.token;
  });

  // ================================
  // CLIENT MANAGEMENT TESTS
  // ================================

  describe('Client Management Endpoints', () => {
    test('GET /api/admin/templates/clients returns clients list for admin', async () => {
      const response = await request(app)
        .get('/api/admin/templates/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    test('GET /api/admin/templates/clients returns 401 for unauthenticated requests', async () => {
      const response = await request(app)
        .get('/api/admin/templates/clients')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTHENTICATION_ERROR');
    });

    test('GET /api/admin/templates/clients returns 403 for non-admin users', async () => {
      const response = await request(app)
        .get('/api/admin/templates/clients')
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    test('POST /api/admin/templates/clients creates new client', async () => {
      const clientData = {
        name: 'Test Medical Center'
      };

      const response = await request(app)
        .post('/api/admin/templates/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(clientData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Medical Center');
    });

    test('POST /api/admin/templates/clients validates required fields', async () => {
      const response = await request(app)
        .post('/api/admin/templates/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({}) // Missing name
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ================================
  // ACTIVITY MANAGEMENT TESTS
  // ================================

  describe('Activity Management Endpoints', () => {
    test('GET /api/admin/templates/activities returns activities list for admin', async () => {
      const response = await request(app)
        .get('/api/admin/templates/activities')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    test('POST /api/admin/templates/activities creates new activity', async () => {
      const activityData = {
        name: 'Health Screening'
      };

      const response = await request(app)
        .post('/api/admin/templates/activities')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(activityData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Health Screening');
    });
  });

  // ================================
  // OUTCOME MANAGEMENT TESTS
  // ================================

  describe('Outcome Management Endpoints', () => {
    test('GET /api/admin/templates/outcomes returns outcomes list for admin', async () => {
      const response = await request(app)
        .get('/api/admin/templates/outcomes')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    test('POST /api/admin/templates/outcomes creates new outcome', async () => {
      const outcomeData = {
        name: 'Successful Treatment'
      };

      const response = await request(app)
        .post('/api/admin/templates/outcomes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(outcomeData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Successful Treatment');
    });
  });

  // ================================
  // CUSTOM FIELD MANAGEMENT TESTS
  // ================================

  describe('Custom Field Management Endpoints', () => {
    test('GET /api/admin/templates/custom-fields returns custom fields list', async () => {
      const response = await request(app)
        .get('/api/admin/templates/custom-fields')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    test('POST /api/admin/templates/custom-fields creates new custom field', async () => {
      const fieldData = {
        fieldLabel: 'Priority Level',
        fieldType: 'dropdown',
        fieldOrder: 1
      };

      const response = await request(app)
        .post('/api/admin/templates/custom-fields')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(fieldData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.fieldLabel).toBe('Priority Level');
    });

    test('POST /api/admin/templates/custom-fields validates required fields', async () => {
      const response = await request(app)
        .post('/api/admin/templates/custom-fields')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({}) // Missing required fields
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ================================
  // FIELD CHOICE MANAGEMENT TESTS
  // ================================

  describe('Field Choice Management Endpoints', () => {
    test('POST /api/admin/templates/field-choices creates new choice', async () => {
      // First create a custom field
      const fieldResponse = await request(app)
        .post('/api/admin/templates/custom-fields')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fieldLabel: 'Test Field',
          fieldType: 'dropdown',
          fieldOrder: 1
        });

      const fieldId = fieldResponse.body.data.id;

      // Then create a choice for it
      const choiceData = {
        field_id: fieldId,
        choice_text: 'Test Choice',
        choice_order: 1
      };

      const response = await request(app)
        .post('/api/admin/templates/field-choices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(choiceData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.choice_text).toBe('Test Choice');
    });
  });

  // ================================
  // ERROR HANDLING TESTS
  // ================================

  describe('Error Handling', () => {
    test('handles invalid endpoints gracefully', async () => {
      const response = await request(app)
        .get('/api/admin/templates/invalid-endpoint')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      // Should return 404 for non-existent endpoints
    });

    test('validates authentication for all admin endpoints', async () => {
      const endpoints = [
        'GET /api/admin/templates/clients',
        'GET /api/admin/templates/activities',
        'GET /api/admin/templates/outcomes',
        'GET /api/admin/templates/custom-fields'
      ];

      for (const endpoint of endpoints) {
        const [method, path] = endpoint.split(' ');
        const response = await request(app)
          [method.toLowerCase() as keyof typeof request](path);

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      }
    });

    test('validates admin role for all admin endpoints', async () => {
      const endpoints = [
        'GET /api/admin/templates/clients',
        'GET /api/admin/templates/activities', 
        'GET /api/admin/templates/outcomes',
        'GET /api/admin/templates/custom-fields'
      ];

      for (const endpoint of endpoints) {
        const [method, path] = endpoint.split(' ');
        const response = await request(app)
          [method.toLowerCase() as keyof typeof request](path)
          .set('Authorization', `Bearer ${candidateToken}`);

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
      }
    });
  });

  // ================================
  // INTEGRATION TESTS
  // ================================

  describe('Template Integration', () => {
    test('created templates appear in form options', async () => {
      // Create a client
      await request(app)
        .post('/api/admin/templates/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Integration Test Hospital' });

      // Check that it appears in service log options
      const optionsResponse = await request(app)
        .get('/api/service-logs/options')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(optionsResponse.body.success).toBe(true);
      expect(optionsResponse.body.data).toHaveProperty('clients');
      
      const clients = optionsResponse.body.data.clients;
      const createdClient = clients.find((c: any) => c.name === 'Integration Test Hospital');
      expect(createdClient).toBeDefined();
    });

    test('deactivated templates do not appear in form options', async () => {
      // Create a client
      const createResponse = await request(app)
        .post('/api/admin/templates/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'To Be Deactivated Hospital' });

      const clientId = createResponse.body.data.id;

      // Deactivate it
      await request(app)
        .put(`/api/admin/templates/clients/${clientId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_active: false });

      // Check that it doesn't appear in service log options
      const optionsResponse = await request(app)
        .get('/api/service-logs/options')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const clients = optionsResponse.body.data.clients;
      const deactivatedClient = clients.find((c: any) => c.name === 'To Be Deactivated Hospital');
      expect(deactivatedClient).toBeUndefined();
    });
  });
});