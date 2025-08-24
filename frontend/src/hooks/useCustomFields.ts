// Custom fields hook following documented React 18 patterns
import { useState, useEffect, useCallback } from 'react';
import { customFieldApi, CustomFieldWithChoices } from '../services/customFieldApi';
import { CustomFieldValue } from '../types';
import { useToast } from './useToast';

interface UseCustomFieldsOptions {
  loadOnMount?: boolean;
  patientEntryId?: string;
}

interface UseCustomFieldsReturn {
  fields: CustomFieldWithChoices[];
  values: Record<string, CustomFieldValue>;
  isLoading: boolean;
  error: string | null;
  refreshFields: () => Promise<void>;
  loadFieldValues: (patientEntryId: string) => Promise<void>;
  saveFieldValues: (patientEntryId: string, values: Record<string, any>) => Promise<void>;
  clearValues: () => void;
}

export function useCustomFields({
  loadOnMount = true,
  patientEntryId
}: UseCustomFieldsOptions = {}): UseCustomFieldsReturn {
  const [fields, setFields] = useState<CustomFieldWithChoices[]>([]);
  const [values, setValues] = useState<Record<string, CustomFieldValue>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  // Load active custom fields
  const refreshFields = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await customFieldApi.getActiveFields();
      
      if (response.success) {
        setFields(response.data);
      } else {
        throw new Error(response.error.message);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load custom fields';
      setError(errorMessage);
      console.error('Error loading custom fields:', err);
      
      showToast({
        type: 'error',
        message: `Custom fields error: ${errorMessage}`,
      });
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  // Load field values for a specific patient entry
  const loadFieldValues = useCallback(async (entryId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await customFieldApi.getFieldValues(entryId);
      
      if (response.success) {
        // Convert array to record keyed by fieldId
        const valuesRecord: Record<string, CustomFieldValue> = {};
        response.data.forEach(value => {
          valuesRecord[value.fieldId] = value;
        });
        setValues(valuesRecord);
      } else {
        throw new Error(response.error.message);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load field values';
      setError(errorMessage);
      console.error('Error loading field values:', err);
      
      showToast({
        type: 'error',
        message: `Field values error: ${errorMessage}`,
      });
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  // Save field values for a patient entry
  const saveFieldValues = useCallback(async (
    entryId: string, 
    formValues: Record<string, any>
  ) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Convert form values to API format
      const fieldValuesToSave = Object.entries(formValues).map(([fieldId, value]) => {
        const field = fields.find(f => f.id === fieldId);
        if (!field) return null;

        const baseValue = {
          patientEntryId: entryId,
          fieldId: fieldId,
        };

        switch (field.fieldType) {
          case 'dropdown':
            return { ...baseValue, choiceId: value };
          case 'text':
            return { ...baseValue, textValue: value };
          case 'number':
            return { ...baseValue, numberValue: Number(value) };
          case 'checkbox':
            return { ...baseValue, checkboxValue: Boolean(value) };
          default:
            return null;
        }
      }).filter(Boolean);

      const response = await customFieldApi.saveFieldValues(entryId, fieldValuesToSave as any[]);
      
      if (response.success) {
        // Update local values state
        const valuesRecord: Record<string, CustomFieldValue> = {};
        response.data.forEach(value => {
          valuesRecord[value.fieldId] = value;
        });
        setValues(valuesRecord);
        
        showToast({
          type: 'success',
          message: 'Custom field values saved successfully',
        });
      } else {
        throw new Error(response.error.message);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save field values';
      setError(errorMessage);
      console.error('Error saving field values:', err);
      
      showToast({
        type: 'error',
        message: `Save failed: ${errorMessage}`,
      });
      throw err; // Re-throw so form can handle the error
    } finally {
      setIsLoading(false);
    }
  }, [fields, showToast]);

  // Clear all field values from state
  const clearValues = useCallback(() => {
    setValues({});
  }, []);

  // Load fields on mount if requested
  useEffect(() => {
    if (loadOnMount) {
      refreshFields();
    }
  }, [loadOnMount]); // Remove refreshFields from dependencies to prevent infinite loop

  // Load values for patient entry if provided
  useEffect(() => {
    if (patientEntryId && fields.length > 0) {
      loadFieldValues(patientEntryId);
    }
  }, [patientEntryId, fields.length, loadFieldValues]);

  return {
    fields,
    values,
    isLoading,
    error,
    refreshFields,
    loadFieldValues,
    saveFieldValues,
    clearValues,
  };
}

// Helper hook for getting field choices
export function useFieldChoices(fieldId: string) {
  const [choices, setChoices] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fieldId) return;

    const loadChoices = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await customFieldApi.getFieldChoices(fieldId);
        
        if (response.success) {
          setChoices(response.data);
        } else {
          throw new Error(response.error.message);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load choices';
        setError(errorMessage);
        console.error('Error loading field choices:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadChoices();
  }, [fieldId]);

  return { choices, isLoading, error };
}