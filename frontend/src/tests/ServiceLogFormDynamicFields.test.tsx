// Service Log Form with Dynamic Fields integration tests following documented React Testing Library patterns
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ServiceLogForm } from '../components/ServiceLogForm';
import { useCustomFields } from '../hooks/useCustomFields';
import { useToast } from '../hooks/useToast';
import { Client, Activity, Outcome, CustomField, FieldChoice, CustomFieldValue } from '../types';
import { CustomFieldWithChoices } from '../services/customFieldApi';
import { createMockApiResponse } from './setup';

expect.extend(toHaveNoViolations);

// Mock dependencies
jest.mock('../hooks/useCustomFields');
jest.mock('../hooks/useToast');

const mockUseCustomFields = jest.mocked(useCustomFields);
const mockUseToast = jest.mocked(useToast);

// Healthcare-specific mock data following documented patterns
const mockClients: Client[] = [
  {
    id: 'client-1',
    name: 'Main Hospital',
    isActive: true,
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
  },
  {
    id: 'client-2',
    name: 'Community Clinic',
    isActive: true,
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
  },
];

const mockActivities: Activity[] = [
  {
    id: 'activity-1',
    name: 'General Consultation',
    isActive: true,
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
  },
  {
    id: 'activity-2',
    name: 'Cardiology',
    isActive: true,
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
  },
];

const mockOutcomes: Outcome[] = [
  {
    id: 'outcome-1',
    name: 'Treatment Completed',
    isActive: true,
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
  },
  {
    id: 'outcome-2',
    name: 'Referred to Specialist',
    isActive: true,
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
  },
];

// Mock custom fields with healthcare-specific data
const mockCustomFields: CustomFieldWithChoices[] = [
  {
    id: 'field-risk-level',
    fieldLabel: 'Patient Risk Level',
    fieldType: 'dropdown',
    fieldOrder: 1,
    isActive: true,
    choices: [
      { id: 'risk-low', fieldId: 'field-risk-level', choiceText: 'Low Risk', choiceOrder: 1 },
      { id: 'risk-medium', fieldId: 'field-risk-level', choiceText: 'Medium Risk', choiceOrder: 2 },
      { id: 'risk-high', fieldId: 'field-risk-level', choiceText: 'High Risk', choiceOrder: 3 },
    ],
  },
  {
    id: 'field-notes',
    fieldLabel: 'Additional Notes',
    fieldType: 'text',
    fieldOrder: 2,
    isActive: true,
    choices: [],
  },
  {
    id: 'field-age',
    fieldLabel: 'Patient Age',
    fieldType: 'number',
    fieldOrder: 3,
    isActive: true,
    choices: [],
  },
  {
    id: 'field-followup',
    fieldLabel: 'Requires Follow-up Call',
    fieldType: 'checkbox',
    fieldOrder: 4,
    isActive: true,
    choices: [],
  },
  {
    id: 'field-service-detail',
    fieldLabel: 'Service Type Detail',
    fieldType: 'dropdown',
    fieldOrder: 5,
    isActive: true,
    choices: [
      { id: 'service-routine', fieldId: 'field-service-detail', choiceText: 'Routine Check-up', choiceOrder: 1 },
      { id: 'service-urgent', fieldId: 'field-service-detail', choiceText: 'Urgent Care', choiceOrder: 2 },
      { id: 'service-emergency', fieldId: 'field-service-detail', choiceText: 'Emergency', choiceOrder: 3 },
    ],
  },
];

