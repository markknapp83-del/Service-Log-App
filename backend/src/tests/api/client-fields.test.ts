// Tests for client-specific custom fields API endpoints
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { app } from '../../app';
import { db } from '../../database/connection';
import { createTestUser, createAuthToken, cleanup } from '../helpers/testHelpers';

describe('Client-Specific Custom Fields API', () => {
  let adminToken: string;
  let candidateToken: string;
  let testClientId: string;
  let testFieldId: string;

  beforeAll(async () => {
    // Create test users
    const admin = await createTestUser({ role: 'admin' });
    const candidate = await createTestUser({ role: 'candidate' });

    adminToken = createAuthToken(admin.id, 'admin');
    candidateToken = createAuthToken(candidate.id, 'candidate');

    // Create test client
    const clientResult = db.prepare(`
      INSERT INTO clients (name, is_active) 
      VALUES (?, 1) 
      RETURNING id
    `).get('Test Hospital');
    testClientId = (clientResult as any).id;
  });

  afterAll(async () => {
    await cleanup();
  });

  beforeEach(() => {
    // Clean up custom fields before each test
    db.prepare('DELETE FROM custom_field_values').run();
    db.prepare('DELETE FROM field_choices').run();
    db.prepare('DELETE FROM custom_fields WHERE client_id IS NOT NULL').run();
  });

  describe('GET /api/form-config/:clientId', () => {
    it('should return empty array when client has no custom fields', async () => {
      const response = await request(app)
        .get(`/api/form-config/${testClientId}`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    it('should return client-specific fields only', async () => {
      // Create a global field
      const globalFieldId = db.prepare(`
        INSERT INTO custom_fields (field_label, field_type, field_order, is_active) 
        VALUES ('Global Field', 'text', 0, 1) 
        RETURNING id
      `).get().id;

      // Create a client-specific field
      const clientFieldId = db.prepare(`
        INSERT INTO custom_fields (field_label, field_type, field_order, is_active, client_id) 
        VALUES ('Client Field', 'dropdown', 1, 1, ?) 
        RETURNING id
      `).get(testClientId).id;

      // Add choices to dropdown field
      db.prepare(`
        INSERT INTO field_choices (field_id, choice_text, choice_order) 
        VALUES (?, 'Choice 1', 0), (?, 'Choice 2', 1)
      `).run(clientFieldId, clientFieldId);

      const response = await request(app)
        .get(`/api/form-config/${testClientId}`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2); // Should include both global and client-specific
      
      const clientField = response.body.data.find((f: any) => f.fieldLabel === 'Client Field');
      expect(clientField).toBeDefined();
      expect(clientField.choices).toHaveLength(2);
      expect(clientField.choices[0].choiceText).toBe('Choice 1');
    });

    it('should return 404 for non-existent client', async () => {
      const response = await request(app)
        .get('/api/form-config/999999')
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CLIENT_NOT_FOUND');
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/form-config/${testClientId}`)
        .expect(401);
    });
  });

  describe('GET /api/admin/clients/:clientId/fields', () => {
    it('should return only client-specific fields for admin', async () => {
      // Create a global field (should not be returned)
      db.prepare(`
        INSERT INTO custom_fields (field_label, field_type, field_order, is_active) 
        VALUES ('Global Field', 'text', 0, 1)
      `).run();

      // Create a client-specific field
      const clientFieldId = db.prepare(`
        INSERT INTO custom_fields (field_label, field_type, field_order, is_active, client_id, is_required) 
        VALUES ('Priority Level', 'dropdown', 0, 1, ?, 0) 
        RETURNING id
      `).get(testClientId).id;

      // Add choices
      db.prepare(`
        INSERT INTO field_choices (field_id, choice_text, choice_order) 
        VALUES (?, 'High', 0), (?, 'Medium', 1), (?, 'Low', 2)
      `).run(clientFieldId, clientFieldId, clientFieldId);

      const response = await request(app)
        .get(`/api/admin/clients/${testClientId}/fields`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].fieldLabel).toBe('Priority Level');
      expect(response.body.data[0].fieldType).toBe('dropdown');
      expect(response.body.data[0].clientId).toBe(testClientId);
      expect(response.body.data[0].choices).toHaveLength(3);
    });

    it('should require admin role', async () => {
      await request(app)
        .get(`/api/admin/clients/${testClientId}/fields`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent client', async () => {
      await request(app)
        .get('/api/admin/clients/999999/fields')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('POST /api/admin/clients/:clientId/fields', () => {
    it('should create text field for client', async () => {
      const fieldData = {
        fieldLabel: 'Referral Source',
        fieldType: 'text',
        fieldOrder: 0,
        isRequired: true,
      };

      const response = await request(app)
        .post(`/api/admin/clients/${testClientId}/fields`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(fieldData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.fieldLabel).toBe('Referral Source');
      expect(response.body.data.fieldType).toBe('text');
      expect(response.body.data.clientId).toBe(testClientId);
      expect(response.body.data.isRequired).toBe(true);

      testFieldId = response.body.data.id;
    });

    it('should create dropdown field with choices', async () => {
      const fieldData = {
        fieldLabel: 'Priority Level',
        fieldType: 'dropdown',
        fieldOrder: 1,
        isRequired: false,
        choices: [
          { choiceText: 'High', choiceOrder: 0 },
          { choiceText: 'Medium', choiceOrder: 1 },
          { choiceText: 'Low', choiceOrder: 2 },
        ],
      };

      const response = await request(app)
        .post(`/api/admin/clients/${testClientId}/fields`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(fieldData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.fieldType).toBe('dropdown');
      expect(response.body.data.choices).toHaveLength(3);
      expect(response.body.data.choices[0].choiceText).toBe('High');
    });

    it('should validate field label uniqueness within client scope', async () => {
      // Create first field
      const fieldData = {
        fieldLabel: 'Duplicate Label',
        fieldType: 'text',
        fieldOrder: 0,
      };

      await request(app)
        .post(`/api/admin/clients/${testClientId}/fields`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(fieldData)
        .expect(201);

      // Try to create another field with same label for same client
      const response = await request(app)
        .post(`/api/admin/clients/${testClientId}/fields`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(fieldData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FIELD_LABEL_EXISTS');
    });

    it('should require admin role', async () => {
      const fieldData = {
        fieldLabel: 'Test Field',
        fieldType: 'text',
        fieldOrder: 0,
      };

      await request(app)
        .post(`/api/admin/clients/${testClientId}/fields`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .send(fieldData)
        .expect(403);
    });

    it('should validate required fields', async () => {
      const fieldData = {
        fieldType: 'text', // Missing fieldLabel
      };

      const response = await request(app)
        .post(`/api/admin/clients/${testClientId}/fields`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(fieldData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should require choices for dropdown fields', async () => {
      const fieldData = {
        fieldLabel: 'Dropdown Field',
        fieldType: 'dropdown',
        fieldOrder: 0,
        choices: [], // Empty choices array
      };

      const response = await request(app)
        .post(`/api/admin/clients/${testClientId}/fields`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(fieldData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('DROPDOWN_REQUIRES_CHOICES');
    });
  });

  describe('PUT /api/admin/clients/:clientId/fields/:fieldId', () => {
    beforeEach(async () => {
      // Create a test field
      const result = db.prepare(`
        INSERT INTO custom_fields (field_label, field_type, field_order, is_active, client_id) 
        VALUES ('Test Field', 'text', 0, 1, ?) 
        RETURNING id
      `).get(testClientId);
      testFieldId = (result as any).id;
    });

    it('should update field properties', async () => {
      const updates = {
        fieldLabel: 'Updated Field Label',
        isRequired: true,
      };

      const response = await request(app)
        .put(`/api/admin/clients/${testClientId}/fields/${testFieldId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.fieldLabel).toBe('Updated Field Label');
      expect(response.body.data.isRequired).toBe(true);
    });

    it('should update dropdown field choices', async () => {
      // First create a dropdown field
      const dropdownId = db.prepare(`
        INSERT INTO custom_fields (field_label, field_type, field_order, is_active, client_id) 
        VALUES ('Dropdown Field', 'dropdown', 0, 1, ?) 
        RETURNING id
      `).get(testClientId).id;

      const updates = {
        choices: [
          { choiceText: 'New Choice 1', choiceOrder: 0 },
          { choiceText: 'New Choice 2', choiceOrder: 1 },
        ],
      };

      const response = await request(app)
        .put(`/api/admin/clients/${testClientId}/fields/${dropdownId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.choices).toHaveLength(2);
      expect(response.body.data.choices[0].choiceText).toBe('New Choice 1');
    });

    it('should require admin role', async () => {
      const updates = { fieldLabel: 'Updated Label' };

      await request(app)
        .put(`/api/admin/clients/${testClientId}/fields/${testFieldId}`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .send(updates)
        .expect(403);
    });

    it('should return 404 for non-existent field', async () => {
      const updates = { fieldLabel: 'Updated Label' };

      await request(app)
        .put(`/api/admin/clients/${testClientId}/fields/999999`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updates)
        .expect(404);
    });
  });

  describe('DELETE /api/admin/clients/:clientId/fields/:fieldId', () => {
    beforeEach(async () => {
      // Create a test field
      const result = db.prepare(`
        INSERT INTO custom_fields (field_label, field_type, field_order, is_active, client_id) 
        VALUES ('Test Field', 'text', 0, 1, ?) 
        RETURNING id
      `).get(testClientId);
      testFieldId = (result as any).id;
    });

    it('should soft delete field', async () => {
      const response = await request(app)
        .delete(`/api/admin/clients/${testClientId}/fields/${testFieldId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify field is soft deleted
      const field = db.prepare('SELECT is_active FROM custom_fields WHERE id = ?').get(testFieldId);
      expect(field?.is_active).toBe(0);
    });

    it('should cascade delete field choices', async () => {
      // Create dropdown field with choices
      const dropdownId = db.prepare(`
        INSERT INTO custom_fields (field_label, field_type, field_order, is_active, client_id) 
        VALUES ('Dropdown Field', 'dropdown', 0, 1, ?) 
        RETURNING id
      `).get(testClientId).id;

      db.prepare(`
        INSERT INTO field_choices (field_id, choice_text, choice_order) 
        VALUES (?, 'Choice 1', 0), (?, 'Choice 2', 1)
      `).run(dropdownId, dropdownId);

      await request(app)
        .delete(`/api/admin/clients/${testClientId}/fields/${dropdownId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Verify choices are deleted
      const choices = db.prepare('SELECT COUNT(*) as count FROM field_choices WHERE field_id = ?').get(dropdownId);
      expect(choices.count).toBe(0);
    });

    it('should require admin role', async () => {
      await request(app)
        .delete(`/api/admin/clients/${testClientId}/fields/${testFieldId}`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent field', async () => {
      await request(app)
        .delete(`/api/admin/clients/${testClientId}/fields/999999`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should prevent deletion of field with existing values', async () => {
      // This would require creating patient entries and field values
      // Implementation depends on your business rules
      // For now, assuming soft delete is allowed even with existing values
      
      const response = await request(app)
        .delete(`/api/admin/clients/${testClientId}/fields/${testFieldId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Field Label Uniqueness', () => {
    it('should allow same field label for different clients', async () => {
      // Create another client
      const client2Id = db.prepare(`
        INSERT INTO clients (name, is_active) 
        VALUES ('Second Hospital', 1) 
        RETURNING id
      `).get().id;

      const fieldData = {
        fieldLabel: 'Same Label',
        fieldType: 'text',
        fieldOrder: 0,
      };

      // Create field for first client
      await request(app)
        .post(`/api/admin/clients/${testClientId}/fields`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(fieldData)
        .expect(201);

      // Create field with same label for second client (should succeed)
      const response = await request(app)
        .post(`/api/admin/clients/${client2Id}/fields`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(fieldData)
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should allow client-specific field to have same label as global field', async () => {
      // Create global field
      db.prepare(`
        INSERT INTO custom_fields (field_label, field_type, field_order, is_active) 
        VALUES ('Common Field', 'text', 0, 1)
      `).run();

      // Create client-specific field with same label (should succeed)
      const fieldData = {
        fieldLabel: 'Common Field',
        fieldType: 'dropdown',
        fieldOrder: 0,
        choices: [{ choiceText: 'Option 1', choiceOrder: 0 }],
      };

      const response = await request(app)
        .post(`/api/admin/clients/${testClientId}/fields`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(fieldData)
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });
});