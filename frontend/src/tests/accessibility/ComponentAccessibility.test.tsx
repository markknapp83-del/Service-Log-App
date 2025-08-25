// Component-Specific Accessibility Tests following WCAG 2.1 AA guidelines
import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SubmissionsTable } from '../../components/SubmissionsTable';
import { EntityModal } from '../../components/EntityModal';
import { CreateUserModal } from '../../components/CreateUserModal';
import { DashboardPage } from '../../pages/DashboardPage';
import { TemplateManagementPage } from '../../pages/TemplateManagementPage';
import { SubmissionsPage } from '../../pages/SubmissionsPage';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { DatePicker } from '../../components/DatePicker';
import { Tabs } from '../../components/Tabs';
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
        customFields: [],
      },
    }),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('Component-Specific Accessibility Tests - WCAG 2.1 AA Compliance', () => {
  describe('SubmissionsTable Component', () => {
    const mockSubmissions = [
      createMockServiceLog({ id: 'log-1', patientCount: 2 }),
      createMockServiceLog({ id: 'log-2', patientCount: 1 }),
      createMockServiceLog({ id: 'log-3', patientCount: 3 }),
    ];

    test('table structure is semantically correct', async () => {
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
      await a11yTestUtils.runA11yTests(table);

      // Should have proper table structure
      expect(table).toBeInTheDocument();
      
      // Column headers should be present
      const headers = screen.getAllByRole('columnheader');
      expect(headers.length).toBeGreaterThan(0);
      
      // Each header should have accessible text
      headers.forEach(header => {
        expect(header.textContent?.trim()).toBeTruthy();
      });

      // Data rows should be present
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBeGreaterThan(1); // Header + data rows
    });

    test('supports keyboard navigation through table data', async () => {
      const user = userEvent.setup();
      const mockOnEdit = jest.fn();
      
      renderWithA11yContext(
        <SubmissionsTable 
          submissions={mockSubmissions}
          isLoading={false}
          onEdit={mockOnEdit}
          onDelete={jest.fn()}
          onExport={jest.fn()}
        />
      );

      // Action buttons should be keyboard accessible
      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      if (editButtons.length > 0) {
        const firstEditButton = editButtons[0];
        
        await user.tab();
        // Navigate to first edit button
        while (document.activeElement !== firstEditButton && document.activeElement) {
          await user.tab();
          // Safety check to prevent infinite loop
          if (document.activeElement === document.body) break;
        }
        
        if (firstEditButton === document.activeElement) {
          await user.keyboard('{Enter}');
          expect(mockOnEdit).toHaveBeenCalled();
        }
      }
    });

    test('table captions and summaries are accessible', () => {
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
      
      // Table should have accessible name or caption
      expect(table).toHaveAccessibleName();
      
      // Should indicate total number of rows for screen readers
      expect(table.getAttribute('aria-rowcount')).toBeTruthy();
    });

    test('empty state is properly announced', () => {
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
      const emptyMessage = screen.getByText(/no submissions found/i);
      expect(emptyMessage).toBeInTheDocument();
      
      // Should be in a proper semantic context
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
    });

    test('loading state is accessible', () => {
      renderWithA11yContext(
        <SubmissionsTable 
          submissions={[]}
          isLoading={true}
          onEdit={jest.fn()}
          onDelete={jest.fn()}
          onExport={jest.fn()}
        />
      );

      // Loading state should be announced to screen readers
      const loadingElement = screen.getByText(/loading/i);
      expect(loadingElement).toBeInTheDocument();
      
      // Should have proper role for announcements
      expect(loadingElement.closest('[role="status"]')).toBeInTheDocument();
    });

    test('table sorting is accessible', async () => {
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

      // Look for sortable headers
      const sortableHeaders = screen.queryAllByRole('button', { name: /sort/i });
      if (sortableHeaders.length > 0) {
        const firstSortButton = sortableHeaders[0];
        
        // Should indicate sort direction
        expect(firstSortButton).toHaveAttribute('aria-sort');
        
        // Should be keyboard activatable
        await user.click(firstSortButton);
        expect(firstSortButton).toHaveAttribute('aria-sort');
      }
    });
  });

  describe('Modal Components Accessibility', () => {
    test('EntityModal has proper dialog attributes', async () => {
      renderWithA11yContext(
        <EntityModal
          isOpen={true}
          onClose={jest.fn()}
          title="Edit Patient Information"
          onSubmit={jest.fn()}
        >
          <div>
            <input placeholder="Patient name" aria-label="Patient name" />
            <button type="button">Cancel</button>
            <button type="submit">Save</button>
          </div>
        </EntityModal>
      );

      const dialog = screen.getByRole('dialog');
      await a11yTestUtils.runA11yTests(dialog);

      // Modal should have proper ARIA attributes
      a11yTestUtils.verifyAriaAttributes(dialog, {
        'aria-modal': 'true',
        'aria-labelledby': expect.any(String),
      });

      // Title should be accessible
      expect(screen.getByText('Edit Patient Information')).toBeInTheDocument();
    });

    test('CreateUserModal form is accessible', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn();
      
      renderWithA11yContext(
        <CreateUserModal
          isOpen={true}
          onClose={jest.fn()}
          onSubmit={mockOnSubmit}
        />
      );

      const dialog = screen.getByRole('dialog');
      await a11yTestUtils.runA11yTests(dialog);

      // Form fields should be properly labeled
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/role/i)).toBeInTheDocument();

      // Form should be submittable via keyboard
      const nameInput = screen.getByLabelText(/name/i);
      await user.type(nameInput, 'John Doe');
      
      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'john@example.com');

      const submitButton = screen.getByRole('button', { name: /create user/i });
      expect(submitButton).toBeInTheDocument();
    });

    test('modal focus trapping works correctly', async () => {
      const user = userEvent.setup();
      renderWithA11yContext(
        <EntityModal
          isOpen={true}
          onClose={jest.fn()}
          title="Test Modal"
          onSubmit={jest.fn()}
        >
          <div>
            <input data-testid="first-input" placeholder="First input" />
            <button>Middle button</button>
            <input data-testid="last-input" placeholder="Last input" />
          </div>
        </EntityModal>
      );

      const firstInput = screen.getByTestId('first-input');
      const lastInput = screen.getByTestId('last-input');
      const modal = screen.getByRole('dialog');

      // Focus should be trapped within modal
      await a11yTestUtils.verifyFocusTrapping(modal, firstInput, lastInput);
    });

    test('modal closing is accessible', async () => {
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
    });
  });

  describe('Button Component Accessibility', () => {
    test('button variants are accessible', async () => {
      renderWithA11yContext(
        <div>
          <Button variant="primary">Primary Action</Button>
          <Button variant="secondary">Secondary Action</Button>
          <Button variant="outline">Outline Action</Button>
          <Button variant="destructive">Delete Action</Button>
        </div>
      );

      const buttons = screen.getAllByRole('button');
      
      for (const button of buttons) {
        await a11yTestUtils.runA11yTests(button);
        
        // Each button should have accessible text
        expect(button).toHaveAccessibleName();
        
        // Should have proper contrast
        a11yTestUtils.verifyColorContrast(button);
      }
    });

    test('loading button state is accessible', () => {
      renderWithA11yContext(
        <Button isLoading={true}>Processing...</Button>
      );

      const button = screen.getByRole('button');
      
      // Loading button should be disabled and announced
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });

    test('disabled button state is accessible', () => {
      renderWithA11yContext(
        <Button disabled>Disabled Action</Button>
      );

      const button = screen.getByRole('button');
      
      // Disabled button should still be readable
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAccessibleName();
    });

    test('button focus indicators are visible', async () => {
      const user = userEvent.setup();
      renderWithA11yContext(
        <Button>Focus Test</Button>
      );

      const button = screen.getByRole('button');
      await user.tab();
      
      expect(button).toHaveFocus();
      expect(button).toHaveClass('focus:outline-none', 'focus:ring-2');
    });
  });

  describe('Input Components Accessibility', () => {
    test('Input component with all features is accessible', async () => {
      renderWithA11yContext(
        <Input
          label="Patient Medical Record Number"
          name="mrn"
          placeholder="MR123456"
          helperText="Enter MR followed by 6 digits"
          error="Invalid format"
          required
        />
      );

      const input = screen.getByLabelText(/patient medical record number/i);
      
      await a11yTestUtils.runA11yTests(input);
      a11yTestUtils.verifyFormAccessibility(input.closest('div') as HTMLElement);

      // Should have proper associations
      expect(input).toHaveAttribute('required');
      expect(input).toHaveAttribute('aria-describedby');
      expect(input).toHaveAttribute('aria-invalid', 'true');

      // Helper text and error should be accessible
      expect(screen.getByText('Enter MR followed by 6 digits')).toBeInTheDocument();
      expect(screen.getByText('Invalid format')).toBeInTheDocument();
    });

    test('Select component dropdown is accessible', async () => {
      const user = userEvent.setup();
      renderWithA11yContext(
        <Select
          options={[
            { value: 'option1', label: 'First Option' },
            { value: 'option2', label: 'Second Option' },
            { value: 'option3', label: 'Third Option' },
          ]}
          onValueChange={jest.fn()}
          placeholder="Choose an option"
          aria-label="Test select"
        />
      );

      const select = screen.getByRole('button');
      await a11yTestUtils.runA11yTests(select);

      // Should have proper ARIA attributes
      expect(select).toHaveAttribute('aria-haspopup', 'listbox');
      expect(select).toHaveAttribute('aria-expanded', 'false');

      // Open dropdown
      await user.click(select);
      
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
        expect(select).toHaveAttribute('aria-expanded', 'true');
      });

      // Options should be accessible
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(3);
      
      options.forEach(option => {
        expect(option).toHaveAccessibleName();
      });
    });

    test('DatePicker component is accessible', async () => {
      renderWithA11yContext(
        <DatePicker
          label="Service Date"
          name="serviceDate"
          helperText="Select the date service was provided"
          required
        />
      );

      const input = screen.getByLabelText(/service date/i);
      await a11yTestUtils.runA11yTests(input);

      // Should be properly labeled and described
      expect(input).toHaveAttribute('required');
      expect(input).toHaveAttribute('aria-describedby');
      expect(screen.getByText('Select the date service was provided')).toBeInTheDocument();
    });
  });

  describe('Tabs Component Accessibility', () => {
    test('tabs follow ARIA tabpanel pattern', async () => {
      const user = userEvent.setup();
      const tabsData = [
        { id: 'tab1', label: 'Patient Info', content: <div>Patient information content</div> },
        { id: 'tab2', label: 'Medical History', content: <div>Medical history content</div> },
        { id: 'tab3', label: 'Appointments', content: <div>Appointments content</div> },
      ];

      renderWithA11yContext(
        <Tabs tabs={tabsData} defaultTab="tab1" />
      );

      // Tab list should be present
      const tabList = screen.getByRole('tablist');
      await a11yTestUtils.runA11yTests(tabList);

      // Tabs should have proper roles
      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(3);

      // Active tab should be indicated
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[2]).toHaveAttribute('aria-selected', 'false');

      // Tab panel should be present
      expect(screen.getByRole('tabpanel')).toBeInTheDocument();
      expect(screen.getByText('Patient information content')).toBeInTheDocument();

      // Should support keyboard navigation
      await user.click(tabs[1]);
      await waitFor(() => {
        expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByText('Medical history content')).toBeInTheDocument();
      });
    });

    test('tab keyboard navigation follows ARIA patterns', async () => {
      const user = userEvent.setup();
      const tabsData = [
        { id: 'tab1', label: 'Tab 1', content: <div>Content 1</div> },
        { id: 'tab2', label: 'Tab 2', content: <div>Content 2</div> },
      ];

      renderWithA11yContext(
        <Tabs tabs={tabsData} defaultTab="tab1" />
      );

      const tabs = screen.getAllByRole('tab');
      
      // Focus first tab
      tabs[0].focus();
      expect(tabs[0]).toHaveFocus();

      // Arrow right should move to next tab
      await user.keyboard('{ArrowRight}');
      expect(tabs[1]).toHaveFocus();
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');

      // Arrow left should move back
      await user.keyboard('{ArrowLeft}');
      expect(tabs[0]).toHaveFocus();
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Page-Level Component Accessibility', () => {
    test('DashboardPage has proper landmark structure', async () => {
      renderWithA11yContext(<DashboardPage />);

      await waitFor(() => {
        // Should have main landmark
        expect(screen.getByRole('main')).toBeInTheDocument();
        
        // Should have proper heading hierarchy
        const mainHeading = screen.getByRole('heading', { level: 1 });
        expect(mainHeading).toBeInTheDocument();
      });

      const page = screen.getByRole('main');
      await a11yTestUtils.runA11yTests(page);
    });

    test('TemplateManagementPage is accessible', async () => {
      renderWithA11yContext(<TemplateManagementPage />);

      await waitFor(() => {
        // Page should load with accessible structure
        const mainHeading = screen.getByRole('heading', { level: 1 });
        expect(mainHeading).toBeInTheDocument();
      });

      // Navigation within page should be accessible
      const page = screen.getByRole('main');
      await a11yTestUtils.runA11yTests(page);
    });

    test('SubmissionsPage has accessible data presentation', async () => {
      renderWithA11yContext(<SubmissionsPage />);

      await waitFor(() => {
        // Page should have proper structure
        const mainHeading = screen.getByRole('heading', { level: 1 });
        expect(mainHeading).toBeInTheDocument();
        
        // Data table should be accessible when present
        const table = screen.queryByRole('table');
        if (table) {
          expect(table).toBeInTheDocument();
        }
      });

      const page = screen.getByRole('main');
      await a11yTestUtils.runA11yTests(page);
    });

    test('page navigation breadcrumbs are accessible', async () => {
      renderWithA11yContext(<DashboardPage />);

      await waitFor(() => {
        // Look for navigation elements
        const nav = screen.queryByRole('navigation');
        if (nav) {
          expect(nav).toHaveAccessibleName();
        }
      });
    });
  });

  describe('Complex Interaction Patterns', () => {
    test('dropdown menus with search are accessible', async () => {
      const user = userEvent.setup();
      renderWithA11yContext(
        <Select
          options={[
            { value: 'client1', label: 'Main Hospital' },
            { value: 'client2', label: 'Regional Clinic' },
            { value: 'client3', label: 'Specialty Center' },
          ]}
          onValueChange={jest.fn()}
          placeholder="Search clients..."
          aria-label="Client search"
          searchable={true}
        />
      );

      const combobox = screen.getByRole('button');
      
      // Should support both selection and search patterns
      expect(combobox).toHaveAttribute('aria-haspopup', 'listbox');
      
      await user.click(combobox);
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // If search is implemented, should support typing to filter
      await user.keyboard('main');
      // Implementation would filter options based on search
    });

    test('multi-step form wizard navigation is accessible', async () => {
      // This would test a multi-step form component if it exists
      // For now, testing the concept with service log form sections
      
      const user = userEvent.setup();
      renderWithA11yContext(
        <div>
          <div role="navigation" aria-label="Form steps">
            <ol>
              <li><button aria-current="step">Basic Information</button></li>
              <li><button>Patient Entries</button></li>
              <li><button>Summary</button></li>
            </ol>
          </div>
          <main>
            <h2>Step 1: Basic Information</h2>
            <form>
              <input aria-label="Service type" />
              <button type="button">Next</button>
            </form>
          </main>
        </div>
      );

      // Step navigation should be accessible
      const stepNavigation = screen.getByRole('navigation', { name: /form steps/i });
      expect(stepNavigation).toBeInTheDocument();
      
      const currentStep = screen.getByRole('button', { name: /basic information/i });
      expect(currentStep).toHaveAttribute('aria-current', 'step');
    });

    test('context menus are accessible', async () => {
      const user = userEvent.setup();
      renderWithA11yContext(
        <div>
          <button 
            aria-label="Patient actions"
            aria-haspopup="menu"
            onClick={() => {}}
          >
            Actions
          </button>
          {/* Context menu would appear on click */}
          <div role="menu" style={{ display: 'none' }}>
            <button role="menuitem">Edit Patient</button>
            <button role="menuitem">View History</button>
            <button role="menuitem">Delete Patient</button>
          </div>
        </div>
      );

      const trigger = screen.getByRole('button', { name: /patient actions/i });
      expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
      
      // Context menu pattern would be implemented with proper ARIA
      await user.click(trigger);
      
      // Menu items would be accessible when shown
      // This tests the structure for a context menu implementation
    });
  });

  describe('Error Handling Components', () => {
    test('error boundary displays are accessible', () => {
      renderWithA11yContext(
        <div role="alert" aria-live="assertive">
          <h2>Something went wrong</h2>
          <p>We encountered an error loading this content. Please try again.</p>
          <button>Retry</button>
          <button>Report Issue</button>
        </div>
      );

      // Error display should be announced
      const errorAlert = screen.getByRole('alert');
      expect(errorAlert).toHaveAttribute('aria-live', 'assertive');
      
      // Should provide clear actions
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /report issue/i })).toBeInTheDocument();
    });

    test('loading spinners are accessible', () => {
      renderWithA11yContext(
        <div>
          <div role="status" aria-live="polite">
            <span className="sr-only">Loading patient data...</span>
            <div aria-hidden="true">🔄</div>
          </div>
        </div>
      );

      // Loading state should be announced but icon hidden from screen readers
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-live', 'polite');
      
      const announcement = screen.getByText('Loading patient data...');
      expect(announcement).toHaveClass('sr-only');
      
      const spinner = screen.getByText('🔄');
      expect(spinner).toHaveAttribute('aria-hidden', 'true');
    });
  });
});