describe('ServiceLogForm Integration with Dynamic Fields', () => {
  const mockShowToast = jest.fn();
  const mockOnSubmit = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseToast.mockReturnValue({ showToast: mockShowToast });
    
    // Default mock for custom fields hook
    mockUseCustomFields.mockReturnValue({
      fields: mockCustomFields,
      values: {},
      isLoading: false,
      error: null,
      refreshFields: jest.fn(),
      loadFieldValues: jest.fn(),
      saveFieldValues: jest.fn(),
      clearValues: jest.fn(),
    });
  });

  const defaultProps = {
    clients: mockClients,
    activities: mockActivities,
    outcomes: mockOutcomes,
    onSubmit: mockOnSubmit,
    onCancel: mockOnCancel,
  };

  describe('Dynamic Fields Display and Integration', () => {
    it('renders service log form with dynamic fields when available', async () => {
      render(<ServiceLogForm {...defaultProps} />);

      // Fill basic form to create patient entries
      await userEvent.type(screen.getByLabelText(/number of patient entries/i), '2');
      
      // Trigger patient entries creation
      fireEvent.blur(screen.getByLabelText(/number of patient entries/i));

      await waitFor(() => {
        // Check that patient entries are created
        expect(screen.getByText('Entry 1')).toBeInTheDocument();
        expect(screen.getByText('Entry 2')).toBeInTheDocument();
        
        // Check that dynamic fields section is displayed
        expect(screen.getAllByText('Additional Information')).toHaveLength(2); // One for each entry
        
        // Check that all custom fields are rendered
        expect(screen.getAllByText('Patient Risk Level')).toHaveLength(2);
        expect(screen.getAllByText('Additional Notes')).toHaveLength(2);
        expect(screen.getAllByText('Patient Age')).toHaveLength(2);
        expect(screen.getAllByText('Requires Follow-up Call')).toHaveLength(2);
        expect(screen.getAllByText('Service Type Detail')).toHaveLength(2);
      });
    });

    it('does not display dynamic fields section when no custom fields available', async () => {
      mockUseCustomFields.mockReturnValue({
        fields: [],
        values: {},
        isLoading: false,
        error: null,
        refreshFields: jest.fn(),
        loadFieldValues: jest.fn(),
        saveFieldValues: jest.fn(),
        clearValues: jest.fn(),
      });

      render(<ServiceLogForm {...defaultProps} />);

      await userEvent.type(screen.getByLabelText(/number of patient entries/i), '1');
      fireEvent.blur(screen.getByLabelText(/number of patient entries/i));

      await waitFor(() => {
        expect(screen.getByText('Entry 1')).toBeInTheDocument();
        // Dynamic fields section should not appear
        expect(screen.queryByText('Additional Information')).not.toBeInTheDocument();
      });
    });

    it('displays loading state while custom fields are loading', () => {
      mockUseCustomFields.mockReturnValue({
        fields: [],
        values: {},
        isLoading: true,
        error: null,
        refreshFields: jest.fn(),
        loadFieldValues: jest.fn(),
        saveFieldValues: jest.fn(),
        clearValues: jest.fn(),
      });

      render(<ServiceLogForm {...defaultProps} />);

      // Custom fields loading shouldn't prevent form from rendering
      expect(screen.getByText('Service Log Entry')).toBeInTheDocument();
    });

    it('handles custom fields error gracefully', async () => {
      mockUseCustomFields.mockReturnValue({
        fields: [],
        values: {},
        isLoading: false,
        error: 'Failed to load custom fields',
        refreshFields: jest.fn(),
        loadFieldValues: jest.fn(),
        saveFieldValues: jest.fn(),
        clearValues: jest.fn(),
      });

      render(<ServiceLogForm {...defaultProps} />);

      // Form should still work without custom fields
      expect(screen.getByText('Service Log Entry')).toBeInTheDocument();
      
      await userEvent.type(screen.getByLabelText(/number of patient entries/i), '1');
      fireEvent.blur(screen.getByLabelText(/number of patient entries/i));

      await waitFor(() => {
        expect(screen.getByText('Entry 1')).toBeInTheDocument();
        // No dynamic fields should be shown due to error
        expect(screen.queryByText('Additional Information')).not.toBeInTheDocument();
      });
    });
  });

  describe('Dynamic Field Interactions', () => {
    it('allows user to interact with all dynamic field types', async () => {
      const user = userEvent.setup();
      
      render(<ServiceLogForm {...defaultProps} />);

      // Create a patient entry
      await user.type(screen.getByLabelText(/number of patient entries/i), '1');
      fireEvent.blur(screen.getByLabelText(/number of patient entries/i));

      await waitFor(() => {
        expect(screen.getByText('Entry 1')).toBeInTheDocument();
      });

      // Test dropdown field
      const riskLevelSelect = screen.getByRole('combobox', { name: /patient risk level/i });
      await user.click(riskLevelSelect);
      await waitFor(() => {
        expect(screen.getByText('Medium Risk')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Medium Risk'));

      // Test text field
      const notesInput = screen.getByRole('textbox', { name: /additional notes/i });
      await user.type(notesInput, 'Patient requires special monitoring');

      // Test number field
      const ageInput = screen.getByRole('spinbutton', { name: /patient age/i });
      await user.clear(ageInput);
      await user.type(ageInput, '67');

      // Test checkbox field
      const followupCheckbox = screen.getByRole('checkbox', { name: /requires follow-up call/i });
      await user.click(followupCheckbox);

      // Test second dropdown
      const serviceDetailSelect = screen.getByRole('combobox', { name: /service type detail/i });
      await user.click(serviceDetailSelect);
      await waitFor(() => {
        expect(screen.getByText('Urgent Care')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Urgent Care'));

      // Verify all fields have been updated
      expect(notesInput).toHaveValue('Patient requires special monitoring');
      expect(ageInput).toHaveValue('67');
      expect(followupCheckbox).toBeChecked();
    });

    it('maintains independent field states across multiple patient entries', async () => {
      const user = userEvent.setup();
      
      render(<ServiceLogForm {...defaultProps} />);

      // Create two patient entries
      await user.type(screen.getByLabelText(/number of patient entries/i), '2');
      fireEvent.blur(screen.getByLabelText(/number of patient entries/i));

      await waitFor(() => {
        expect(screen.getByText('Entry 1')).toBeInTheDocument();
        expect(screen.getByText('Entry 2')).toBeInTheDocument();
      });

      // Get all text inputs for notes (should be 2)
      const notesInputs = screen.getAllByRole('textbox', { name: /additional notes/i });
      expect(notesInputs).toHaveLength(2);

      // Fill different values in each entry
      await user.type(notesInputs[0], 'First patient notes');
      await user.type(notesInputs[1], 'Second patient notes');

      // Get all number inputs for age (should be 2)
      const ageInputs = screen.getAllByRole('spinbutton', { name: /patient age/i });
      expect(ageInputs).toHaveLength(2);

      await user.clear(ageInputs[0]);
      await user.type(ageInputs[0], '45');
      await user.clear(ageInputs[1]);
      await user.type(ageInputs[1], '72');

      // Verify independent values
      expect(notesInputs[0]).toHaveValue('First patient notes');
      expect(notesInputs[1]).toHaveValue('Second patient notes');
      expect(ageInputs[0]).toHaveValue('45');
      expect(ageInputs[1]).toHaveValue('72');
    });

    it('validates required dynamic fields', async () => {
      const user = userEvent.setup();
      
      // Mock custom fields with required validation
      const requiredCustomFields: CustomFieldWithChoices[] = [{
        id: 'field-required',
        fieldLabel: 'Required Field',
        fieldType: 'text',
        fieldOrder: 1,
        isActive: true,
        choices: [],
      }];

      mockUseCustomFields.mockReturnValue({
        fields: requiredCustomFields,
        values: {},
        isLoading: false,
        error: null,
        refreshFields: jest.fn(),
        loadFieldValues: jest.fn(),
        saveFieldValues: jest.fn(),
        clearValues: jest.fn(),
      });

      render(<ServiceLogForm {...defaultProps} />);

      // Fill required form fields
      const clientSelect = screen.getByRole('combobox', { name: /client/i });
      await user.click(clientSelect);
      await user.click(screen.getByText('Main Hospital'));

      const activitySelect = screen.getByRole('combobox', { name: /activity/i });
      await user.click(activitySelect);
      await user.click(screen.getByText('General Consultation'));

      const dateInput = screen.getByLabelText(/service date/i);
      await user.type(dateInput, '2024-01-15');

      // Create patient entry
      await user.type(screen.getByLabelText(/number of patient entries/i), '1');
      fireEvent.blur(screen.getByLabelText(/number of patient entries/i));

      await waitFor(() => {
        expect(screen.getByText('Entry 1')).toBeInTheDocument();
      });

      // Fill required patient entry fields
      const appointmentSelect = screen.getByRole('combobox', { name: /appointment type/i });
      await user.click(appointmentSelect);
      await user.click(screen.getByText('New Patient'));

      const outcomeSelect = screen.getByRole('combobox', { name: /outcome/i });
      await user.click(outcomeSelect);
      await user.click(screen.getByText('Treatment Completed'));

      // Submit without filling the required custom field
      await user.click(screen.getByRole('button', { name: /submit/i }));

      // Should not submit successfully due to validation
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Form Submission with Dynamic Fields', () => {
    it('includes dynamic field values in form submission data', async () => {
      const user = userEvent.setup();
      
      render(<ServiceLogForm {...defaultProps} />);

      // Fill basic form fields
      const clientSelect = screen.getByRole('combobox', { name: /client/i });
      await user.click(clientSelect);
      await user.click(screen.getByText('Main Hospital'));

      const activitySelect = screen.getByRole('combobox', { name: /activity/i });
      await user.click(activitySelect);
      await user.click(screen.getByText('General Consultation'));

      const dateInput = screen.getByLabelText(/service date/i);
      await user.type(dateInput, '2024-01-15');

      // Create patient entry
      await user.type(screen.getByLabelText(/number of patient entries/i), '1');
      fireEvent.blur(screen.getByLabelText(/number of patient entries/i));

      await waitFor(() => {
        expect(screen.getByText('Entry 1')).toBeInTheDocument();
      });

      // Fill patient entry required fields
      const appointmentSelect = screen.getByRole('combobox', { name: /appointment type/i });
      await user.click(appointmentSelect);
      await user.click(screen.getByText('New Patient'));

      const outcomeSelect = screen.getByRole('combobox', { name: /outcome/i });
      await user.click(outcomeSelect);
      await user.click(screen.getByText('Treatment Completed'));

      // Fill dynamic fields
      const riskLevelSelect = screen.getByRole('combobox', { name: /patient risk level/i });
      await user.click(riskLevelSelect);
      await user.click(screen.getByText('High Risk'));

      const notesInput = screen.getByRole('textbox', { name: /additional notes/i });
      await user.type(notesInput, 'Critical patient monitoring required');

      const ageInput = screen.getByRole('spinbutton', { name: /patient age/i });
      await user.clear(ageInput);
      await user.type(ageInput, '85');

      const followupCheckbox = screen.getByRole('checkbox', { name: /requires follow-up call/i });
      await user.click(followupCheckbox);

      // Submit form
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          clientId: 'client-1',
          activityId: 'activity-1',
          serviceDate: '2024-01-15',
          patientCount: 1,
          patientEntries: [{
            appointmentType: 'new',
            outcomeId: 'outcome-1',
            customFields: {
              'field-risk-level': 'risk-high',
              'field-notes': 'Critical patient monitoring required',
              'field-age': 85,
              'field-followup': true,
              'field-service-detail': '', // Default empty value
            }
          }]
        });
      });
    });

    it('handles form submission with mixed dynamic field values', async () => {
      const user = userEvent.setup();
      
      render(<ServiceLogForm {...defaultProps} />);

      // Fill basic form
      const clientSelect = screen.getByRole('combobox', { name: /client/i });
      await user.click(clientSelect);
      await user.click(screen.getByText('Community Clinic'));

      const activitySelect = screen.getByRole('combobox', { name: /activity/i });
      await user.click(activitySelect);
      await user.click(screen.getByText('Cardiology'));

      const dateInput = screen.getByLabelText(/service date/i);
      await user.type(dateInput, '2024-02-20');

      // Create multiple patient entries
      await user.type(screen.getByLabelText(/number of patient entries/i), '2');
      fireEvent.blur(screen.getByLabelText(/number of patient entries/i));

      await waitFor(() => {
        expect(screen.getByText('Entry 1')).toBeInTheDocument();
        expect(screen.getByText('Entry 2')).toBeInTheDocument();
      });

      // Fill first entry
      const appointmentSelects = screen.getAllByRole('combobox', { name: /appointment type/i });
      await user.click(appointmentSelects[0]);
      await user.click(screen.getByText('New Patient'));

      const outcomeSelects = screen.getAllByRole('combobox', { name: /outcome/i });
      await user.click(outcomeSelects[0]);
      await user.click(screen.getByText('Treatment Completed'));

      // Fill dynamic fields for first entry
      const notesInputs = screen.getAllByRole('textbox', { name: /additional notes/i });
      await user.type(notesInputs[0], 'First entry notes');

      const ageInputs = screen.getAllByRole('spinbutton', { name: /patient age/i });
      await user.clear(ageInputs[0]);
      await user.type(ageInputs[0], '56');

      // Fill second entry
      await user.click(appointmentSelects[1]);
      await user.click(screen.getByText('Follow-up'));

      await user.click(outcomeSelects[1]);
      await user.click(screen.getByText('Referred to Specialist'));

      // Fill different dynamic fields for second entry
      await user.type(notesInputs[1], 'Second entry notes');

      const ageInputs2 = screen.getAllByRole('spinbutton', { name: /patient age/i });
      await user.clear(ageInputs2[1]);
      await user.type(ageInputs2[1], '42');

      const followupCheckboxes = screen.getAllByRole('checkbox', { name: /requires follow-up call/i });
      await user.click(followupCheckboxes[1]);

      // Submit form
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          clientId: 'client-2',
          activityId: 'activity-2',
          serviceDate: '2024-02-20',
          patientCount: 2,
          patientEntries: [
            {
              appointmentType: 'new',
              outcomeId: 'outcome-1',
              customFields: {
                'field-risk-level': '', // Default empty
                'field-notes': 'First entry notes',
                'field-age': 56,
                'field-followup': false, // Default unchecked
                'field-service-detail': '', // Default empty
              }
            },
            {
              appointmentType: 'followup',
              outcomeId: 'outcome-2',
              customFields: {
                'field-risk-level': '', // Default empty
                'field-notes': 'Second entry notes',
                'field-age': 42,
                'field-followup': true, // User checked
                'field-service-detail': '', // Default empty
              }
            }
          ]
        });
      });
    });

    it('handles empty dynamic field values correctly', async () => {
      const user = userEvent.setup();
      
      render(<ServiceLogForm {...defaultProps} />);

      // Fill only required fields, leave dynamic fields empty
      const clientSelect = screen.getByRole('combobox', { name: /client/i });
      await user.click(clientSelect);
      await user.click(screen.getByText('Main Hospital'));

      const activitySelect = screen.getByRole('combobox', { name: /activity/i });
      await user.click(activitySelect);
      await user.click(screen.getByText('General Consultation'));

      const dateInput = screen.getByLabelText(/service date/i);
      await user.type(dateInput, '2024-01-15');

      await user.type(screen.getByLabelText(/number of patient entries/i), '1');
      fireEvent.blur(screen.getByLabelText(/number of patient entries/i));

      await waitFor(() => {
        expect(screen.getByText('Entry 1')).toBeInTheDocument();
      });

      const appointmentSelect = screen.getByRole('combobox', { name: /appointment type/i });
      await user.click(appointmentSelect);
      await user.click(screen.getByText('New Patient'));

      const outcomeSelect = screen.getByRole('combobox', { name: /outcome/i });
      await user.click(outcomeSelect);
      await user.click(screen.getByText('Treatment Completed'));

      // Submit without filling dynamic fields
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          clientId: 'client-1',
          activityId: 'activity-1',
          serviceDate: '2024-01-15',
          patientCount: 1,
          patientEntries: [{
            appointmentType: 'new',
            outcomeId: 'outcome-1',
            customFields: {
              'field-risk-level': '',
              'field-notes': '',
              'field-age': 0, // Default number value
              'field-followup': false, // Default boolean value
              'field-service-detail': '',
            }
          }]
        });
      });
    });
  });

  describe('Performance and User Experience', () => {
    it('renders quickly with multiple dynamic fields', async () => {
      const startTime = performance.now();
      
      render(<ServiceLogForm {...defaultProps} />);

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(200); // Should render within 200ms
      expect(screen.getByText('Service Log Entry')).toBeInTheDocument();
    });

    it('maintains responsive performance with large number of patient entries', async () => {
      const user = userEvent.setup();
      
      render(<ServiceLogForm {...defaultProps} />);

      const startTime = performance.now();

      // Create maximum number of entries
      await user.clear(screen.getByLabelText(/number of patient entries/i));
      await user.type(screen.getByLabelText(/number of patient entries/i), '10');
      fireEvent.blur(screen.getByLabelText(/number of patient entries/i));

      await waitFor(() => {
        expect(screen.getByText('Entry 10')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const updateTime = endTime - startTime;

      expect(updateTime).toBeLessThan(1000); // Should update within 1 second
      
      // Verify all entries have dynamic fields
      expect(screen.getAllByText('Additional Information')).toHaveLength(10);
    });

    it('handles field ordering correctly', async () => {
      const user = userEvent.setup();
      
      // Mock fields with specific ordering
      const orderedFields: CustomFieldWithChoices[] = [
        {
          id: 'field-3',
          fieldLabel: 'Third Field',
          fieldType: 'text',
          fieldOrder: 3,
          isActive: true,
          choices: [],
        },
        {
          id: 'field-1',
          fieldLabel: 'First Field',
          fieldType: 'text',
          fieldOrder: 1,
          isActive: true,
          choices: [],
        },
        {
          id: 'field-2',
          fieldLabel: 'Second Field',
          fieldType: 'text',
          fieldOrder: 2,
          isActive: true,
          choices: [],
        },
      ];

      mockUseCustomFields.mockReturnValue({
        fields: orderedFields,
        values: {},
        isLoading: false,
        error: null,
        refreshFields: jest.fn(),
        loadFieldValues: jest.fn(),
        saveFieldValues: jest.fn(),
        clearValues: jest.fn(),
      });

      render(<ServiceLogForm {...defaultProps} />);

      await user.type(screen.getByLabelText(/number of patient entries/i), '1');
      fireEvent.blur(screen.getByLabelText(/number of patient entries/i));

      await waitFor(() => {
        expect(screen.getByText('Entry 1')).toBeInTheDocument();
      });

      // Check that fields are rendered in correct order
      const fieldLabels = screen.getAllByText(/Field$/);
      expect(fieldLabels[0]).toHaveTextContent('First Field');
      expect(fieldLabels[1]).toHaveTextContent('Second Field');
      expect(fieldLabels[2]).toHaveTextContent('Third Field');
    });
  });

  describe('Accessibility', () => {
    it('meets accessibility standards with dynamic fields', async () => {
      const { container } = render(<ServiceLogForm {...defaultProps} />);

      const user = userEvent.setup();
      
      // Create patient entry to show dynamic fields
      await user.type(screen.getByLabelText(/number of patient entries/i), '1');
      fireEvent.blur(screen.getByLabelText(/number of patient entries/i));

      await waitFor(() => {
        expect(screen.getByText('Entry 1')).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('provides proper keyboard navigation for dynamic fields', async () => {
      render(<ServiceLogForm {...defaultProps} />);

      const user = userEvent.setup();
      
      await user.type(screen.getByLabelText(/number of patient entries/i), '1');
      fireEvent.blur(screen.getByLabelText(/number of patient entries/i));

      await waitFor(() => {
        expect(screen.getByText('Entry 1')).toBeInTheDocument();
      });

      // Test tab navigation through dynamic fields
      const notesInput = screen.getByRole('textbox', { name: /additional notes/i });
      const ageInput = screen.getByRole('spinbutton', { name: /patient age/i });
      const followupCheckbox = screen.getByRole('checkbox', { name: /requires follow-up call/i });

      // Test tab order
      notesInput.focus();
      expect(document.activeElement).toBe(notesInput);

      await user.tab();
      // Should move to next focusable element (age input or other field)
      expect(document.activeElement).not.toBe(notesInput);
    });

    it('provides proper error messaging for dynamic fields', async () => {
      const user = userEvent.setup();
      
      // Mock required dynamic field
      const requiredField: CustomFieldWithChoices[] = [{
        id: 'field-required-text',
        fieldLabel: 'Required Information',
        fieldType: 'text',
        fieldOrder: 1,
        isActive: true,
        choices: [],
      }];

      mockUseCustomFields.mockReturnValue({
        fields: requiredField,
        values: {},
        isLoading: false,
        error: null,
        refreshFields: jest.fn(),
        loadFieldValues: jest.fn(),
        saveFieldValues: jest.fn(),
        clearValues: jest.fn(),
      });

      render(<ServiceLogForm {...defaultProps} />);

      await user.type(screen.getByLabelText(/number of patient entries/i), '1');
      fireEvent.blur(screen.getByLabelText(/number of patient entries/i));

      await waitFor(() => {
        expect(screen.getByText('Entry 1')).toBeInTheDocument();
      });

      const requiredInput = screen.getByRole('textbox', { name: /required information/i });
      
      // Test focus and blur to trigger validation
      requiredInput.focus();
      requiredInput.blur();

      // Error message should be accessible via aria-describedby
      expect(requiredInput).toHaveAttribute('aria-describedby');
    });
  });

  describe('Data Persistence and State Management', () => {
    it('preserves dynamic field values when adding/removing patient entries', async () => {
      const user = userEvent.setup();
      
      render(<ServiceLogForm {...defaultProps} />);

      // Create initial entry
      await user.type(screen.getByLabelText(/number of patient entries/i), '1');
      fireEvent.blur(screen.getByLabelText(/number of patient entries/i));

      await waitFor(() => {
        expect(screen.getByText('Entry 1')).toBeInTheDocument();
      });

      // Fill dynamic field
      const notesInput = screen.getByRole('textbox', { name: /additional notes/i });
      await user.type(notesInput, 'Important patient information');

      // Add another entry
      await user.clear(screen.getByLabelText(/number of patient entries/i));
      await user.type(screen.getByLabelText(/number of patient entries/i), '2');
      fireEvent.blur(screen.getByLabelText(/number of patient entries/i));

      await waitFor(() => {
        expect(screen.getByText('Entry 2')).toBeInTheDocument();
      });

      // Verify first entry's data is preserved
      const notesInputs = screen.getAllByRole('textbox', { name: /additional notes/i });
      expect(notesInputs[0]).toHaveValue('Important patient information');
    });

    it('handles form reset with dynamic fields', async () => {
      const user = userEvent.setup();
      
      render(<ServiceLogForm {...defaultProps} />);

      // Fill form including dynamic fields
      await user.type(screen.getByLabelText(/number of patient entries/i), '1');
      fireEvent.blur(screen.getByLabelText(/number of patient entries/i));

      await waitFor(() => {
        expect(screen.getByText('Entry 1')).toBeInTheDocument();
      });

      const notesInput = screen.getByRole('textbox', { name: /additional notes/i });
      await user.type(notesInput, 'Test notes');

      const ageInput = screen.getByRole('spinbutton', { name: /patient age/i });
      await user.clear(ageInput);
      await user.type(ageInput, '50');

      // Clear form
      await user.click(screen.getByRole('button', { name: /clear form/i }));

      // Verify form is reset
      expect(screen.getByLabelText(/number of patient entries/i)).toHaveValue('1');
      expect(screen.queryByText('Entry 1')).not.toBeInTheDocument();
    });
  });
});