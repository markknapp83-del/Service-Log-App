// customFieldApi service tests following documented Jest patterns
import { customFieldApi } from '../services/customFieldApi';
import { apiService } from '../services/apiService';
import { ApiResponse, CustomField, FieldChoice, CustomFieldValue } from '../types';
import { createMockApiResponse } from './setup';

// Mock the base API service
jest.mock('../services/apiService');

const mockApiService = jest.mocked(apiService);

// Healthcare-specific mock data following documented patterns
const mockCustomFields: Array<CustomField & { choices?: FieldChoice[] }> = [
  {
    id: 'field-1',
    fieldLabel: 'Patient Risk Level',
    fieldType: 'dropdown',
    fieldOrder: 2,
    isActive: true,
    choices: [
      { id: 'choice-1', fieldId: 'field-1', choiceText: 'Low Risk', choiceOrder: 2 },
      { id: 'choice-2', fieldId: 'field-1', choiceText: 'High Risk', choiceOrder: 1 },
      { id: 'choice-3', fieldId: 'field-1', choiceText: 'Medium Risk', choiceOrder: 3 },
    ],
  },
  {
    id: 'field-2',
    fieldLabel: 'Additional Notes',
    fieldType: 'text',
    fieldOrder: 1,
    isActive: true,
    choices: [],
  },
  {
    id: 'field-3',
    fieldLabel: 'Patient Age',
    fieldType: 'number',
    fieldOrder: 3,
    isActive: false, // Inactive field
    choices: [],
  },
];

const mockFieldChoices: FieldChoice[] = [
  { id: 'choice-1', fieldId: 'field-1', choiceText: 'Low Risk', choiceOrder: 2 },
  { id: 'choice-2', fieldId: 'field-1', choiceText: 'High Risk', choiceOrder: 1 },
  { id: 'choice-3', fieldId: 'field-1', choiceText: 'Medium Risk', choiceOrder: 3 },
];

const mockCustomFieldValues: CustomFieldValue[] = [
  {
    id: 'value-1',
    patientEntryId: 'entry-123',
    fieldId: 'field-1',
    choiceId: 'choice-2',
  },
  {
    id: 'value-2',
    patientEntryId: 'entry-123',
    fieldId: 'field-2',
    textValue: 'Patient requires careful monitoring',
  },
  {
    id: 'value-3',
    patientEntryId: 'entry-123',
    fieldId: 'field-4',
    numberValue: 67,
  },
  {
    id: 'value-4',
    patientEntryId: 'entry-123',
    fieldId: 'field-5',
    checkboxValue: true,
  },
];

