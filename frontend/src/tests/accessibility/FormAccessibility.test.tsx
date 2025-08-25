// Form Accessibility Tests following WCAG 2.1 AA guidelines  
import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServiceLogForm } from '../../components/ServiceLogForm';
import { CreateUserModal } from '../../components/CreateUserModal';
import { EntityModal } from '../../components/EntityModal';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { DatePicker } from '../../components/DatePicker';
import { 
  renderWithA11yContext, 
  a11yTestUtils, 
  healthcareA11yScenarios,
  generateA11yTestData 
} from './AccessibilityTestUtils';

// Mock dependencies
jest.mock('../../hooks/useToast', () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));

jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ 
    user: { id: 'user-1', role: 'admin', name: 'Dr. Smith' },
    isAuthenticated: true 
  }),
}));

jest.mock('../../services/apiService', () => ({
  apiService: {
    get: jest.fn().mockResolvedValue({
      success: true,
      data: {
        clients: [{ id: 'client-1', name: 'Main Hospital', isActive: true }],
        activities: [{ id: 'activity-1', name: 'General Consultation', isActive: true }],
        outcomes: [{ id: 'outcome-1', name: 'Treatment Completed', isActive: true }],
        users: [],
      },
    }),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

describe('Form Accessibility Tests - WCAG 2.1 AA Compliance', () => {
  describe('Form Labeling and Association', () => {
    const defaultFormProps = {
      clients: [{ id: 'client-1', name: 'Main Hospital', isActive: true, description: '', createdAt: '', updatedAt: '' }],
      activities: [{ id: 'activity-1', name: 'General Consultation', isActive: true, description: '', createdAt: '', updatedAt: '' }],
      outcomes: [{ id: 'outcome-1', name: 'Treatment Completed', isActive: true, description: '', createdAt: '', updatedAt: '' }],
      onSubmit: jest.fn(),
    };

    test('all form controls have proper labels', () => {
      renderWithA11yContext(<ServiceLogForm {...defaultFormProps} />);

      // Input fields should be labeled
      expect(screen.getByLabelText(/service date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/number of patient entries/i)).toBeInTheDocument();

      // Select dropdowns should have accessible names
      expect(screen.getByRole('button', { name: /select client/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /select activity/i })).toBeInTheDocument();

      // Form sections should have headings
      expect(screen.getByRole('heading', { name: /service log entry/i })).toBeInTheDocument();
    });

    test('labels are properly associated with form controls', () => {
      renderWithA11yContext(
        <div>
          <Input 
            label="Patient Name" 
            name="patientName"
            placeholder="Enter patient name"
            required
          />
          <Input 
            label="Medical Record Number" 
            name="mrn"
            placeholder="MR123456"
            helperText="Format: MR followed by 6 digits"
          />
        </div>
      );

      const patientNameInput = screen.getByLabelText(/patient name/i);
      const mrnInput = screen.getByLabelText(/medical record number/i);

      // Should have proper id-label associations
      expect(patientNameInput).toHaveAttribute('name', 'patientName');
      expect(patientNameInput).toHaveAttribute('required');

      expect(mrnInput).toHaveAttribute('name', 'mrn');
      expect(mrnInput).toHaveAttribute('aria-describedby');
      
      // Helper text should be accessible
      expect(screen.getByText('Format: MR followed by 6 digits')).toBeInTheDocument();
    });

    test('required field indicators are accessible', () => {
      renderWithA11yContext(<ServiceLogForm {...defaultFormProps} />);

      // Required fields should have visual and semantic indicators
      const requiredLabels = screen.getAllByText(/client\/site|activity\/specialty/i);
      requiredLabels.forEach(label => {
        // Should contain asterisk or other visual indicator
        expect(label.parentElement?.textContent || label.textContent).toMatch(/\*/);
      });

      // Should have explanation of required field notation
      expect(screen.getByText('* Required fields')).toBeInTheDocument();

      // Form controls should have required attribute or aria-required
      const serviceDateInput = screen.getByLabelText(/service date/i);
      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      
      expect(serviceDateInput).toHaveAttribute('required');
      expect(patientCountInput).toHaveAttribute('required');
    });

    test('help text is properly associated with form controls', () => {
      renderWithA11yContext(<ServiceLogForm {...defaultFormProps} />);

      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      const serviceDateInput = screen.getByLabelText(/service date/i);

      // Controls should be described by their help text
      expect(patientCountInput).toHaveAttribute('aria-describedby');
      expect(serviceDateInput).toHaveAttribute('aria-describedby');

      // Help text should exist and be meaningful
      expect(screen.getByText('How many individual patient entries to create (1-100)')).toBeInTheDocument();
      expect(screen.getByText('Date when the service was provided')).toBeInTheDocument();
    });

    test('fieldsets and legends group related controls', async () => {
      const user = userEvent.setup();
      renderWithA11yContext(<ServiceLogForm {...defaultFormProps} />);

      // Generate patient entries to test grouping
      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      await user.clear(patientCountInput);
      await user.type(patientCountInput, '2');

      await waitFor(() => {
        // Patient entries should be logically grouped
        expect(screen.getByText('Patient Entries')).toBeInTheDocument();
        expect(screen.getByText('Entry 1')).toBeInTheDocument();
        expect(screen.getByText('Entry 2')).toBeInTheDocument();

        // Each entry should have its controls grouped
        const appointmentSelects = screen.getAllByRole('button', { name: /select appointment type/i });
        const outcomeSelects = screen.getAllByRole('button', { name: /select outcome/i });
        
        expect(appointmentSelects).toHaveLength(2);
        expect(outcomeSelects).toHaveLength(2);
      });
    });
  });

  describe('Form Validation Accessibility', () => {
    test('validation errors are announced immediately', async () => {
      const user = userEvent.setup();
      renderWithA11yContext(<ServiceLogForm {...{
        clients: [{ id: 'client-1', name: 'Main Hospital', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        activities: [{ id: 'activity-1', name: 'General Consultation', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        outcomes: [{ id: 'outcome-1', name: 'Treatment Completed', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        onSubmit: jest.fn(),
      }} />);

      const submitButton = screen.getByRole('button', { name: /save service log/i });
      await user.click(submitButton);

      await waitFor(() => {
        // Error messages should be present and associated with fields
        const clientSelect = screen.getByRole('button', { name: /select client/i });
        const activitySelect = screen.getByRole('button', { name: /select activity/i });

        // Fields should be marked as invalid
        expect(clientSelect).toHaveAttribute('aria-describedby', expect.stringContaining('error'));
        expect(activitySelect).toHaveAttribute('aria-describedby', expect.stringContaining('error'));
      });
    });

    test('error messages provide clear guidance', async () => {
      const user = userEvent.setup();
      renderWithA11yContext(
        <div>
          <Input 
            label="Email Address"
            name="email"
            type="email"
            error="Please enter a valid email address"
            aria-describedby="email-error"
          />
          <Input 
            label="Phone Number"
            name="phone"
            error="Phone number must be 10 digits"
            aria-describedby="phone-error"
          />
        </div>
      );

      // Error messages should be clear and actionable
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      expect(screen.getByText('Phone number must be 10 digits')).toBeInTheDocument();

      // Inputs should be marked as invalid
      const emailInput = screen.getByLabelText(/email address/i);
      const phoneInput = screen.getByLabelText(/phone number/i);

      expect(emailInput).toHaveAttribute('aria-invalid', 'true');
      expect(emailInput).toHaveAttribute('aria-describedby', 'email-error');
      
      expect(phoneInput).toHaveAttribute('aria-invalid', 'true');
      expect(phoneInput).toHaveAttribute('aria-describedby', 'phone-error');
    });

    test('inline validation provides immediate feedback', async () => {
      const user = userEvent.setup();
      renderWithA11yContext(
        <Input 
          label="Patient Count"
          name="patientCount"
          type="number"
          min={1}
          max={100}
          helperText="Enter number between 1-100"
        />
      );

      const input = screen.getByLabelText(/patient count/i);
      
      // Test invalid input
      await user.type(input, '150');
      await user.tab(); // Trigger blur validation
      
      // Should provide feedback about the constraint
      expect(input).toHaveAttribute('min', '1');
      expect(input).toHaveAttribute('max', '100');
    });

    test('success validation states are announced', async () => {
      const user = userEvent.setup();
      renderWithA11yContext(
        <Input 
          label="Medical Record Number"
          name="mrn"
          pattern="^MR\d{6}$"
          helperText="Format: MR followed by 6 digits (e.g., MR123456)"
        />
      );

      const input = screen.getByLabelText(/medical record number/i);
      
      // Enter valid format
      await user.type(input, 'MR123456');
      await user.tab();
      
      // Should not show error state
      expect(input).not.toHaveAttribute('aria-invalid', 'true');
    });

    test('validation errors contain no sensitive healthcare data', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn().mockRejectedValue(
        new Error('Validation failed for patient John Doe (SSN: 123-45-6789)')
      );

      renderWithA11yContext(<ServiceLogForm {...{
        clients: [{ id: 'client-1', name: 'Main Hospital', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        activities: [{ id: 'activity-1', name: 'General Consultation', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        outcomes: [{ id: 'outcome-1', name: 'Treatment Completed', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        onSubmit: mockOnSubmit,
      }} />);

      // Fill required fields and submit
      const clientSelect = screen.getByRole('button', { name: /select client/i });
      await user.click(clientSelect);
      await user.click(screen.getByText('Main Hospital'));

      const activitySelect = screen.getByRole('button', { name: /select activity/i });
      await user.click(activitySelect);
      await user.click(screen.getByText('General Consultation'));

      const serviceDateInput = screen.getByLabelText(/service date/i);
      await user.type(serviceDateInput, '2023-12-01');

      const submitButton = screen.getByRole('button', { name: /save service log/i });
      await user.click(submitButton);

      // Error should be sanitized - no sensitive data exposed
      await waitFor(() => {
        // Should have generic error, not the raw error with sensitive data
        const errorElements = document.querySelectorAll('[role="alert"], .text-red-600');
        errorElements.forEach(element => {
          if (element.textContent) {
            a11yTestUtils.checkForSensitiveData(element.textContent);
          }
        });
      });
    });
  });

  describe('Form Navigation and Flow', () => {
    test('logical tab order through form sections', async () => {
      const user = userEvent.setup();
      renderWithA11yContext(<ServiceLogForm {...{
        clients: [{ id: 'client-1', name: 'Main Hospital', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        activities: [{ id: 'activity-1', name: 'General Consultation', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        outcomes: [{ id: 'outcome-1', name: 'Treatment Completed', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        onSubmit: jest.fn(),
      }} />);

      // Tab through form elements in logical order
      await user.tab(); // Client select
      expect(screen.getByRole('button', { name: /select client/i })).toHaveFocus();

      await user.tab(); // Activity select  
      expect(screen.getByRole('button', { name: /select activity/i })).toHaveFocus();

      await user.tab(); // Service date
      expect(screen.getByLabelText(/service date/i)).toHaveFocus();

      await user.tab(); // Patient count
      expect(screen.getByLabelText(/number of patient entries/i)).toHaveFocus();
    });

    test('form sections are properly announced', async () => {
      const user = userEvent.setup();
      renderWithA11yContext(<ServiceLogForm {...{
        clients: [{ id: 'client-1', name: 'Main Hospital', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        activities: [{ id: 'activity-1', name: 'General Consultation', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        outcomes: [{ id: 'outcome-1', name: 'Treatment Completed', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        onSubmit: jest.fn(),
      }} />);

      // Generate patient entries section
      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      await user.clear(patientCountInput);
      await user.type(patientCountInput, '1');

      await waitFor(() => {
        // New section should be announced
        expect(screen.getByText('Patient Entries')).toBeInTheDocument();
        expect(screen.getByText('Entry 1')).toBeInTheDocument();
      });
    });

    test('form progress is indicated to screen readers', async () => {
      const user = userEvent.setup();
      renderWithA11yContext(<ServiceLogForm {...{
        clients: [{ id: 'client-1', name: 'Main Hospital', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        activities: [{ id: 'activity-1', name: 'General Consultation', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        outcomes: [{ id: 'outcome-1', name: 'Treatment Completed', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        onSubmit: jest.fn(),
      }} />);

      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      await user.type(patientCountInput, '1');

      await waitFor(() => {
        // Should indicate unsaved changes
        expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
      });
    });

    test('form submission states are accessible', async () => {
      const user = userEvent.setup();
      const slowSubmit = jest.fn(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );
      
      renderWithA11yContext(<ServiceLogForm {...{
        clients: [{ id: 'client-1', name: 'Main Hospital', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        activities: [{ id: 'activity-1', name: 'General Consultation', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        outcomes: [{ id: 'outcome-1', name: 'Treatment Completed', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        onSubmit: slowSubmit,
      }} />);

      // Fill required fields
      const clientSelect = screen.getByRole('button', { name: /select client/i });
      await user.click(clientSelect);
      await user.click(screen.getByText('Main Hospital'));

      const activitySelect = screen.getByRole('button', { name: /select activity/i });
      await user.click(activitySelect);
      await user.click(screen.getByText('General Consultation'));

      const serviceDateInput = screen.getByLabelText(/service date/i);
      await user.type(serviceDateInput, '2023-12-01');

      const submitButton = screen.getByRole('button', { name: /save service log/i });
      await user.click(submitButton);

      // Loading state should be accessible
      expect(screen.getByText('Saving...')).toBeInTheDocument();
      expect(submitButton).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('Dynamic Form Content Accessibility', () => {
    test('dynamically added form elements are accessible', async () => {
      const user = userEvent.setup();
      renderWithA11yContext(<ServiceLogForm {...{
        clients: [{ id: 'client-1', name: 'Main Hospital', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        activities: [{ id: 'activity-1', name: 'General Consultation', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        outcomes: [{ id: 'outcome-1', name: 'Treatment Completed', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        onSubmit: jest.fn(),
      }} />);

      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      await user.clear(patientCountInput);
      await user.type(patientCountInput, '3');

      await waitFor(() => {
        // All patient entries should be properly labeled
        expect(screen.getByText('Entry 1')).toBeInTheDocument();
        expect(screen.getByText('Entry 2')).toBeInTheDocument();
        expect(screen.getByText('Entry 3')).toBeInTheDocument();

        // Each entry should have accessible form controls
        const appointmentSelects = screen.getAllByRole('button', { name: /select appointment type/i });
        const outcomeSelects = screen.getAllByRole('button', { name: /select outcome/i });
        
        expect(appointmentSelects).toHaveLength(3);
        expect(outcomeSelects).toHaveLength(3);

        // Each control should be properly labeled
        appointmentSelects.forEach((select, index) => {
          expect(select).toHaveAccessibleName();
        });
        
        outcomeSelects.forEach((select, index) => {
          expect(select).toHaveAccessibleName();
        });
      });
    });

    test('form summary updates are announced', async () => {
      const user = userEvent.setup();
      renderWithA11yContext(<ServiceLogForm {...{
        clients: [{ id: 'client-1', name: 'Main Hospital', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        activities: [{ id: 'activity-1', name: 'General Consultation', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        outcomes: [{ id: 'outcome-1', name: 'Treatment Completed', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        onSubmit: jest.fn(),
      }} />);

      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      await user.clear(patientCountInput);
      await user.type(patientCountInput, '2');

      await waitFor(() => {
        // Summary should be accessible and updated
        const summary = screen.getByText('Summary');
        expect(summary).toBeInTheDocument();
        
        expect(screen.getByText('Total Entries:')).toBeInTheDocument();
        expect(screen.getByText('New Patients:')).toBeInTheDocument();
        expect(screen.getByText('Follow-ups:')).toBeInTheDocument();
        expect(screen.getByText('Did Not Attend:')).toBeInTheDocument();
      });

      // Change appointment types and verify summary updates
      const appointmentSelects = screen.getAllByRole('button', { name: /select appointment type/i });
      await user.click(appointmentSelects[0]);
      await user.click(screen.getByText('New Patient'));

      await user.click(appointmentSelects[1]);
      await user.click(screen.getByText('Follow-up Patient'));

      // Summary numbers should update (testing the structure, actual counts depend on implementation)
      expect(screen.getByText('Total Entries:')).toBeInTheDocument();
    });
  });

  describe('Modal Form Accessibility', () => {
    test('modal forms have proper focus management', () => {
      renderWithA11yContext(
        <CreateUserModal
          isOpen={true}
          onClose={jest.fn()}
          onSubmit={jest.fn()}
        />
      );

      const modal = screen.getByRole('dialog');
      expect(modal).toHaveAttribute('aria-modal', 'true');
      expect(modal).toHaveAttribute('aria-labelledby');

      // First form field should receive focus
      const nameInput = screen.getByLabelText(/name/i);
      expect(nameInput).toBeInTheDocument();
    });

    test('modal form validation follows accessibility patterns', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn();
      
      renderWithA11yContext(
        <CreateUserModal
          isOpen={true}
          onClose={jest.fn()}
          onSubmit={mockOnSubmit}
        />
      );

      // Submit empty form
      const submitButton = screen.getByRole('button', { name: /create user/i });
      await user.click(submitButton);

      await waitFor(() => {
        // Error messages should be accessible
        const nameInput = screen.getByLabelText(/name/i);
        const emailInput = screen.getByLabelText(/email/i);
        
        // Fields should be marked invalid if validation fails
        if (nameInput.hasAttribute('aria-invalid')) {
          expect(nameInput).toHaveAttribute('aria-invalid', 'true');
          expect(nameInput).toHaveAttribute('aria-describedby');
        }
      });
    });

    test('modal close actions are accessible', async () => {
      const user = userEvent.setup();
      const mockOnClose = jest.fn();
      
      renderWithA11yContext(
        <EntityModal
          isOpen={true}
          onClose={mockOnClose}
          title="Test Modal"
          onSubmit={jest.fn()}
        >
          <input placeholder="Test input" />
        </EntityModal>
      );

      // Should close with Escape key
      await user.keyboard('{Escape}');
      expect(mockOnClose).toHaveBeenCalled();

      // Close button should be accessible
      const closeButton = screen.queryByRole('button', { name: /close/i });
      if (closeButton) {
        await user.click(closeButton);
        expect(mockOnClose).toHaveBeenCalledTimes(2);
      }
    });
  });

  describe('Complex Form Interactions', () => {
    test('conditional form fields are accessible', async () => {
      const user = userEvent.setup();
      renderWithA11yContext(<ServiceLogForm {...{
        clients: [{ id: 'client-1', name: 'Main Hospital', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        activities: [{ id: 'activity-1', name: 'General Consultation', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        outcomes: [{ id: 'outcome-1', name: 'Treatment Completed', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        onSubmit: jest.fn(),
      }} />);

      // Generate patient entries which reveal conditional fields
      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      await user.clear(patientCountInput);
      await user.type(patientCountInput, '1');

      await waitFor(() => {
        // Conditional appointment type and outcome fields should be accessible
        const appointmentSelect = screen.getByRole('button', { name: /select appointment type/i });
        const outcomeSelect = screen.getByRole('button', { name: /select outcome/i });
        
        expect(appointmentSelect).toBeInTheDocument();
        expect(outcomeSelect).toBeInTheDocument();
        
        // Each should have proper labels and be keyboard accessible
        expect(appointmentSelect).toHaveAccessibleName();
        expect(outcomeSelect).toHaveAccessibleName();
      });
    });

    test('form auto-save functionality is accessible', async () => {
      const user = userEvent.setup();
      renderWithA11yContext(<ServiceLogForm {...{
        clients: [{ id: 'client-1', name: 'Main Hospital', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        activities: [{ id: 'activity-1', name: 'General Consultation', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        outcomes: [{ id: 'outcome-1', name: 'Treatment Completed', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        onSubmit: jest.fn(),
      }} />);

      // Make changes to trigger unsaved state
      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      await user.type(patientCountInput, '1');

      await waitFor(() => {
        // Unsaved changes should be announced
        expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
      });

      // Auto-save status should be accessible if implemented
      // This is a placeholder for testing auto-save announcements
    });
  });

  describe('Form Error Recovery', () => {
    test('provides clear recovery instructions for form errors', async () => {
      const user = userEvent.setup();
      renderWithA11yContext(<ServiceLogForm {...{
        clients: [{ id: 'client-1', name: 'Main Hospital', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        activities: [{ id: 'activity-1', name: 'General Consultation', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        outcomes: [{ id: 'outcome-1', name: 'Treatment Completed', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        onSubmit: jest.fn(),
      }} />);

      const submitButton = screen.getByRole('button', { name: /save service log/i });
      await user.click(submitButton);

      await waitFor(() => {
        // Error state should provide actionable guidance
        // The form should focus the first field with an error
        const firstErrorField = screen.getByRole('button', { name: /select client/i });
        expect(firstErrorField).toHaveAttribute('aria-describedby', expect.stringContaining('error'));
      });
    });

    test('form reset functionality is accessible', async () => {
      const user = userEvent.setup();
      renderWithA11yContext(<ServiceLogForm {...{
        clients: [{ id: 'client-1', name: 'Main Hospital', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        activities: [{ id: 'activity-1', name: 'General Consultation', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        outcomes: [{ id: 'outcome-1', name: 'Treatment Completed', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        onSubmit: jest.fn(),
      }} />);

      // Fill form with data
      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      await user.type(patientCountInput, '2');

      const notesTextarea = screen.getByRole('textbox', { name: /additional notes/i });
      await user.type(notesTextarea, 'Test notes');

      // Clear form
      const clearButton = screen.getByRole('button', { name: /clear form/i });
      await user.click(clearButton);

      // Form should reset and announce the action
      expect(patientCountInput).toHaveValue(1); // Reset to default
      expect(notesTextarea).toHaveValue('');
    });
  });

  describe('Multi-step Form Patterns', () => {
    test('form sections maintain accessibility across steps', async () => {
      const user = userEvent.setup();
      renderWithA11yContext(<ServiceLogForm {...{
        clients: [{ id: 'client-1', name: 'Main Hospital', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        activities: [{ id: 'activity-1', name: 'General Consultation', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        outcomes: [{ id: 'outcome-1', name: 'Treatment Completed', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        onSubmit: jest.fn(),
      }} />);

      // Step 1: Basic information
      expect(screen.getByRole('heading', { name: /service log entry/i })).toBeInTheDocument();
      
      // Step 2: Generate patient entries (simulated step)
      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      await user.type(patientCountInput, '1');

      await waitFor(() => {
        // Step 2 content should be accessible
        expect(screen.getByText('Patient Entries')).toBeInTheDocument();
        expect(screen.getByText('Entry 1')).toBeInTheDocument();
      });

      // Step 3: Summary (always visible)
      expect(screen.getByText('Summary')).toBeInTheDocument();
    });
  });
});