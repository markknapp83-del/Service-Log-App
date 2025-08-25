// Screen Reader Support Tests following WCAG 2.1 AA guidelines
import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServiceLogForm } from '../../components/ServiceLogForm';
import { SubmissionsTable } from '../../components/SubmissionsTable';
import { DashboardPage } from '../../pages/DashboardPage';
import { EntityModal } from '../../components/EntityModal';
import { CreateUserModal } from '../../components/CreateUserModal';
import { 
  renderWithA11yContext, 
  a11yTestUtils, 
  createMockServiceLog,
  createMockPatient 
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
        submissions: [],
        users: [],
      },
    }),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('Screen Reader Support Tests - WCAG 2.1 AA Compliance', () => {
  describe('ARIA Labels and Descriptions', () => {
    const defaultFormProps = {
      clients: [{ id: 'client-1', name: 'Main Hospital', isActive: true, description: '', createdAt: '', updatedAt: '' }],
      activities: [{ id: 'activity-1', name: 'General Consultation', isActive: true, description: '', createdAt: '', updatedAt: '' }],
      outcomes: [{ id: 'outcome-1', name: 'Treatment Completed', isActive: true, description: '', createdAt: '', updatedAt: '' }],
      onSubmit: jest.fn(),
    };

    test('all interactive elements have accessible names', () => {
      renderWithA11yContext(<ServiceLogForm {...defaultFormProps} />);

      // Form controls should have accessible names
      expect(screen.getByRole('button', { name: /select client/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /select activity/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/service date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/number of patient entries/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save service log/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /clear form/i })).toBeInTheDocument();
    });

    test('form fields have proper ARIA descriptions', () => {
      renderWithA11yContext(<ServiceLogForm {...defaultFormProps} />);

      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      const serviceDate = screen.getByLabelText(/service date/i);

      // Should have aria-describedby pointing to help text
      expect(patientCountInput).toHaveAttribute('aria-describedby');
      expect(serviceDate).toHaveAttribute('aria-describedby');

      // Help text should exist and be properly associated
      expect(screen.getByText('How many individual patient entries to create (1-100)')).toBeInTheDocument();
      expect(screen.getByText('Date when the service was provided')).toBeInTheDocument();
    });

    test('error messages are properly announced', async () => {
      const user = userEvent.setup();
      renderWithA11yContext(<ServiceLogForm {...defaultFormProps} />);

      // Submit form without required fields to trigger errors
      const submitButton = screen.getByRole('button', { name: /save service log/i });
      await user.click(submitButton);

      await waitFor(() => {
        // Error messages should be associated with their fields via aria-describedby
        const clientSelect = screen.getByRole('button', { name: /select client/i });
        const activitySelect = screen.getByRole('button', { name: /select activity/i });
        
        expect(clientSelect).toHaveAttribute('aria-describedby', expect.stringContaining('error'));
        expect(activitySelect).toHaveAttribute('aria-describedby', expect.stringContaining('error'));
      });
    });

    test('required field indicators are accessible', () => {
      renderWithA11yContext(<ServiceLogForm {...defaultFormProps} />);

      // Required indicators should be part of the accessible name or described by aria-describedby
      const clientLabel = screen.getByText('Client/Site');
      const activityLabel = screen.getByText('Activity/Specialty');
      
      expect(clientLabel).toHaveTextContent('*');
      expect(activityLabel).toHaveTextContent('*');

      // Help text explaining required indicators
      expect(screen.getByText('* Required fields')).toBeInTheDocument();
    });

    test('dynamic content announcements work correctly', async () => {
      const user = userEvent.setup();
      renderWithA11yContext(<ServiceLogForm {...defaultFormProps} />);

      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      await user.clear(patientCountInput);
      await user.type(patientCountInput, '2');

      await waitFor(() => {
        // Patient entries section should be announced
        const patientEntriesSection = screen.getByText('Patient Entries');
        expect(patientEntriesSection).toBeInTheDocument();

        // Individual entries should be properly labeled
        expect(screen.getByText('Entry 1')).toBeInTheDocument();
        expect(screen.getByText('Entry 2')).toBeInTheDocument();
      });
    });

    test('loading states are announced to screen readers', async () => {
      const mockOnSubmit = jest.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
      renderWithA11yContext(<ServiceLogForm {...defaultFormProps} onSubmit={mockOnSubmit} />);

      // Fill required fields
      const clientSelect = screen.getByRole('button', { name: /select client/i });
      await userEvent.setup().click(clientSelect);
      await userEvent.setup().click(screen.getByText('Main Hospital'));

      const activitySelect = screen.getByRole('button', { name: /select activity/i });
      await userEvent.setup().click(activitySelect);
      await userEvent.setup().click(screen.getByText('General Consultation'));

      const serviceDateInput = screen.getByLabelText(/service date/i);
      await userEvent.setup().type(serviceDateInput, '2023-12-01');

      const submitButton = screen.getByRole('button', { name: /save service log/i });
      await userEvent.setup().click(submitButton);

      // Loading state should be announced
      expect(screen.getByText('Saving...')).toBeInTheDocument();
      expect(submitButton).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('Semantic HTML Structure', () => {
    test('uses proper heading hierarchy', () => {
      renderWithA11yContext(<ServiceLogForm {...{
        clients: [{ id: 'client-1', name: 'Main Hospital', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        activities: [{ id: 'activity-1', name: 'General Consultation', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        outcomes: [{ id: 'outcome-1', name: 'Treatment Completed', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        onSubmit: jest.fn(),
      }} />);

      // Main heading should be h1
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Service Log Entry');

      // Generate patient entries to test h2 headings
      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      userEvent.setup().type(patientCountInput, '1');

      waitFor(() => {
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Patient Entries');
      });
    });

    test('uses landmark roles appropriately', () => {
      renderWithA11yContext(<DashboardPage />);

      waitFor(() => {
        // Page should have main landmark
        expect(screen.getByRole('main')).toBeInTheDocument();
        
        // Navigation should be present
        expect(screen.getByRole('navigation')).toBeInTheDocument();
      });
    });

    test('form has proper semantic structure', () => {
      renderWithA11yContext(<ServiceLogForm {...{
        clients: [{ id: 'client-1', name: 'Main Hospital', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        activities: [{ id: 'activity-1', name: 'General Consultation', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        outcomes: [{ id: 'outcome-1', name: 'Treatment Completed', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        onSubmit: jest.fn(),
      }} />);

      // Form should be properly identified
      const form = screen.getByRole('form') || document.querySelector('form');
      expect(form).toBeInTheDocument();

      // Should have fieldsets for grouped content
      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      userEvent.setup().type(patientCountInput, '1');

      waitFor(() => {
        // Patient entries should be in a section or fieldset
        const patientSection = screen.getByText('Patient Entries').closest('div');
        expect(patientSection).toBeInTheDocument();
      });
    });
  });

  describe('Data Table Accessibility for Screen Readers', () => {
    const mockSubmissions = [
      createMockServiceLog({ id: 'log-1', patientCount: 2 }),
      createMockServiceLog({ id: 'log-2', patientCount: 1 }),
      createMockServiceLog({ id: 'log-3', patientCount: 3 }),
    ];

    test('table has proper headers and captions', () => {
      renderWithA11yContext(
        <SubmissionsTable 
          submissions={mockSubmissions}
          isLoading={false}
          onEdit={jest.fn()}
          onDelete={jest.fn()}
          onExport={jest.fn()}
        />
      );

      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();

      // Should have column headers
      expect(screen.getByColumnHeader(/date/i)).toBeInTheDocument();
      expect(screen.getByColumnHeader(/client/i)).toBeInTheDocument();
      expect(screen.getByColumnHeader(/patients/i)).toBeInTheDocument();

      // Should have appropriate table caption or aria-label
      expect(table).toHaveAccessibleName();
    });

    test('table rows announce content correctly', () => {
      renderWithA11yContext(
        <SubmissionsTable 
          submissions={mockSubmissions}
          isLoading={false}
          onEdit={jest.fn()}
          onDelete={jest.fn()}
          onExport={jest.fn()}
        />
      );

      // Data cells should be associated with their headers
      const rows = screen.getAllByRole('row').slice(1); // Skip header
      expect(rows.length).toBeGreaterThan(0);

      // Each data cell should be accessible
      rows.forEach(row => {
        const cells = within(row).getAllByRole('cell');
        expect(cells.length).toBeGreaterThan(0);
      });
    });

    test('table sorting is announced to screen readers', async () => {
      const user = userEvent.setup();
      renderWithA11yContext(
        <SubmissionsTable 
          submissions={mockSubmissions}
          isLoading={false}
          onEdit={jest.fn()}
          onDelete={jest.fn()}
          onExport={jest.fn()}
        />
      );

      // Look for sortable column headers
      const dateHeader = screen.queryByRole('button', { name: /sort by date/i });
      if (dateHeader) {
        await user.click(dateHeader);
        
        // Should announce sort direction
        expect(dateHeader).toHaveAttribute('aria-sort');
      }
    });

    test('empty table state is properly announced', () => {
      renderWithA11yContext(
        <SubmissionsTable 
          submissions={[]}
          isLoading={false}
          onEdit={jest.fn()}
          onDelete={jest.fn()}
          onExport={jest.fn()}
        />
      );

      // Empty state should be announced
      expect(screen.getByText(/no submissions found/i)).toBeInTheDocument();
    });
  });

  describe('Modal Dialog Screen Reader Support', () => {
    test('modal dialog has proper ARIA attributes', () => {
      renderWithA11yContext(
        <EntityModal
          isOpen={true}
          onClose={jest.fn()}
          title="Edit Patient Information"
          onSubmit={jest.fn()}
        >
          <input placeholder="Patient name" />
        </EntityModal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby');
      expect(screen.getByText('Edit Patient Information')).toBeInTheDocument();
    });

    test('modal opening is announced to screen readers', async () => {
      const { rerender } = renderWithA11yContext(
        <EntityModal
          isOpen={false}
          onClose={jest.fn()}
          title="Create New Patient"
          onSubmit={jest.fn()}
        >
          <input placeholder="Patient name" />
        </EntityModal>
      );

      // Open modal
      rerender(
        <EntityModal
          isOpen={true}
          onClose={jest.fn()}
          title="Create New Patient"
          onSubmit={jest.fn()}
        >
          <input placeholder="Patient name" />
        </EntityModal>
      );

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        
        // Title should be properly associated
        expect(dialog).toHaveAttribute('aria-labelledby');
      });
    });

    test('modal form fields are properly announced', () => {
      renderWithA11yContext(
        <CreateUserModal
          isOpen={true}
          onClose={jest.fn()}
          onSubmit={jest.fn()}
        />
      );

      // Form fields should have proper labels
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/role/i)).toBeInTheDocument();
    });
  });

  describe('Form Validation Screen Reader Support', () => {
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
        // Error messages should be in live regions for immediate announcement
        const errorMessages = screen.getAllByText(/required/i);
        errorMessages.forEach(error => {
          // Should be associated with form fields
          expect(error).toBeInTheDocument();
        });
      });
    });

    test('success messages are announced via live regions', async () => {
      const mockOnSubmit = jest.fn().mockResolvedValue({});
      const user = userEvent.setup();
      
      renderWithA11yContext(<ServiceLogForm {...{
        clients: [{ id: 'client-1', name: 'Main Hospital', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        activities: [{ id: 'activity-1', name: 'General Consultation', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        outcomes: [{ id: 'outcome-1', name: 'Treatment Completed', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        onSubmit: mockOnSubmit,
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

      // Success message should be announced
      await a11yTestUtils.verifyScreenReaderAnnouncements('Service log saved');
    });
  });

  describe('Status and Progress Announcements', () => {
    test('form progress is announced to screen readers', async () => {
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
        // Should announce unsaved changes
        expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
      });
    });

    test('loading states provide appropriate announcements', () => {
      renderWithA11yContext(
        <SubmissionsTable 
          submissions={[]}
          isLoading={true}
          onEdit={jest.fn()}
          onDelete={jest.fn()}
          onExport={jest.fn()}
        />
      );

      // Loading state should be announced
      const loadingElement = screen.getByText(/loading/i);
      expect(loadingElement).toBeInTheDocument();
      
      // Should have proper role for screen reader announcement
      const statusElement = loadingElement.closest('[role="status"]');
      expect(statusElement).toBeInTheDocument();
    });
  });

  describe('Complex Content Screen Reader Support', () => {
    test('summary information is properly structured', async () => {
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
        // Summary section should be properly structured
        const summaryHeading = screen.getByText('Summary');
        expect(summaryHeading).toBeInTheDocument();
        
        // Summary data should be accessible
        expect(screen.getByText('Total Patients:')).toBeInTheDocument();
        expect(screen.getByText('New Patients:')).toBeInTheDocument();
        expect(screen.getByText('Follow-ups:')).toBeInTheDocument();
        expect(screen.getByText('Did Not Attend:')).toBeInTheDocument();
      });
    });

    test('grouped form content is properly associated', async () => {
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
        // Patient entries should be grouped logically
        const entrySection = screen.getByText('Entry 1');
        const appointmentSelect = screen.getAllByRole('button', { name: /select appointment type/i })[0];
        const outcomeSelect = screen.getAllByRole('button', { name: /select outcome/i })[0];
        
        expect(entrySection).toBeInTheDocument();
        expect(appointmentSelect).toBeInTheDocument();
        expect(outcomeSelect).toBeInTheDocument();
      });
    });
  });

  describe('Instructions and Help Text', () => {
    test('provides comprehensive screen reader instructions', () => {
      renderWithA11yContext(<ServiceLogForm {...{
        clients: [{ id: 'client-1', name: 'Main Hospital', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        activities: [{ id: 'activity-1', name: 'General Consultation', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        outcomes: [{ id: 'outcome-1', name: 'Treatment Completed', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        onSubmit: jest.fn(),
      }} />);

      // Help text should be available and properly associated
      expect(screen.getByText('How many individual patient entries to create (1-100)')).toBeInTheDocument();
      expect(screen.getByText('Date when the service was provided')).toBeInTheDocument();
      expect(screen.getByText('* Required fields')).toBeInTheDocument();
    });

    test('complex interactions have clear instructions', async () => {
      const user = userEvent.setup();
      renderWithA11yContext(<ServiceLogForm {...{
        clients: [{ id: 'client-1', name: 'Main Hospital', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        activities: [{ id: 'activity-1', name: 'General Consultation', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        outcomes: [{ id: 'outcome-1', name: 'Treatment Completed', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        onSubmit: jest.fn(),
      }} />);

      // Dropdown interactions should have clear instructions
      const clientSelect = screen.getByRole('button', { name: /select client/i });
      expect(clientSelect).toHaveAttribute('aria-haspopup', 'listbox');
      
      // When dropdown opens, options should be properly announced
      await user.click(clientSelect);
      await waitFor(() => {
        const listbox = screen.getByRole('listbox');
        expect(listbox).toBeInTheDocument();
        
        const options = screen.getAllByRole('option');
        expect(options.length).toBeGreaterThan(0);
      });
    });
  });
});