describe('CustomFieldApiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getActiveFields', () => {
    it('successfully retrieves and sorts active fields', async () => {
      mockApiService.get.mockResolvedValue(
        createMockApiResponse(true, mockCustomFields)
      );

      const result = await customFieldApi.getActiveFields();

      expect(mockApiService.get).toHaveBeenCalledWith('/api/custom-fields/active');
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data).toHaveLength(3);
        
        // Verify choices are sorted by choiceOrder
        const dropdownField = result.data.find(f => f.fieldType === 'dropdown');
        expect(dropdownField?.choices).toEqual([
          { id: 'choice-2', fieldId: 'field-1', choiceText: 'High Risk', choiceOrder: 1 },
          { id: 'choice-1', fieldId: 'field-1', choiceText: 'Low Risk', choiceOrder: 2 },
          { id: 'choice-3', fieldId: 'field-1', choiceText: 'Medium Risk', choiceOrder: 3 },
        ]);
      }
    });

    it('handles API failure appropriately', async () => {
      const errorResponse = createMockApiResponse(false);
      errorResponse.error = { message: 'Database connection failed', code: 'DB_ERROR' };
      
      mockApiService.get.mockResolvedValue(errorResponse);

      const result = await customFieldApi.getActiveFields();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Database connection failed');
        expect(result.error.code).toBe('DB_ERROR');
      }
    });

    it('handles network errors by rethrowing', async () => {
      const networkError = new Error('Network request failed');
      mockApiService.get.mockRejectedValue(networkError);

      await expect(customFieldApi.getActiveFields()).rejects.toThrow('Network request failed');
      
      // Verify error is logged
      expect(console.error).toHaveBeenCalledWith('Failed to fetch custom fields:', networkError);
    });

    it('handles fields without choices correctly', async () => {
      const fieldsWithoutChoices = [{
        id: 'field-text',
        fieldLabel: 'Text Field',
        fieldType: 'text',
        fieldOrder: 1,
        isActive: true,
      }];

      mockApiService.get.mockResolvedValue(
        createMockApiResponse(true, fieldsWithoutChoices)
      );

      const result = await customFieldApi.getActiveFields();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data[0].choices).toEqual([]);
      }
    });
  });

  describe('getFieldValues', () => {
    it('successfully retrieves field values for patient entry', async () => {
      mockApiService.get.mockResolvedValue(
        createMockApiResponse(true, mockCustomFieldValues)
      );

      const result = await customFieldApi.getFieldValues('entry-123');

      expect(mockApiService.get).toHaveBeenCalledWith('/api/custom-fields/values/entry-123');
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data).toEqual(mockCustomFieldValues);
        expect(result.data).toHaveLength(4);
      }
    });

    it('handles patient entry not found', async () => {
      const errorResponse = createMockApiResponse(false);
      errorResponse.error = { message: 'Patient entry not found', code: 'NOT_FOUND' };
      
      mockApiService.get.mockResolvedValue(errorResponse);

      const result = await customFieldApi.getFieldValues('nonexistent-entry');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Patient entry not found');
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('handles network errors by rethrowing', async () => {
      const networkError = new Error('Request timeout');
      mockApiService.get.mockRejectedValue(networkError);

      await expect(customFieldApi.getFieldValues('entry-123')).rejects.toThrow('Request timeout');
      expect(console.error).toHaveBeenCalledWith('Failed to fetch custom field values:', networkError);
    });
  });

  describe('saveFieldValues', () => {
    const mockSaveRequests = [
      { patientEntryId: 'entry-456', fieldId: 'field-1', choiceId: 'choice-1' },
      { patientEntryId: 'entry-456', fieldId: 'field-2', textValue: 'New patient notes' },
      { patientEntryId: 'entry-456', fieldId: 'field-3', numberValue: 45 },
      { patientEntryId: 'entry-456', fieldId: 'field-4', checkboxValue: false },
    ];

    it('successfully saves field values', async () => {
      const savedValues = mockSaveRequests.map((req, index) => ({
        id: `saved-value-${index + 1}`,
        ...req,
      })) as CustomFieldValue[];

      mockApiService.post.mockResolvedValue(
        createMockApiResponse(true, savedValues)
      );

      const result = await customFieldApi.saveFieldValues('entry-456', mockSaveRequests);

      expect(mockApiService.post).toHaveBeenCalledWith(
        '/api/custom-fields/values/entry-456',
        mockSaveRequests
      );
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data).toHaveLength(4);
        expect(result.data[0].patientEntryId).toBe('entry-456');
        expect(result.data[1].textValue).toBe('New patient notes');
      }
    });

    it('handles validation errors when saving', async () => {
      const errorResponse = createMockApiResponse(false);
      errorResponse.error = { 
        message: 'Validation failed', 
        code: 'VALIDATION_ERROR',
        details: { fieldId: 'Field ID is required' }
      };
      
      mockApiService.post.mockResolvedValue(errorResponse);

      const result = await customFieldApi.saveFieldValues('entry-456', mockSaveRequests);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Validation failed');
        expect(result.error.details).toEqual({ fieldId: 'Field ID is required' });
      }
    });

    it('handles unauthorized access', async () => {
      const errorResponse = createMockApiResponse(false);
      errorResponse.error = { message: 'Unauthorized access', code: 'UNAUTHORIZED' };
      
      mockApiService.post.mockResolvedValue(errorResponse);

      const result = await customFieldApi.saveFieldValues('entry-456', mockSaveRequests);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('handles empty values array', async () => {
      mockApiService.post.mockResolvedValue(
        createMockApiResponse(true, [])
      );

      const result = await customFieldApi.saveFieldValues('entry-456', []);

      expect(mockApiService.post).toHaveBeenCalledWith(
        '/api/custom-fields/values/entry-456',
        []
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });
  });

  describe('updateFieldValue', () => {
    const updateData = { textValue: 'Updated note content' };

    it('successfully updates a specific field value', async () => {
      const updatedValue: CustomFieldValue = {
        id: 'value-123',
        patientEntryId: 'entry-456',
        fieldId: 'field-2',
        textValue: 'Updated note content',
      };

      mockApiService.put.mockResolvedValue(
        createMockApiResponse(true, updatedValue)
      );

      const result = await customFieldApi.updateFieldValue('value-123', updateData);

      expect(mockApiService.put).toHaveBeenCalledWith(
        '/api/custom-fields/values/update/value-123',
        updateData
      );
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.id).toBe('value-123');
        expect(result.data.textValue).toBe('Updated note content');
      }
    });

    it('handles value not found error', async () => {
      const errorResponse = createMockApiResponse(false);
      errorResponse.error = { message: 'Custom field value not found', code: 'NOT_FOUND' };
      
      mockApiService.put.mockResolvedValue(errorResponse);

      const result = await customFieldApi.updateFieldValue('nonexistent-value', updateData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Custom field value not found');
      }
    });

    it('handles network errors by rethrowing', async () => {
      const networkError = new Error('Connection refused');
      mockApiService.put.mockRejectedValue(networkError);

      await expect(customFieldApi.updateFieldValue('value-123', updateData))
        .rejects.toThrow('Connection refused');
      
      expect(console.error).toHaveBeenCalledWith('Failed to update custom field value:', networkError);
    });
  });

  describe('deleteFieldValues', () => {
    it('successfully deletes field values for patient entry', async () => {
      mockApiService.delete.mockResolvedValue(
        createMockApiResponse(true, undefined)
      );

      const result = await customFieldApi.deleteFieldValues('entry-123');

      expect(mockApiService.delete).toHaveBeenCalledWith('/api/custom-fields/values/entry-123');
      expect(result.success).toBe(true);
    });

    it('handles entry not found during deletion', async () => {
      const errorResponse = createMockApiResponse(false);
      errorResponse.error = { message: 'Entry not found', code: 'NOT_FOUND' };
      
      mockApiService.delete.mockResolvedValue(errorResponse);

      const result = await customFieldApi.deleteFieldValues('nonexistent-entry');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Entry not found');
      }
    });

    it('handles permission denied for deletion', async () => {
      const errorResponse = createMockApiResponse(false);
      errorResponse.error = { message: 'Permission denied', code: 'FORBIDDEN' };
      
      mockApiService.delete.mockResolvedValue(errorResponse);

      const result = await customFieldApi.deleteFieldValues('entry-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('FORBIDDEN');
      }
    });
  });

  describe('getFieldChoices', () => {
    it('successfully retrieves and sorts field choices', async () => {
      mockApiService.get.mockResolvedValue(
        createMockApiResponse(true, mockFieldChoices)
      );

      const result = await customFieldApi.getFieldChoices('field-1');

      expect(mockApiService.get).toHaveBeenCalledWith('/api/custom-fields/field-1/choices');
      expect(result.success).toBe(true);
      
      if (result.success) {
        // Verify choices are sorted by choiceOrder
        expect(result.data).toEqual([
          { id: 'choice-2', fieldId: 'field-1', choiceText: 'High Risk', choiceOrder: 1 },
          { id: 'choice-1', fieldId: 'field-1', choiceText: 'Low Risk', choiceOrder: 2 },
          { id: 'choice-3', fieldId: 'field-1', choiceText: 'Medium Risk', choiceOrder: 3 },
        ]);
      }
    });

    it('handles field not found', async () => {
      const errorResponse = createMockApiResponse(false);
      errorResponse.error = { message: 'Custom field not found', code: 'NOT_FOUND' };
      
      mockApiService.get.mockResolvedValue(errorResponse);

      const result = await customFieldApi.getFieldChoices('nonexistent-field');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Custom field not found');
      }
    });

    it('handles field with no choices', async () => {
      mockApiService.get.mockResolvedValue(
        createMockApiResponse(true, [])
      );

      const result = await customFieldApi.getFieldChoices('text-field');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it('handles network errors by rethrowing', async () => {
      const networkError = new Error('Service unavailable');
      mockApiService.get.mockRejectedValue(networkError);

      await expect(customFieldApi.getFieldChoices('field-1')).rejects.toThrow('Service unavailable');
      expect(console.error).toHaveBeenCalledWith('Failed to fetch field choices:', networkError);
    });
  });

  describe('getFieldStats', () => {
    const mockStats = [
      { 
        id: 'field-1',
        fieldLabel: 'Patient Risk Level',
        fieldType: 'dropdown',
        fieldOrder: 1,
        isActive: true,
        usageCount: 156 
      },
      { 
        id: 'field-2',
        fieldLabel: 'Additional Notes',
        fieldType: 'text',
        fieldOrder: 2,
        isActive: true,
        usageCount: 89 
      },
      { 
        id: 'field-3',
        fieldLabel: 'Follow-up Required',
        fieldType: 'checkbox',
        fieldOrder: 3,
        isActive: false,
        usageCount: 23 
      },
    ];

    it('successfully retrieves field usage statistics', async () => {
      mockApiService.get.mockResolvedValue(
        createMockApiResponse(true, mockStats)
      );

      const result = await customFieldApi.getFieldStats();

      expect(mockApiService.get).toHaveBeenCalledWith('/api/custom-fields/stats');
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data).toHaveLength(3);
        expect(result.data[0].usageCount).toBe(156);
        expect(result.data[1].usageCount).toBe(89);
        expect(result.data[2].usageCount).toBe(23);
      }
    });

    it('handles unauthorized access to statistics', async () => {
      const errorResponse = createMockApiResponse(false);
      errorResponse.error = { message: 'Admin access required', code: 'FORBIDDEN' };
      
      mockApiService.get.mockResolvedValue(errorResponse);

      const result = await customFieldApi.getFieldStats();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Admin access required');
        expect(result.error.code).toBe('FORBIDDEN');
      }
    });

    it('handles empty statistics', async () => {
      mockApiService.get.mockResolvedValue(
        createMockApiResponse(true, [])
      );

      const result = await customFieldApi.getFieldStats();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it('handles network errors by rethrowing', async () => {
      const networkError = new Error('Statistics service down');
      mockApiService.get.mockRejectedValue(networkError);

      await expect(customFieldApi.getFieldStats()).rejects.toThrow('Statistics service down');
      expect(console.error).toHaveBeenCalledWith('Failed to fetch field statistics:', networkError);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('maintains error structure consistency across all methods', async () => {
      const consistentError = createMockApiResponse(false);
      consistentError.error = { message: 'Consistent error', code: 'CONSISTENT_ERROR' };

      // Test all methods maintain consistent error structure
      const methods = [
        () => customFieldApi.getActiveFields(),
        () => customFieldApi.getFieldValues('test'),
        () => customFieldApi.saveFieldValues('test', []),
        () => customFieldApi.updateFieldValue('test', {}),
        () => customFieldApi.deleteFieldValues('test'),
        () => customFieldApi.getFieldChoices('test'),
        () => customFieldApi.getFieldStats(),
      ];

      for (const method of methods) {
        mockApiService.get.mockResolvedValue(consistentError);
        mockApiService.post.mockResolvedValue(consistentError);
        mockApiService.put.mockResolvedValue(consistentError);
        mockApiService.delete.mockResolvedValue(consistentError);

        const result = await method();
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toBe('Consistent error');
          expect(result.error.code).toBe('CONSISTENT_ERROR');
        }
      }
    });

    it('handles malformed API responses gracefully', async () => {
      // Test with malformed response (missing required fields)
      const malformedResponse = { success: true } as any;
      mockApiService.get.mockResolvedValue(malformedResponse);

      const result = await customFieldApi.getActiveFields();

      expect(result.success).toBe(true);
      // Should handle missing data gracefully
    });

    it('logs errors consistently across all methods', async () => {
      const networkError = new Error('Network issue');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const methodsWithExpectedLogs = [
        { method: () => customFieldApi.getActiveFields(), log: 'Failed to fetch custom fields:' },
        { method: () => customFieldApi.getFieldValues('test'), log: 'Failed to fetch custom field values:' },
        { method: () => customFieldApi.saveFieldValues('test', []), log: 'Failed to save custom field values:' },
        { method: () => customFieldApi.updateFieldValue('test', {}), log: 'Failed to update custom field value:' },
        { method: () => customFieldApi.deleteFieldValues('test'), log: 'Failed to delete custom field values:' },
        { method: () => customFieldApi.getFieldChoices('test'), log: 'Failed to fetch field choices:' },
        { method: () => customFieldApi.getFieldStats(), log: 'Failed to fetch field statistics:' },
      ];

      for (const { method, log } of methodsWithExpectedLogs) {
        mockApiService.get.mockRejectedValue(networkError);
        mockApiService.post.mockRejectedValue(networkError);
        mockApiService.put.mockRejectedValue(networkError);
        mockApiService.delete.mockRejectedValue(networkError);

        await expect(method()).rejects.toThrow('Network issue');
        expect(consoleSpy).toHaveBeenCalledWith(log, networkError);
        
        consoleSpy.mockClear();
      }

      consoleSpy.mockRestore();
    });
  });

  describe('Healthcare Data Validation', () => {
    it('properly handles healthcare-specific field types', async () => {
      const healthcareFields = [
        {
          id: 'field-medical-1',
          fieldLabel: 'Blood Pressure Category',
          fieldType: 'dropdown',
          fieldOrder: 1,
          isActive: true,
          choices: [
            { id: 'bp-1', fieldId: 'field-medical-1', choiceText: 'Normal', choiceOrder: 1 },
            { id: 'bp-2', fieldId: 'field-medical-1', choiceText: 'Elevated', choiceOrder: 2 },
            { id: 'bp-3', fieldId: 'field-medical-1', choiceText: 'Hypertension Stage 1', choiceOrder: 3 },
            { id: 'bp-4', fieldId: 'field-medical-1', choiceText: 'Hypertension Stage 2', choiceOrder: 4 },
          ],
        },
        {
          id: 'field-medical-2',
          fieldLabel: 'Patient BMI',
          fieldType: 'number',
          fieldOrder: 2,
          isActive: true,
          choices: [],
        },
      ];

      mockApiService.get.mockResolvedValue(
        createMockApiResponse(true, healthcareFields)
      );

      const result = await customFieldApi.getActiveFields();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data[0].fieldLabel).toBe('Blood Pressure Category');
        expect(result.data[0].choices).toHaveLength(4);
        expect(result.data[1].fieldType).toBe('number');
      }
    });

    it('handles HIPAA-compliant error responses', async () => {
      const hipaaCompliantError = createMockApiResponse(false);
      hipaaCompliantError.error = { 
        message: 'Access denied', // Generic message, no patient data
        code: 'HIPAA_VIOLATION_PREVENTED' 
      };
      
      mockApiService.get.mockResolvedValue(hipaaCompliantError);

      const result = await customFieldApi.getFieldValues('sensitive-entry');

      expect(result.success).toBe(false);
      if (!result.success) {
        // Verify no sensitive patient data in error
        expect(result.error.message).not.toContain('patient');
        expect(result.error.message).not.toContain('medical');
        expect(result.error.message).toBe('Access denied');
      }
    });
  });
});