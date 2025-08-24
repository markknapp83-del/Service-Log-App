// Custom Fields API routes following documented Express.js patterns
import { Router } from 'express';
import { CustomFieldRepository } from '../models/CustomFieldRepository';
import { FieldChoiceRepository } from '../models/FieldChoiceRepository';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { ApiResponse } from '../types';
import { z } from 'zod';

const router = Router();
const customFieldRepo = new CustomFieldRepository();
const fieldChoiceRepo = new FieldChoiceRepository();

// Validation schemas following Zod documentation patterns
const customFieldValueSchema = z.object({
  patientEntryId: z.string().uuid('Invalid patient entry ID'),
  fieldId: z.string().transform(val => parseInt(val)).refine(val => val > 0, 'Field ID must be positive'),
  choiceId: z.string().transform(val => parseInt(val)).optional(),
  textValue: z.string().max(1000, 'Text value cannot exceed 1000 characters').optional(),
  numberValue: z.number().optional(),
  checkboxValue: z.boolean().optional(),
}).refine(data => {
  // At least one value type should be provided
  return data.choiceId !== undefined || 
         data.textValue !== undefined || 
         data.numberValue !== undefined || 
         data.checkboxValue !== undefined;
}, {
  message: 'At least one value (choiceId, textValue, numberValue, or checkboxValue) must be provided'
});

const bulkFieldValuesSchema = z.array(customFieldValueSchema);

/**
 * @route GET /api/custom-fields/active
 * @desc Get all active custom fields with their choices
 * @access Private
 */
router.get('/active', authMiddleware, async (req, res) => {
  try {
    const fields = await customFieldRepo.findActiveOrdered();
    
    // Fetch choices for each field
    const fieldsWithChoices = await Promise.all(
      fields.map(async (field) => {
        if (field.fieldType === 'dropdown') {
          const choices = await fieldChoiceRepo.findByFieldId(field.id);
          return { ...field, choices };
        }
        return { ...field, choices: [] };
      })
    );

    const response: ApiResponse<typeof fieldsWithChoices> = {
      success: true,
      data: fieldsWithChoices,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching active custom fields:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_FIELDS_ERROR',
        message: 'Failed to retrieve custom fields',
        details: error instanceof Error ? { message: error.message } : undefined
      },
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/custom-fields/:fieldId/choices
 * @desc Get choices for a specific custom field
 * @access Private
 */
router.get('/:fieldId/choices', authMiddleware, async (req, res) => {
  try {
    const fieldId = parseInt(req.params.fieldId);
    if (isNaN(fieldId) || fieldId <= 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FIELD_ID',
          message: 'Field ID must be a positive number'
        },
        timestamp: new Date().toISOString()
      });
    }

    // Verify field exists
    const field = await customFieldRepo.findById(fieldId);
    if (!field) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'FIELD_NOT_FOUND',
          message: 'Custom field not found'
        },
        timestamp: new Date().toISOString()
      });
    }

    const choices = await fieldChoiceRepo.findByFieldId(fieldId);

    const response: ApiResponse<typeof choices> = {
      success: true,
      data: choices,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching field choices:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_CHOICES_ERROR',
        message: 'Failed to retrieve field choices',
        details: error instanceof Error ? { message: error.message } : undefined
      },
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/custom-fields/values/:patientEntryId
 * @desc Get custom field values for a specific patient entry
 * @access Private
 */
router.get('/values/:patientEntryId', authMiddleware, async (req, res) => {
  try {
    const { patientEntryId } = req.params;
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(patientEntryId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PATIENT_ENTRY_ID',
          message: 'Patient entry ID must be a valid UUID'
        },
        timestamp: new Date().toISOString()
      });
    }

    // For now, return empty array since CustomFieldValueRepository is not yet implemented
    // This will be implemented when the full custom field value system is ready
    const response: ApiResponse<any[]> = {
      success: true,
      data: [],
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching custom field values:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_VALUES_ERROR',
        message: 'Failed to retrieve custom field values',
        details: error instanceof Error ? { message: error.message } : undefined
      },
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route POST /api/custom-fields/values/:patientEntryId
 * @desc Save custom field values for a patient entry
 * @access Private
 */
router.post('/values/:patientEntryId',
  authMiddleware,
  validateRequest(bulkFieldValuesSchema),
  async (req, res) => {
    try {
      const { patientEntryId } = req.params;
      const fieldValues = req.body;

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(patientEntryId)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PATIENT_ENTRY_ID',
            message: 'Patient entry ID must be a valid UUID'
          },
          timestamp: new Date().toISOString()
        });
      }

      // For now, return success without actually saving
      // This will be implemented when the CustomFieldValueRepository is ready
      console.log(`Would save ${fieldValues.length} custom field values for patient entry ${patientEntryId}`);

      const response: ApiResponse<any[]> = {
        success: true,
        data: [],
        timestamp: new Date().toISOString()
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Error saving custom field values:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SAVE_VALUES_ERROR',
          message: 'Failed to save custom field values',
          details: error instanceof Error ? { message: error.message } : undefined
        },
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * @route PUT /api/custom-fields/values/update/:valueId
 * @desc Update a specific custom field value
 * @access Private
 */
router.put('/values/update/:valueId', authMiddleware, async (req, res) => {
  try {
    const { valueId } = req.params;
    
    // For now, return success without actually updating
    // This will be implemented when the CustomFieldValueRepository is ready
    const response: ApiResponse<any> = {
      success: true,
      data: { id: valueId, updated: true },
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('Error updating custom field value:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_VALUE_ERROR',
        message: 'Failed to update custom field value',
        details: error instanceof Error ? { message: error.message } : undefined
      },
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route DELETE /api/custom-fields/values/:patientEntryId
 * @desc Delete custom field values for a patient entry
 * @access Private
 */
router.delete('/values/:patientEntryId', authMiddleware, async (req, res) => {
  try {
    const { patientEntryId } = req.params;
    
    // For now, return success without actually deleting
    // This will be implemented when the CustomFieldValueRepository is ready
    const response: ApiResponse<void> = {
      success: true,
      data: undefined as any,
      timestamp: new Date().toISOString()
    };

    res.status(204).json(response);
  } catch (error) {
    console.error('Error deleting custom field values:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_VALUES_ERROR',
        message: 'Failed to delete custom field values',
        details: error instanceof Error ? { message: error.message } : undefined
      },
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/custom-fields/stats
 * @desc Get custom field usage statistics (admin only)
 * @access Private (Admin)
 */
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Admin access required'
        },
        timestamp: new Date().toISOString()
      });
    }

    const fieldsWithStats = customFieldRepo.findWithStats();

    const response: ApiResponse<typeof fieldsWithStats> = {
      success: true,
      data: fieldsWithStats,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching field statistics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_STATS_ERROR',
        message: 'Failed to retrieve field statistics',
        details: error instanceof Error ? { message: error.message } : undefined
      },
      timestamp: new Date().toISOString()
    });
  }
});

export { router as customFieldRoutes };