// Client-aware custom fields hook following documented React 18 patterns
import { useState, useEffect, useCallback } from 'react';
import { customFieldApi, CustomFieldWithChoices } from '../services/customFieldApi';
import { useToast } from './useToast';

interface UseClientCustomFieldsOptions {
  clientId?: string;
  loadOnMount?: boolean;
}

interface UseClientCustomFieldsReturn {
  fields: CustomFieldWithChoices[];
  isLoading: boolean;
  error: string | null;
  refreshFields: () => Promise<void>;
}

export function useClientCustomFields({
  clientId,
  loadOnMount = true
}: UseClientCustomFieldsOptions = {}): UseClientCustomFieldsReturn {
  const [fields, setFields] = useState<CustomFieldWithChoices[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  // Load fields for the selected client
  const refreshFields = useCallback(async () => {
    if (!clientId) {
      setFields([]);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const response = await customFieldApi.getFormConfig(clientId);
      
      if (response.success) {
        setFields(response.data);
      } else {
        throw new Error(response.error.message);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load client fields';
      setError(errorMessage);
      console.error('Error loading client custom fields:', err);
      
      // Show toast without including showToast in dependencies to prevent infinite loop
      showToast({
        type: 'error',
        message: `Client fields error: ${errorMessage}`,
      });
    } finally {
      setIsLoading(false);
    }
  }, [clientId]); // Removed showToast dependency

  // Load fields when client changes
  useEffect(() => {
    if (loadOnMount && clientId) {
      refreshFields();
    } else if (!clientId) {
      setFields([]);
      setError(null);
    }
  }, [clientId, loadOnMount, refreshFields]);

  return {
    fields,
    isLoading,
    error,
    refreshFields,
  };
}

// Hook for admin management of client fields
interface UseClientFieldManagementOptions {
  clientId?: string;
}

interface UseClientFieldManagementReturn {
  fields: CustomFieldWithChoices[];
  isLoading: boolean;
  error: string | null;
  refreshFields: () => Promise<void>;
  createField: (fieldData: any) => Promise<void>;
  updateField: (fieldId: string, updates: any) => Promise<void>;
  deleteField: (fieldId: string) => Promise<void>;
}

export function useClientFieldManagement({
  clientId
}: UseClientFieldManagementOptions = {}): UseClientFieldManagementReturn {
  const [fields, setFields] = useState<CustomFieldWithChoices[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  // Load client-specific fields for management
  const refreshFields = useCallback(async () => {
    if (!clientId) {
      setFields([]);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const response = await customFieldApi.getClientFields(clientId);
      
      if (response.success) {
        setFields(response.data);
      } else {
        throw new Error(response.error.message);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load client fields';
      setError(errorMessage);
      console.error('Error loading client fields for management:', err);
      
      // Show toast without including showToast in dependencies to prevent infinite loop
      showToast({
        type: 'error',
        message: `Failed to load fields: ${errorMessage}`,
      });
    } finally {
      setIsLoading(false);
    }
  }, [clientId]); // Removed showToast dependency

  // Create new client field
  const createField = useCallback(async (fieldData: any) => {
    if (!clientId) {
      throw new Error('Client ID is required to create field');
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const response = await customFieldApi.createClientField(clientId, fieldData);
      
      if (response.success) {
        await refreshFields(); // Refresh the list
        showToast({
          type: 'success',
          message: 'Field created successfully',
        });
      } else {
        throw new Error(response.error.message);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create field';
      setError(errorMessage);
      
      showToast({
        type: 'error',
        message: `Failed to create field: ${errorMessage}`,
      });
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [clientId]); // Removed refreshFields and showToast to prevent circular deps

  // Update client field
  const updateField = useCallback(async (fieldId: string, updates: any) => {
    if (!clientId) {
      throw new Error('Client ID is required to update field');
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const response = await customFieldApi.updateClientField(clientId, fieldId, updates);
      
      if (response.success) {
        await refreshFields(); // Refresh the list
        showToast({
          type: 'success',
          message: 'Field updated successfully',
        });
      } else {
        throw new Error(response.error.message);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update field';
      setError(errorMessage);
      
      showToast({
        type: 'error',
        message: `Failed to update field: ${errorMessage}`,
      });
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [clientId]); // Removed refreshFields and showToast to prevent circular deps

  // Delete client field
  const deleteField = useCallback(async (fieldId: string) => {
    if (!clientId) {
      throw new Error('Client ID is required to delete field');
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const response = await customFieldApi.deleteClientField(clientId, fieldId);
      
      if (response.success) {
        await refreshFields(); // Refresh the list
        showToast({
          type: 'success',
          message: 'Field deleted successfully',
        });
      } else {
        throw new Error(response.error.message);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete field';
      setError(errorMessage);
      
      showToast({
        type: 'error',
        message: `Failed to delete field: ${errorMessage}`,
      });
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [clientId]); // Removed refreshFields and showToast to prevent circular deps

  // Load fields when client changes
  useEffect(() => {
    if (clientId) {
      refreshFields();
    } else {
      setFields([]);
      setError(null);
    }
  }, [clientId, refreshFields]);

  return {
    fields,
    isLoading,
    error,
    refreshFields,
    createField,
    updateField,
    deleteField,
  };
}