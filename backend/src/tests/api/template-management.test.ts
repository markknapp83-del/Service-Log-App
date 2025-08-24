// Template Management API Tests following Jest documentation patterns
// Comprehensive tests for all template management endpoints
import { describe, test, expect, beforeAll, beforeEach, afterAll, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '@/app';
import { UserRepository } from '@/models/UserRepository';
import { ClientRepository } from '@/models/ClientRepository';
import { ActivityRepository } from '@/models/ActivityRepository';
import { OutcomeRepository } from '@/models/OutcomeRepository';
import { CustomFieldRepository } from '@/models/CustomFieldRepository';
import { FieldChoiceRepository } from '@/models/FieldChoiceRepository';
import bcrypt from 'bcryptjs';

describe('Template Management API', () => {
  let userRepository: UserRepository;
  let clientRepository: ClientRepository;
  let activityRepository: ActivityRepository;
  let outcomeRepository: OutcomeRepository;
  let customFieldRepository: CustomFieldRepository;
  let fieldChoiceRepository: FieldChoiceRepository;
  let adminToken: string;
  let candidateToken: string;

  beforeAll(async () => {
    userRepository = new UserRepository();
    clientRepository = new ClientRepository();
    activityRepository = new ActivityRepository();
    outcomeRepository = new OutcomeRepository();
    customFieldRepository = new CustomFieldRepository();
    fieldChoiceRepository = new FieldChoiceRepository();
  });

  beforeEach(async () => {
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
      // User might already exist, that's okay for tests
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
      // User might already exist, that's okay for tests
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

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ================================
  // CLIENT MANAGEMENT TESTS
  // ================================

  describe('Client Management - GET /api/admin/templates/clients', () => {
    test('returns clients with usage statistics', async () => {
      const response = await request(app)
        .get('/api/admin/templates/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    test('returns 401 for unauthenticated requests', async () => {
      const response = await request(app)
        .get('/api/admin/templates/clients')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    test('returns 403 for non-admin users', async () => {
      const response = await request(app)
        .get('/api/admin/templates/clients')
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Client Management - POST /api/admin/templates/clients', () => {
    test('creates new client with valid data', async () => {
      const clientData = {
        name: 'New Medical Center',
        isActive: true
      };

      const response = await request(app)
        .post('/api/admin/templates/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(clientData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: expect.any(Number),
        name: 'New Medical Center',
        is_active: true,
        created_by: 'admin-123'
      });
      expect(response.body.data.created_at).toBeDefined();

      // Verify client was saved to database
      const savedClient = db.prepare('SELECT * FROM clients WHERE id = ?').get(response.body.data.id);
      expect(savedClient).toBeDefined();
      expect(savedClient.name).toBe('New Medical Center');
    });

    test('validates required fields', async () => {
      const response = await request(app)
        .post('/api/admin/templates/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({}) // Missing name
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('prevents duplicate client names', async () => {
      // Create initial client
      const stmt = db.prepare(`
        INSERT INTO clients (id, name, is_active, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(1, 'Existing Hospital', 1, 'admin-123', '2023-12-01T10:00:00Z', '2023-12-01T10:00:00Z');

      const response = await request(app)
        .post('/api/admin/templates/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Existing Hospital', isActive: true })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CONFLICT_ERROR');
    });
  });

  describe('Client Management - PUT /api/admin/templates/clients/:id', () => {
    test('updates client successfully', async () => {
      // Create test client
      const stmt = db.prepare(`
        INSERT INTO clients (id, name, is_active, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(1, 'Original Name', 1, 'admin-123', '2023-12-01T10:00:00Z', '2023-12-01T10:00:00Z');

      const updateData = {
        name: 'Updated Name',
        is_active: false
      };

      const response = await request(app)
        .put('/api/admin/templates/clients/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Name');
      expect(response.body.data.is_active).toBe(false);

      // Verify update in database
      const updatedClient = db.prepare('SELECT * FROM clients WHERE id = ?').get(1);
      expect(updatedClient.name).toBe('Updated Name');
      expect(updatedClient.is_active).toBe(0);
    });

    test('returns 404 for non-existent client', async () => {
      const response = await request(app)
        .put('/api/admin/templates/clients/999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test Name' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    test('validates client ID format', async () => {
      const response = await request(app)
        .put('/api/admin/templates/clients/invalid')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test Name' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Client Management - DELETE /api/admin/templates/clients/:id', () => {
    test('deletes client successfully', async () => {
      // Create test client
      const stmt = db.prepare(`
        INSERT INTO clients (id, name, is_active, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(1, 'Test Client', 1, 'admin-123', '2023-12-01T10:00:00Z', '2023-12-01T10:00:00Z');

      const response = await request(app)
        .delete('/api/admin/templates/clients/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');

      // Verify soft deletion in database
      const deletedClient = db.prepare('SELECT * FROM clients WHERE id = ? AND deleted_at IS NULL').get(1);
      expect(deletedClient).toBeNull();
    });

    test('prevents deletion of client with service logs', async () => {
      // Create client and service log
      const clientStmt = db.prepare(`
        INSERT INTO clients (id, name, is_active, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      clientStmt.run(1, 'Active Client', 1, 'admin-123', '2023-12-01T10:00:00Z', '2023-12-01T10:00:00Z');

      const serviceStmt = db.prepare(`
        INSERT INTO service_logs (id, client_id, activity_id, patient_count, is_draft, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      serviceStmt.run('log-1', 1, 1, 5, 0, 'candidate-123', '2023-12-01T11:00:00Z');

      const response = await request(app)
        .delete('/api/admin/templates/clients/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CONFLICT_ERROR');
      expect(response.body.error.message).toContain('service logs');
    });
  });

  // ================================
  // ACTIVITY MANAGEMENT TESTS
  // ================================

  describe('Activity Management - GET /api/admin/templates/activities', () => {
    test('returns activities with usage statistics', async () => {
      // Create test activities
      const stmt = db.prepare(`
        INSERT INTO activities (id, name, is_active, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(1, 'Health Screening', 1, 'admin-123', '2023-12-01T10:00:00Z', '2023-12-01T10:00:00Z');
      stmt.run(2, 'Vaccination', 0, 'admin-123', '2023-12-01T10:00:00Z', '2023-12-01T10:00:00Z');

      const response = await request(app)
        .get('/api/admin/templates/activities')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      
      const activeActivity = response.body.data.find((a: any) => a.name === 'Health Screening');
      expect(activeActivity).toMatchObject({
        id: 1,
        name: 'Health Screening',
        is_active: true
      });
    });
  });

  describe('Activity Management - POST /api/admin/templates/activities', () => {
    test('creates new activity with valid data', async () => {
      const activityData = {
        name: 'Mental Health Consultation',
        isActive: true
      };

      const response = await request(app)
        .post('/api/admin/templates/activities')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(activityData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: expect.any(Number),
        name: 'Mental Health Consultation',
        is_active: true,
        created_by: 'admin-123'
      });
    });

    test('validates required fields', async () => {
      const response = await request(app)
        .post('/api/admin/templates/activities')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({}) // Missing name
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ================================
  // OUTCOME MANAGEMENT TESTS
  // ================================

  describe('Outcome Management - GET /api/admin/templates/outcomes', () => {
    test('returns outcomes with usage statistics', async () => {
      // Create test outcomes
      const stmt = db.prepare(`
        INSERT INTO outcomes (id, name, is_active, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(1, 'Successful Treatment', 1, 'admin-123', '2023-12-01T10:00:00Z', '2023-12-01T10:00:00Z');
      stmt.run(2, 'Follow-up Required', 1, 'admin-123', '2023-12-01T10:00:00Z', '2023-12-01T10:00:00Z');

      const response = await request(app)
        .get('/api/admin/templates/outcomes')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('Outcome Management - POST /api/admin/templates/outcomes', () => {
    test('creates new outcome with valid data', async () => {
      const outcomeData = {
        name: 'Patient Referred',
        isActive: true
      };

      const response = await request(app)
        .post('/api/admin/templates/outcomes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(outcomeData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: expect.any(Number),
        name: 'Patient Referred',
        is_active: true,
        created_by: 'admin-123'
      });
    });
  });

  // ================================
  // CUSTOM FIELD MANAGEMENT TESTS
  // ================================

  describe('Custom Field Management - GET /api/admin/templates/custom-fields', () => {
    test('returns custom fields with choices', async () => {
      // Create test custom field
      const fieldStmt = db.prepare(`
        INSERT INTO custom_fields (id, field_label, field_type, field_order, is_active, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      fieldStmt.run(1, 'Priority Level', 'dropdown', 1, 1, 'admin-123', '2023-12-01T10:00:00Z', '2023-12-01T10:00:00Z');

      // Create choices for the field
      const choiceStmt = db.prepare(`
        INSERT INTO field_choices (id, field_id, choice_text, choice_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      choiceStmt.run(1, 1, 'High', 1, '2023-12-01T10:00:00Z', '2023-12-01T10:00:00Z');
      choiceStmt.run(2, 1, 'Medium', 2, '2023-12-01T10:00:00Z', '2023-12-01T10:00:00Z');
      choiceStmt.run(3, 1, 'Low', 3, '2023-12-01T10:00:00Z', '2023-12-01T10:00:00Z');

      const response = await request(app)
        .get('/api/admin/templates/custom-fields')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      
      const field = response.body.data[0];
      expect(field).toMatchObject({
        id: 1,
        field_label: 'Priority Level',
        field_type: 'dropdown',
        field_order: 1,
        is_active: true,
        choices: expect.arrayContaining([
          expect.objectContaining({ choice_text: 'High', choice_order: 1 }),
          expect.objectContaining({ choice_text: 'Medium', choice_order: 2 }),
          expect.objectContaining({ choice_text: 'Low', choice_order: 3 })
        ])
      });
      expect(field.choices).toHaveLength(3);
    });
  });

  describe('Custom Field Management - POST /api/admin/templates/custom-fields', () => {
    test('creates dropdown field with choices', async () => {
      const fieldData = {
        fieldLabel: 'Service Category',
        fieldType: 'dropdown',
        fieldOrder: 1,
        isActive: true,
        choices: [
          { choiceText: 'Primary Care', choiceOrder: 1 },
          { choiceText: 'Specialty Care', choiceOrder: 2 },
          { choiceText: 'Emergency Care', choiceOrder: 3 }
        ]
      };

      const response = await request(app)
        .post('/api/admin/templates/custom-fields')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(fieldData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: expect.any(Number),
        field_label: 'Service Category',
        field_type: 'dropdown',
        field_order: 1,
        is_active: true,
        choices: expect.arrayContaining([
          expect.objectContaining({ choice_text: 'Primary Care' }),
          expect.objectContaining({ choice_text: 'Specialty Care' }),
          expect.objectContaining({ choice_text: 'Emergency Care' })
        ])
      });

      // Verify field and choices were saved to database
      const fieldId = response.body.data.id;
      const savedField = db.prepare('SELECT * FROM custom_fields WHERE id = ?').get(fieldId);
      expect(savedField).toBeDefined();

      const savedChoices = db.prepare('SELECT * FROM field_choices WHERE field_id = ? ORDER BY choice_order').all(fieldId);
      expect(savedChoices).toHaveLength(3);
      expect(savedChoices[0].choice_text).toBe('Primary Care');
    });

    test('validates dropdown fields have choices', async () => {
      const fieldData = {
        fieldLabel: 'Empty Dropdown',
        fieldType: 'dropdown',
        fieldOrder: 1,
        isActive: true,
        choices: [] // No choices for dropdown
      };

      const response = await request(app)
        .post('/api/admin/templates/custom-fields')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(fieldData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('at least one choice');
    });

    test('validates required fields', async () => {
      const response = await request(app)
        .post('/api/admin/templates/custom-fields')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({}) // Missing required fields
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Custom Field Management - PUT /api/admin/templates/custom-fields/:id', () => {
    test('updates custom field successfully', async () => {
      // Create test field
      const stmt = db.prepare(`
        INSERT INTO custom_fields (id, field_label, field_type, field_order, is_active, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(1, 'Original Label', 'dropdown', 1, 1, 'admin-123', '2023-12-01T10:00:00Z', '2023-12-01T10:00:00Z');

      const updateData = {
        field_label: 'Updated Label',
        field_order: 5,
        is_active: false
      };

      const response = await request(app)
        .put('/api/admin/templates/custom-fields/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.field_label).toBe('Updated Label');
      expect(response.body.data.field_order).toBe(5);
      expect(response.body.data.is_active).toBe(false);
    });

    test('returns 404 for non-existent field', async () => {
      const response = await request(app)
        .put('/api/admin/templates/custom-fields/999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ field_label: 'Test' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Custom Field Management - DELETE /api/admin/templates/custom-fields/:id', () => {
    test('deletes custom field and related choices', async () => {
      // Create test field with choices
      const fieldStmt = db.prepare(`
        INSERT INTO custom_fields (id, field_label, field_type, field_order, is_active, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      fieldStmt.run(1, 'Test Field', 'dropdown', 1, 1, 'admin-123', '2023-12-01T10:00:00Z', '2023-12-01T10:00:00Z');

      const choiceStmt = db.prepare(`
        INSERT INTO field_choices (id, field_id, choice_text, choice_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      choiceStmt.run(1, 1, 'Choice 1', 1, '2023-12-01T10:00:00Z', '2023-12-01T10:00:00Z');
      choiceStmt.run(2, 1, 'Choice 2', 2, '2023-12-01T10:00:00Z', '2023-12-01T10:00:00Z');

      const response = await request(app)
        .delete('/api/admin/templates/custom-fields/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');

      // Verify field and choices were deleted
      const deletedField = db.prepare('SELECT * FROM custom_fields WHERE id = ? AND deleted_at IS NULL').get(1);
      expect(deletedField).toBeNull();

      const deletedChoices = db.prepare('SELECT * FROM field_choices WHERE field_id = ?').all(1);
      expect(deletedChoices).toHaveLength(0);
    });
  });

  // ================================
  // FIELD CHOICE MANAGEMENT TESTS
  // ================================

  describe('Field Choice Management - POST /api/admin/templates/field-choices', () => {
    test('creates new field choice', async () => {
      // Create test field first
      const stmt = db.prepare(`
        INSERT INTO custom_fields (id, field_label, field_type, field_order, is_active, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(1, 'Test Field', 'dropdown', 1, 1, 'admin-123', '2023-12-01T10:00:00Z', '2023-12-01T10:00:00Z');

      const choiceData = {
        field_id: 1,
        choice_text: 'New Choice',
        choice_order: 1
      };

      const response = await request(app)
        .post('/api/admin/templates/field-choices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(choiceData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: expect.any(Number),
        field_id: 1,
        choice_text: 'New Choice',
        choice_order: 1
      });
    });
  });

  describe('Field Choice Management - PUT /api/admin/templates/field-choices/:id', () => {
    test('updates field choice', async () => {
      // Create test field and choice
      const fieldStmt = db.prepare(`
        INSERT INTO custom_fields (id, field_label, field_type, field_order, is_active, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      fieldStmt.run(1, 'Test Field', 'dropdown', 1, 1, 'admin-123', '2023-12-01T10:00:00Z', '2023-12-01T10:00:00Z');

      const choiceStmt = db.prepare(`
        INSERT INTO field_choices (id, field_id, choice_text, choice_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      choiceStmt.run(1, 1, 'Original Text', 1, '2023-12-01T10:00:00Z', '2023-12-01T10:00:00Z');

      const updateData = {
        choice_text: 'Updated Text',
        choice_order: 2
      };

      const response = await request(app)
        .put('/api/admin/templates/field-choices/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.choice_text).toBe('Updated Text');
      expect(response.body.data.choice_order).toBe(2);
    });
  });

  describe('Field Choice Management - DELETE /api/admin/templates/field-choices/:id', () => {
    test('deletes field choice', async () => {
      // Create test field and choice
      const fieldStmt = db.prepare(`
        INSERT INTO custom_fields (id, field_label, field_type, field_order, is_active, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      fieldStmt.run(1, 'Test Field', 'dropdown', 1, 1, 'admin-123', '2023-12-01T10:00:00Z', '2023-12-01T10:00:00Z');

      const choiceStmt = db.prepare(`
        INSERT INTO field_choices (id, field_id, choice_text, choice_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      choiceStmt.run(1, 1, 'Test Choice', 1, '2023-12-01T10:00:00Z', '2023-12-01T10:00:00Z');

      const response = await request(app)
        .delete('/api/admin/templates/field-choices/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');

      // Verify choice was deleted
      const deletedChoice = db.prepare('SELECT * FROM field_choices WHERE id = ?').get(1);
      expect(deletedChoice).toBeNull();
    });
  });

  // ================================
  // FIELD ORDERING TESTS
  // ================================

  describe('Field Ordering - Custom Field Reordering', () => {
    test('updates field order correctly', async () => {
      // Create multiple test fields
      const stmt = db.prepare(`
        INSERT INTO custom_fields (id, field_label, field_type, field_order, is_active, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(1, 'Field 1', 'dropdown', 1, 1, 'admin-123', '2023-12-01T10:00:00Z', '2023-12-01T10:00:00Z');
      stmt.run(2, 'Field 2', 'dropdown', 2, 1, 'admin-123', '2023-12-01T10:00:00Z', '2023-12-01T10:00:00Z');
      stmt.run(3, 'Field 3', 'dropdown', 3, 1, 'admin-123', '2023-12-01T10:00:00Z', '2023-12-01T10:00:00Z');

      const reorderData = {
        fieldOrders: [
          { fieldId: 1, order: 3 },
          { fieldId: 2, order: 1 },
          { fieldId: 3, order: 2 }
        ]
      };

      const response = await request(app)
        .put('/api/admin/templates/custom-fields/reorder')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(reorderData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('reordered successfully');

      // Verify new order in database
      const reorderedFields = db.prepare('SELECT id, field_order FROM custom_fields ORDER BY field_order').all();
      expect(reorderedFields).toEqual([
        { id: 2, field_order: 1 },
        { id: 3, field_order: 2 },
        { id: 1, field_order: 3 }
      ]);
    });
  });

  // ================================
  // ERROR HANDLING TESTS
  // ================================

  describe('Error Handling', () => {
    test('handles database errors gracefully', async () => {
      // Force a database error by closing the database connection
      const originalDb = app.get('database');
      app.set('database', null);

      const response = await request(app)
        .get('/api/admin/templates/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');

      // Restore database connection
      app.set('database', originalDb);
    });

    test('validates UUID parameters correctly', async () => {
      const endpoints = [
        'PUT /api/admin/templates/clients/invalid-uuid',
        'DELETE /api/admin/templates/clients/not-a-number',
        'PUT /api/admin/templates/custom-fields/abc123'
      ];

      for (const endpoint of endpoints) {
        const [method, path] = endpoint.split(' ');
        const response = await request(app)
          [method.toLowerCase() as keyof typeof request](path)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ name: 'Test' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      }
    });

    test('prevents operations on soft-deleted entities', async () => {
      // Create and soft delete a client
      const stmt = db.prepare(`
        INSERT INTO clients (id, name, is_active, created_by, created_at, updated_at, deleted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(1, 'Deleted Client', 1, 'admin-123', '2023-12-01T10:00:00Z', '2023-12-01T10:00:00Z', '2023-12-01T11:00:00Z');

      const response = await request(app)
        .put('/api/admin/templates/clients/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  // ================================
  // AUDIT LOGGING TESTS
  // ================================

  describe('Audit Logging', () => {
    test('logs template management operations', async () => {
      const clientData = { name: 'Audit Test Client', isActive: true };

      const response = await request(app)
        .post('/api/admin/templates/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(clientData)
        .expect(201);

      // Verify audit log entry was created
      const auditLog = db.prepare(`
        SELECT * FROM audit_logs 
        WHERE entity_type = 'client' 
        AND entity_id = ? 
        AND action = 'create'
      `).get(response.body.data.id);

      expect(auditLog).toBeDefined();
      expect(auditLog.performed_by).toBe('admin-123');
      expect(JSON.parse(auditLog.changes)).toMatchObject(clientData);
    });
  });

  // ================================
  // PERFORMANCE TESTS
  // ================================

  describe('Performance', () => {
    test('handles large number of custom fields efficiently', async () => {
      // Create many custom fields
      const stmt = db.prepare(`
        INSERT INTO custom_fields (id, field_label, field_type, field_order, is_active, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (let i = 1; i <= 100; i++) {
        stmt.run(i, `Field ${i}`, 'dropdown', i, 1, 'admin-123', '2023-12-01T10:00:00Z', '2023-12-01T10:00:00Z');
      }

      const startTime = process.hrtime.bigint();
      
      const response = await request(app)
        .get('/api/admin/templates/custom-fields')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds

      expect(response.body.data).toHaveLength(100);
      expect(duration).toBeLessThan(500); // Should complete within 500ms
    });
  });
});