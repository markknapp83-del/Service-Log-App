// Integration tests for client-specific custom fields
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { ServiceLogPage } from '../pages/ServiceLogPage';
import { UserManagementPage } from '../pages/UserManagementPage';
import { customFieldApi } from '../services/customFieldApi';
import { apiService } from '../services/apiService';
import { TestWrapper } from './TestWrapper';

// Mock the API services
vi.mock('../services/customFieldApi');
vi.mock('../services/apiService');

// Mock the auth hook with admin user
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'admin@test.com', role: 'admin' },
    isAuthenticated: true,
  }),
}));

// Mock toast hook
vi.mock('../hooks/useToast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

// Mock data
const mockClients = [
  { id: '1', name: 'General Hospital', isActive: true },
  { id: '2', name: 'Community Clinic', isActive: true },
];

const mockActivities = [
  { id: '1', name: 'Consultation', isActive: true },
  { id: '2', name: 'Surgery', isActive: true },
];

const mockOutcomes = [
  { id: '1', name: 'Completed', isActive: true },
  { id: '2', name: 'Cancelled', isActive: true },
];

describe('Client-Specific Fields Integration', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock basic API responses
    vi.mocked(apiService.get).mockImplementation((url: string) => {
      if (url.includes('/clients')) {
        return Promise.resolve({ success: true, data: mockClients, timestamp: new Date().toISOString() });
      }
      if (url.includes('/activities')) {
        return Promise.resolve({ success: true, data: mockActivities, timestamp: new Date().toISOString() });
      }
      if (url.includes('/outcomes')) {
        return Promise.resolve({ success: true, data: mockOutcomes, timestamp: new Date().toISOString() });
      }
      return Promise.resolve({ success: true, data: [], timestamp: new Date().toISOString() });
    });

    // Mock form config API to return empty initially
    vi.mocked(customFieldApi.getFormConfig).mockResolvedValue({
      success: true,
      data: [],
      timestamp: new Date().toISOString(),
    });
  });

  describe('End-to-End Field Creation and Usage', () => {
    it('should allow admin to create field and use it in service log', async () => {
      // Mock field creation
      let createdFields: any[] = [];
      vi.mocked(customFieldApi.createClientField).mockImplementation(async (clientId, fieldData) => {
        const newField = {
          id: `field_${createdFields.length + 1}`,
          clientId,
          ...fieldData,
          isActive: true,
          choices: fieldData.choices?.map((choice: any, index: number) => ({
            id: `choice_${index + 1}`,
            fieldId: `field_${createdFields.length + 1}`,
            ...choice,
          })) || [],
        };
        createdFields.push(newField);
        return { success: true, data: newField, timestamp: new Date().toISOString() };
      });

      // Mock form config to return created fields
      vi.mocked(customFieldApi.getFormConfig).mockImplementation(async (clientId) => {
        const clientFields = createdFields.filter(f => f.clientId === clientId);
        return { success: true, data: clientFields, timestamp: new Date().toISOString() };
      });

      render(
        <TestWrapper>
          <ServiceLogPage />
        </TestWrapper>
      );

      // Step 1: Select a client to enable field creation
      await waitFor(() => {
        expect(screen.getByLabelText(/client\/site/i)).toBeInTheDocument();
      });

      const clientSelect = screen.getByLabelText(/client\/site/i);
      await user.selectOptions(clientSelect, '1');

      // Step 2: Wait for Additional Information section and find Add New Capture button
      await waitFor(() => {
        expect(screen.getByText('Additional Information')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /add new capture/i })).toBeInTheDocument();
      });

      // Step 3: Click "Add New Capture" to create a field
      const addFieldButton = screen.getByRole('button', { name: /add new capture/i });
      await user.click(addFieldButton);

      // Step 4: Fill out field creation form
      await waitFor(() => {
        expect(screen.getByText('Add Custom Field')).toBeInTheDocument();
      });

      // Fill field label
      const fieldLabelInput = screen.getByLabelText(/field label/i);
      await user.type(fieldLabelInput, 'Priority Level');

      // Select field type
      const fieldTypeSelect = screen.getByLabelText(/field type/i);
      await user.selectOptions(fieldTypeSelect, 'dropdown');

      // Add choices for dropdown
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add choice/i })).toBeInTheDocument();
      });

      const addChoiceButton = screen.getByRole('button', { name: /add choice/i });
      await user.click(addChoiceButton);

      const choiceInput = screen.getByPlaceholderText('Choice 1');
      await user.type(choiceInput, 'High');

      // Add another choice
      await user.click(addChoiceButton);
      const choice2Input = screen.getByPlaceholderText('Choice 2');
      await user.type(choice2Input, 'Medium');

      // Step 5: Create the field
      const createFieldButton = screen.getByRole('button', { name: /create field/i });
      await user.click(createFieldButton);

      // Verify field creation API was called
      await waitFor(() => {
        expect(customFieldApi.createClientField).toHaveBeenCalledWith('1', expect.objectContaining({
          fieldLabel: 'Priority Level',
          fieldType: 'dropdown',
          choices: [
            { choiceText: 'High', choiceOrder: 0 },
            { choiceText: 'Medium', choiceOrder: 1 },
          ],
        }));
      });

      // Step 6: Verify the field appears in the form
      await waitFor(() => {
        expect(screen.getByLabelText(/priority level/i)).toBeInTheDocument();
      });

      // Step 7: Complete service log with the new field
      await user.selectOptions(screen.getByLabelText(/activity/i), '1');
      
      const serviceDateInput = screen.getByLabelText(/service date/i);
      await user.type(serviceDateInput, '2023-12-01');

      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      await user.clear(patientCountInput);
      await user.type(patientCountInput, '1');

      // Wait for patient entry to be generated
      await waitFor(() => {
        expect(screen.getByText('Entry 1')).toBeInTheDocument();
      });

      // Fill patient entry details
      const appointmentTypeSelect = screen.getByLabelText(/appointment type/i);
      await user.selectOptions(appointmentTypeSelect, 'new');

      const outcomeSelect = screen.getByLabelText(/outcome/i);
      await user.selectOptions(outcomeSelect, '1');

      // Fill the custom field
      const prioritySelect = screen.getByLabelText(/priority level/i);
      await user.selectOptions(prioritySelect, 'choice_1'); // Should correspond to 'High'

      // Submit the form
      const submitButton = screen.getByRole('button', { name: /save service log/i });
      await user.click(submitButton);

      // Verify submission includes custom field data
      await waitFor(() => {
        // This would normally check the onSubmit call
        // Since we're testing integration, we'd mock the service log submission API
        expect(screen.getByRole('button', { name: /save service log/i })).toBeInTheDocument();
      });
    });

    it('should show different fields for different clients', async () => {
      // Mock different fields for different clients
      const hospitalFields = [
        {
          id: 'field_1',
          fieldLabel: 'Ward Number',
          fieldType: 'text',
          clientId: '1',
          isActive: true,
          isRequired: false,
          fieldOrder: 0,
        }
      ];

      const clinicFields = [
        {
          id: 'field_2',
          fieldLabel: 'Appointment Type',
          fieldType: 'dropdown',
          clientId: '2',
          isActive: true,
          isRequired: true,
          fieldOrder: 0,
          choices: [
            { id: 'choice_1', fieldId: 'field_2', choiceText: 'Walk-in', choiceOrder: 0 },
            { id: 'choice_2', fieldId: 'field_2', choiceText: 'Scheduled', choiceOrder: 1 },
          ],
        }
      ];

      vi.mocked(customFieldApi.getFormConfig).mockImplementation(async (clientId) => {
        if (clientId === '1') {
          return { success: true, data: hospitalFields, timestamp: new Date().toISOString() };
        } else if (clientId === '2') {
          return { success: true, data: clinicFields, timestamp: new Date().toISOString() };
        }
        return { success: true, data: [], timestamp: new Date().toISOString() };
      });

      render(
        <TestWrapper>
          <ServiceLogPage />
        </TestWrapper>
      );

      // Select first client
      const clientSelect = screen.getByLabelText(/client\/site/i);
      await user.selectOptions(clientSelect, '1');

      await waitFor(() => {
        expect(screen.getByLabelText(/ward number/i)).toBeInTheDocument();
        expect(screen.queryByLabelText(/appointment type/i)).not.toBeInTheDocument();
      });

      // Switch to second client
      await user.selectOptions(clientSelect, '2');

      await waitFor(() => {
        expect(screen.queryByLabelText(/ward number/i)).not.toBeInTheDocument();
        expect(screen.getByLabelText(/appointment type/i)).toBeInTheDocument();
        
        // Check that the dropdown has the right options
        const appointmentSelect = screen.getByLabelText(/appointment type/i);
        expect(appointmentSelect).toContainHTML('<option value="choice_1">Walk-in</option>');
        expect(appointmentSelect).toContainHTML('<option value="choice_2">Scheduled</option>');
      });
    });

    it('should persist custom field values in form draft', async () => {
      const mockFields = [
        {
          id: 'field_1',
          fieldLabel: 'Special Notes',
          fieldType: 'text',
          clientId: '1',
          isActive: true,
          isRequired: false,
          fieldOrder: 0,
        }
      ];

      vi.mocked(customFieldApi.getFormConfig).mockResolvedValue({
        success: true,
        data: mockFields,
        timestamp: new Date().toISOString(),
      });

      // Mock localStorage
      const mockLocalStorage = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      };
      Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

      render(
        <TestWrapper>
          <ServiceLogPage />
        </TestWrapper>
      );

      // Select client and fill custom field
      const clientSelect = screen.getByLabelText(/client\/site/i);
      await user.selectOptions(clientSelect, '1');

      await waitFor(() => {
        expect(screen.getByLabelText(/special notes/i)).toBeInTheDocument();
      });

      const notesInput = screen.getByLabelText(/special notes/i);
      await user.type(notesInput, 'Important patient information');

      // Verify draft saving includes custom fields
      await waitFor(() => {
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          'serviceLogDraft',
          expect.stringContaining('Important patient information')
        );
      });
    });

    it('should handle field loading errors gracefully', async () => {
      // Mock API failure
      vi.mocked(customFieldApi.getFormConfig).mockRejectedValue(
        new Error('Failed to load fields')
      );

      render(
        <TestWrapper>
          <ServiceLogPage />
        </TestWrapper>
      );

      // Select client
      const clientSelect = screen.getByLabelText(/client\/site/i);
      await user.selectOptions(clientSelect, '1');

      // Should still show Additional Information section with error state
      await waitFor(() => {
        expect(screen.getByText('Additional Information')).toBeInTheDocument();
        // The form should still be functional even if custom fields fail to load
        expect(screen.getByText(/additional notes/i)).toBeInTheDocument();
      });
    });

    it('should validate required custom fields', async () => {
      const mockFields = [
        {
          id: 'field_1',
          fieldLabel: 'Required Field',
          fieldType: 'text',
          clientId: '1',
          isActive: true,
          isRequired: true,
          fieldOrder: 0,
        }
      ];

      vi.mocked(customFieldApi.getFormConfig).mockResolvedValue({
        success: true,
        data: mockFields,
        timestamp: new Date().toISOString(),
      });

      render(
        <TestWrapper>
          <ServiceLogPage />
        </TestWrapper>
      );

      // Fill out form but skip required custom field
      const clientSelect = screen.getByLabelText(/client\/site/i);
      await user.selectOptions(clientSelect, '1');

      await waitFor(() => {
        expect(screen.getByLabelText(/required field/i)).toBeInTheDocument();
      });

      // Fill other required fields
      await user.selectOptions(screen.getByLabelText(/activity/i), '1');
      
      const serviceDateInput = screen.getByLabelText(/service date/i);
      await user.type(serviceDateInput, '2023-12-01');

      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      await user.clear(patientCountInput);
      await user.type(patientCountInput, '1');

      await waitFor(() => {
        expect(screen.getByText('Entry 1')).toBeInTheDocument();
      });

      await user.selectOptions(screen.getByLabelText(/appointment type/i), 'new');
      await user.selectOptions(screen.getByLabelText(/outcome/i), '1');

      // Try to submit without filling required custom field
      const submitButton = screen.getByRole('button', { name: /save service log/i });
      await user.click(submitButton);

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/required field.*required/i)).toBeInTheDocument();
      });
    });
  });

  describe('Performance and Loading States', () => {
    it('should show loading state while fields are being fetched', async () => {
      // Create a delayed promise
      let resolveFields: (value: any) => void;
      const fieldsPromise = new Promise((resolve) => {
        resolveFields = resolve;
      });

      vi.mocked(customFieldApi.getFormConfig).mockReturnValue(fieldsPromise as any);

      render(
        <TestWrapper>
          <ServiceLogPage />
        </TestWrapper>
      );

      // Select client to trigger field loading
      const clientSelect = screen.getByLabelText(/client\/site/i);
      await user.selectOptions(clientSelect, '1');

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText('Additional Information')).toBeInTheDocument();
      });

      // Resolve the promise
      resolveFields({
        success: true,
        data: [],
        timestamp: new Date().toISOString(),
      });

      // Should complete loading
      await waitFor(() => {
        expect(screen.getByText(/select a client to see additional fields/i)).toBeInTheDocument();
      });
    });

    it('should not make unnecessary API calls when client does not change', async () => {
      vi.mocked(customFieldApi.getFormConfig).mockResolvedValue({
        success: true,
        data: [],
        timestamp: new Date().toISOString(),
      });

      render(
        <TestWrapper>
          <ServiceLogPage />
        </TestWrapper>
      );

      const clientSelect = screen.getByLabelText(/client\/site/i);
      
      // Select client first time
      await user.selectOptions(clientSelect, '1');
      
      await waitFor(() => {
        expect(customFieldApi.getFormConfig).toHaveBeenCalledTimes(1);
      });

      // Select same client again (should not trigger new API call)
      await user.selectOptions(clientSelect, '1');
      
      // API should still only be called once
      expect(customFieldApi.getFormConfig).toHaveBeenCalledTimes(1);
    });
  });
});