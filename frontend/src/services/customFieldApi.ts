// Custom Field API service following documented patterns
import { apiService } from './apiService';
import { ApiResponse, CustomField, FieldChoice, CustomFieldValue } from '../types';

export interface CustomFieldWithChoices extends CustomField {
  choices?: FieldChoice[];
}

export interface CustomFieldValueCreateRequest {
  patientEntryId: string;
  fieldId: string;
  choiceId?: string;
  textValue?: string;
  numberValue?: number;
  checkboxValue?: boolean;
}

class CustomFieldApiService {
  private readonly baseUrl = '/custom-fields';

  /**
   * Get all active custom fields ordered by field order
   */
  async getActiveFields(): Promise<ApiResponse<CustomFieldWithChoices[]>> {
    try {
      const response = await apiService.get<CustomFieldWithChoices[]>(`${this.baseUrl}/active`);
      
      if (response.success) {
        // Ensure choices are sorted by choice order
        const fieldsWithSortedChoices = response.data.map(field => ({
          ...field,
          choices: field.choices?.sort((a, b) => a.choiceOrder - b.choiceOrder) || []
        }));
        
        return {
          success: true,
          data: fieldsWithSortedChoices,
          timestamp: response.timestamp
        };
      }
      
      return response;
    } catch (error) {
      console.error('Failed to fetch custom fields:', error);
      throw error;
    }
  }

  /**
   * Get custom field values for a specific patient entry
   */
  async getFieldValues(patientEntryId: string): Promise<ApiResponse<CustomFieldValue[]>> {
    try {
      return await apiService.get<CustomFieldValue[]>(`${this.baseUrl}/values/${patientEntryId}`);
    } catch (error) {
      console.error('Failed to fetch custom field values:', error);
      throw error;
    }
  }

  /**
   * Save custom field values for a patient entry
   */
  async saveFieldValues(
    patientEntryId: string,
    values: CustomFieldValueCreateRequest[]
  ): Promise<ApiResponse<CustomFieldValue[]>> {
    try {
      return await apiService.post<CustomFieldValueCreateRequest[], CustomFieldValue[]>(
        `${this.baseUrl}/values/${patientEntryId}`,
        values
      );
    } catch (error) {
      console.error('Failed to save custom field values:', error);
      throw error;
    }
  }

  /**
   * Update a specific custom field value
   */
  async updateFieldValue(
    valueId: string,
    updates: Partial<CustomFieldValueCreateRequest>
  ): Promise<ApiResponse<CustomFieldValue>> {
    try {
      return await apiService.put<Partial<CustomFieldValueCreateRequest>, CustomFieldValue>(
        `${this.baseUrl}/values/update/${valueId}`,
        updates
      );
    } catch (error) {
      console.error('Failed to update custom field value:', error);
      throw error;
    }
  }

  /**
   * Delete custom field values for a patient entry
   */
  async deleteFieldValues(patientEntryId: string): Promise<ApiResponse<void>> {
    try {
      return await apiService.delete(`${this.baseUrl}/values/${patientEntryId}`);
    } catch (error) {
      console.error('Failed to delete custom field values:', error);
      throw error;
    }
  }

  /**
   * Get choices for a specific custom field
   */
  async getFieldChoices(fieldId: string): Promise<ApiResponse<FieldChoice[]>> {
    try {
      const response = await apiService.get<FieldChoice[]>(`${this.baseUrl}/${fieldId}/choices`);
      
      if (response.success) {
        // Sort choices by order
        const sortedChoices = response.data.sort((a, b) => a.choiceOrder - b.choiceOrder);
        return {
          success: true,
          data: sortedChoices,
          timestamp: response.timestamp
        };
      }
      
      return response;
    } catch (error) {
      console.error('Failed to fetch field choices:', error);
      throw error;
    }
  }

  /**
   * Get field usage statistics (for admin purposes)
   */
  async getFieldStats(): Promise<ApiResponse<Array<CustomField & { usageCount: number }>>> {
    try {
      return await apiService.get<Array<CustomField & { usageCount: number }>>(
        `${this.baseUrl}/stats`
      );
    } catch (error) {
      console.error('Failed to fetch field statistics:', error);
      throw error;
    }
  }

  /**
   * Get form configuration (fields) for a specific client
   * Returns both global fields and client-specific fields
   */
  async getFormConfig(clientId: string): Promise<ApiResponse<CustomFieldWithChoices[]>> {
    try {
      const response = await apiService.get<CustomFieldWithChoices[]>(`/form-config/${clientId}`);
      
      if (response.success) {
        // Ensure choices are sorted by choice order
        const fieldsWithSortedChoices = response.data.map(field => ({
          ...field,
          choices: field.choices?.sort((a, b) => a.choiceOrder - b.choiceOrder) || []
        }));
        
        return {
          success: true,
          data: fieldsWithSortedChoices,
          timestamp: response.timestamp
        };
      }
      
      return response;
    } catch (error) {
      console.error('Failed to fetch form configuration:', error);
      throw error;
    }
  }

  /**
   * Get client-specific fields for admin management
   */
  async getClientFields(clientId: string): Promise<ApiResponse<CustomFieldWithChoices[]>> {
    try {
      const response = await apiService.get<CustomFieldWithChoices[]>(`/admin/clients/${clientId}/fields`);
      
      if (response.success) {
        // Ensure choices are sorted by choice order
        const fieldsWithSortedChoices = response.data.map(field => ({
          ...field,
          choices: field.choices?.sort((a, b) => a.choiceOrder - b.choiceOrder) || []
        }));
        
        return {
          success: true,
          data: fieldsWithSortedChoices,
          timestamp: response.timestamp
        };
      }
      
      return response;
    } catch (error) {
      console.error('Failed to fetch client fields:', error);
      throw error;
    }
  }

  /**
   * Create a client-specific field
   */
  async createClientField(
    clientId: string, 
    fieldData: Omit<CustomField, 'id' | 'isActive'> & { choices?: Omit<FieldChoice, 'id' | 'fieldId'>[] }
  ): Promise<ApiResponse<CustomFieldWithChoices>> {
    try {
      return await apiService.post<typeof fieldData, CustomFieldWithChoices>(
        `/admin/clients/${clientId}/fields`,
        fieldData
      );
    } catch (error) {
      console.error('Failed to create client field:', error);
      throw error;
    }
  }

  /**
   * Update a client-specific field
   */
  async updateClientField(
    clientId: string,
    fieldId: string,
    updates: Partial<CustomField> & { choices?: Omit<FieldChoice, 'fieldId'>[] }
  ): Promise<ApiResponse<CustomFieldWithChoices>> {
    try {
      return await apiService.put<typeof updates, CustomFieldWithChoices>(
        `/admin/clients/${clientId}/fields/${fieldId}`,
        updates
      );
    } catch (error) {
      console.error('Failed to update client field:', error);
      throw error;
    }
  }

  /**
   * Delete a client-specific field
   */
  async deleteClientField(clientId: string, fieldId: string): Promise<ApiResponse<void>> {
    try {
      return await apiService.delete(`/admin/clients/${clientId}/fields/${fieldId}`);
    } catch (error) {
      console.error('Failed to delete client field:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export const customFieldApi = new CustomFieldApiService();

// Export types for external use
export type { CustomFieldWithChoices, CustomFieldValueCreateRequest };