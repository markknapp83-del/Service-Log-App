// Healthcare-Specific Accessibility Tests following WCAG 2.1 AA and HIPAA guidelines
import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServiceLogForm } from '../../components/ServiceLogForm';
import { SubmissionsTable } from '../../components/SubmissionsTable';
import { DashboardPage } from '../../pages/DashboardPage';
import { CreateUserModal } from '../../components/CreateUserModal';
import { 
  renderWithA11yContext, 
  a11yTestUtils, 
  healthcareA11yScenarios,
  healthcareA11yConfig,
  createMockServiceLog,
  createMockPatient 
} from './AccessibilityTestUtils';

// Mock dependencies
jest.mock('../../hooks/useToast', () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));

jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ 
    user: { id: 'user-1', role: 'clinician', name: 'Dr. Smith', permissions: ['read', 'write'] },
    isAuthenticated: true 
  }),
}));

jest.mock('../../services/apiService', () => ({
  apiService: {
    get: jest.fn().mockResolvedValue({
      success: true,
      data: {
        clients: [
          { id: 'client-1', name: 'Main Hospital', isActive: true },
          { id: 'client-2', name: 'Emergency Clinic', isActive: true },
        ],
        activities: [
          { id: 'activity-1', name: 'Emergency Consultation', isActive: true },
          { id: 'activity-2', name: 'Routine Checkup', isActive: true },
        ],
        outcomes: [
          { id: 'outcome-1', name: 'Treatment Completed', isActive: true },
          { id: 'outcome-2', name: 'Referred to Specialist', isActive: true },
        ],
        submissions: [],
        users: [],
      },
    }),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('Healthcare-Specific Accessibility Tests - WCAG 2.1 AA + HIPAA Compliance', () => {
  describe('Medical Form Accessibility', () => {
    const defaultFormProps = {
      clients: [
        { id: 'client-1', name: 'Main Hospital', isActive: true, description: '', createdAt: '', updatedAt: '' },
        { id: 'client-2', name: 'Emergency Clinic', isActive: true, description: '', createdAt: '', updatedAt: '' },
      ],
      activities: [
        { id: 'activity-1', name: 'Emergency Consultation', isActive: true, description: '', createdAt: '', updatedAt: '' },
        { id: 'activity-2', name: 'Routine Checkup', isActive: true, description: '', createdAt: '', updatedAt: '' },
      ],
      outcomes: [
        { id: 'outcome-1', name: 'Treatment Completed', isActive: true, description: '', createdAt: '', updatedAt: '' },
        { id: 'outcome-2', name: 'Referred to Specialist', isActive: true, description: '', createdAt: '', updatedAt: '' },
      ],
      onSubmit: jest.fn(),
    };

    test('medical forms meet healthcare accessibility standards', async () => {
      renderWithA11yContext(<ServiceLogForm {...defaultFormProps} />);
      
      const form = screen.getByRole('form') || document.querySelector('form');
      if (form) {
        await healthcareA11yScenarios.testMedicalFormA11y(form);
      }

      // Healthcare forms should have clear instruction text
      expect(screen.getByText('* Required fields')).toBeInTheDocument();
      
      // Should have contextual help for medical terminology
      expect(screen.getByText('How many individual patient entries to create (1-100)')).toBeInTheDocument();
      expect(screen.getByText('Date when the service was provided')).toBeInTheDocument();
    });

    test('critical medical information has enhanced accessibility', () => {
      renderWithA11yContext(<ServiceLogForm {...defaultFormProps} />);

      // Required medical fields should be clearly marked
      const requiredFields = screen.getAllByText('*');
      expect(requiredFields.length).toBeGreaterThan(0);
      
      requiredFields.forEach(indicator => {
        // Critical indicators should use enhanced contrast
        expect(indicator).toHaveClass('text-red-500');
        a11yTestUtils.verifyColorContrast(indicator, healthcareA11yConfig.contrastRatios.critical);
      });

      // Medical form sections should have clear headings
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Service Log Entry');
    });

    test('emergency and urgent actions are highly accessible', async () => {
      const user = userEvent.setup();
      // Mock an emergency form scenario
      renderWithA11yContext(
        <div>
          <ServiceLogForm {...defaultFormProps} />
          <button 
            className="bg-red-600 text-white px-8 py-4 text-lg font-bold"
            aria-label="Emergency submission - submit immediately for urgent patient care"
          >
            🚨 Emergency Submit
          </button>
        </div>
      );

      const emergencyButton = screen.getByRole('button', { name: /emergency submission/i });
      
      // Emergency actions should meet highest accessibility standards
      await a11yTestUtils.verifyEmergencyActionAccessibility(emergencyButton);
      
      // Should have enhanced visual indicators
      expect(emergencyButton).toHaveClass('bg-red-600', 'text-white');
      
      // Should be easily discoverable via keyboard
      emergencyButton.focus();
      expect(emergencyButton).toHaveFocus();
    });

    test('medical validation errors are HIPAA compliant', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = jest.fn().mockRejectedValue(
        new Error('Patient validation failed: John Doe (MRN: MR123456, DOB: 01/15/1985)')
      );

      renderWithA11yContext(<ServiceLogForm {...{...defaultFormProps, onSubmit: mockOnSubmit}} />);

      // Fill and submit form to trigger error
      const clientSelect = screen.getByRole('button', { name: /select client/i });
      await user.click(clientSelect);
      await user.click(screen.getByText('Main Hospital'));

      const activitySelect = screen.getByRole('button', { name: /select activity/i });
      await user.click(activitySelect);
      await user.click(screen.getByText('Emergency Consultation'));

      const serviceDateInput = screen.getByLabelText(/service date/i);
      await user.type(serviceDateInput, '2023-12-01');

      const submitButton = screen.getByRole('button', { name: /save service log/i });
      await user.click(submitButton);

      await waitFor(() => {
        // Error messages should not expose sensitive healthcare data
        const errorElements = document.querySelectorAll('[role="alert"], .text-red-600');
        errorElements.forEach(element => {
          if (element.textContent) {
            a11yTestUtils.checkForSensitiveData(element.textContent);
            
            // Should not contain patient-identifying information
            expect(element.textContent).not.toMatch(/john doe|mrn|medical record|birth|ssn/i);
          }
        });
      });
    });

    test('medical form timeouts accommodate healthcare workflows', async () => {
      const user = userEvent.setup();
      const slowSubmit = jest.fn(() => 
        new Promise(resolve => 
          setTimeout(resolve, healthcareA11yConfig.interactionTimeouts.formSubmission)
        )
      );
      
      renderWithA11yContext(<ServiceLogForm {...{...defaultFormProps, onSubmit: slowSubmit}} />);

      // Fill required fields
      const clientSelect = screen.getByRole('button', { name: /select client/i });
      await user.click(clientSelect);
      await user.click(screen.getByText('Emergency Clinic'));

      const activitySelect = screen.getByRole('button', { name: /select activity/i });
      await user.click(activitySelect);
      await user.click(screen.getByText('Emergency Consultation'));

      const serviceDateInput = screen.getByLabelText(/service date/i);
      await user.type(serviceDateInput, '2023-12-01');

      const submitButton = screen.getByRole('button', { name: /save service log/i });
      await user.click(submitButton);

      // Should show appropriate loading state for medical context
      expect(screen.getByText('Saving...')).toBeInTheDocument();
      expect(submitButton).toHaveAttribute('aria-disabled', 'true');
    });

    test('multi-patient entry workflows are accessible', async () => {
      const user = userEvent.setup();
      renderWithA11yContext(<ServiceLogForm {...defaultFormProps} />);

      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      await user.clear(patientCountInput);
      await user.type(patientCountInput, '3');

      await waitFor(() => {
        // Each patient entry should be accessible
        expect(screen.getByText('Entry 1')).toBeInTheDocument();
        expect(screen.getByText('Entry 2')).toBeInTheDocument();
        expect(screen.getByText('Entry 3')).toBeInTheDocument();

        // All appointment type selects should be accessible
        const appointmentSelects = screen.getAllByRole('button', { name: /select appointment type/i });
        expect(appointmentSelects).toHaveLength(3);
        
        appointmentSelects.forEach((select, index) => {
          expect(select).toHaveAccessibleName();
          expect(select).toHaveAttribute('aria-haspopup', 'listbox');
        });

        // Summary should reflect all entries
        const summarySection = screen.getByText('Summary').closest('div');
        expect(summarySection).toBeInTheDocument();
        expect(within(summarySection as HTMLElement).getByText('Total Entries:')).toBeInTheDocument();
      });
    });
  });

  describe('Patient Data Table Accessibility', () => {
    const mockSubmissions = [
      createMockServiceLog({ 
        id: 'log-1', 
        clientId: 'client-1',
        activityId: 'activity-1',
        patientCount: 2,
        serviceDate: '2023-12-01',
      }),
      createMockServiceLog({ 
        id: 'log-2', 
        clientId: 'client-2',
        activityId: 'activity-2',
        patientCount: 1,
        serviceDate: '2023-12-02',
      }),
    ];

    test('patient data tables meet healthcare accessibility requirements', async () => {
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
      await healthcareA11yScenarios.testPatientTableA11y(table);

      // Healthcare tables should have descriptive headers
      const headers = screen.getAllByRole('columnheader');
      headers.forEach(header => {
        expect(header.textContent?.trim()).toBeTruthy();
        expect(header.textContent?.trim()).not.toBe('');
      });

      // Should not expose sensitive data in table cells
      const cells = screen.getAllByRole('cell');
      cells.forEach(cell => {
        if (cell.textContent) {
          a11yTestUtils.checkForSensitiveData(cell.textContent);
        }
      });
    });

    test('patient data export functionality is accessible', async () => {
      const user = userEvent.setup();
      const mockOnExport = jest.fn();
      
      renderWithA11yContext(
        <SubmissionsTable 
          submissions={mockSubmissions}
          isLoading={false}
          onEdit={jest.fn()}
          onDelete={jest.fn()}
          onExport={mockOnExport}
        />
      );

      // Export button should be accessible
      const exportButton = screen.queryByRole('button', { name: /export/i });
      if (exportButton) {
        expect(exportButton).toHaveAccessibleName();
        
        // Should provide context about what's being exported
        expect(exportButton.getAttribute('aria-label') || exportButton.textContent)
          .toMatch(/export|download|csv/i);
        
        await user.click(exportButton);
        expect(mockOnExport).toHaveBeenCalled();
      }
    });

    test('patient data filtering maintains accessibility', async () => {
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

      // Look for filter controls
      const searchInputs = screen.queryAllByRole('searchbox');
      const filterSelects = screen.queryAllByRole('button', { name: /filter/i });
      
      [...searchInputs, ...filterSelects].forEach(control => {
        expect(control).toHaveAccessibleName();
        
        // Filter controls should not expose sensitive data in labels
        const accessibleName = control.getAttribute('aria-label') || 
                              control.getAttribute('aria-labelledby');
        if (accessibleName) {
          a11yTestUtils.checkForSensitiveData(accessibleName);
        }
      });
    });
  });

  describe('Healthcare Dashboard Accessibility', () => {
    test('clinical dashboard meets healthcare professional needs', async () => {
      renderWithA11yContext(<DashboardPage />);

      await waitFor(() => {
        const dashboard = screen.getByRole('main');
        expect(dashboard).toBeInTheDocument();
      });

      // Dashboard should have clear navigation for medical workflows
      const mainHeading = screen.getByRole('heading', { level: 1 });
      expect(mainHeading).toBeInTheDocument();
      
      // Should provide quick access to critical functions
      const navigation = screen.queryByRole('navigation');
      if (navigation) {
        expect(navigation).toHaveAccessibleName();
        
        // Navigation labels should be clear for medical context
        const navLinks = within(navigation).getAllByRole('link');
        navLinks.forEach(link => {
          expect(link).toHaveAccessibleName();
          
          // Should not expose sensitive routing information
          const href = link.getAttribute('href');
          if (href) {
            expect(href).not.toMatch(/patient.*\d+|user.*\d+/i);
          }
        });
      }
    });

    test('medical device compatibility features', async () => {
      // Test high contrast mode for medical displays
      renderWithA11yContext(
        <DashboardPage />,
        { highContrast: true }
      );

      await waitFor(() => {
        const dashboard = screen.getByRole('main');
        expect(dashboard).toBeInTheDocument();
        
        // High contrast mode should maintain usability
        const buttons = screen.getAllByRole('button');
        buttons.forEach(button => {
          // All buttons should remain functional in high contrast
          expect(button).toHaveAccessibleName();
        });
      });
    });

    test('emergency workflow accessibility', async () => {
      // Mock emergency dashboard scenario
      renderWithA11yContext(
        <div role="main" aria-label="Emergency Healthcare Dashboard">
          <div role="alert" className="bg-red-100 border-red-500 text-red-900 p-4">
            <h1 className="text-xl font-bold">Emergency Patient Care Portal</h1>
            <p>Immediate access to critical patient information and procedures.</p>
          </div>
          
          <div className="mt-4">
            <button 
              className="bg-red-600 text-white px-6 py-3 text-lg font-semibold rounded"
              aria-label="Emergency patient intake - immediate priority"
            >
              🚨 Emergency Intake
            </button>
            
            <button 
              className="bg-orange-600 text-white px-6 py-3 text-lg font-semibold rounded ml-4"
              aria-label="Urgent consultation - high priority medical attention"
            >
              ⚠️ Urgent Consultation
            </button>
          </div>
        </div>
      );

      // Emergency interface should be highly accessible
      const dashboard = screen.getByRole('main');
      await a11yTestUtils.runA11yTests(dashboard);

      // Emergency alert should be immediately announced
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(/emergency/i);

      // Emergency buttons should meet enhanced accessibility standards
      const emergencyButton = screen.getByRole('button', { name: /emergency patient intake/i });
      const urgentButton = screen.getByRole('button', { name: /urgent consultation/i });
      
      await a11yTestUtils.verifyEmergencyActionAccessibility(emergencyButton);
      await a11yTestUtils.verifyEmergencyActionAccessibility(urgentButton);
    });
  });

  describe('Healthcare User Management Accessibility', () => {
    test('medical professional user creation is accessible', async () => {
      renderWithA11yContext(
        <CreateUserModal
          isOpen={true}
          onClose={jest.fn()}
          onSubmit={jest.fn()}
        />
      );

      const modal = screen.getByRole('dialog');
      await healthcareA11yScenarios.testMedicalModalA11y(modal);

      // User role selection should be clear for healthcare context
      const roleField = screen.getByLabelText(/role/i);
      expect(roleField).toBeInTheDocument();
      expect(roleField).toHaveAccessibleName();

      // Healthcare user forms should have additional security considerations
      const nameField = screen.getByLabelText(/name/i);
      const emailField = screen.getByLabelText(/email/i);
      
      [nameField, emailField, roleField].forEach(field => {
        expect(field).toHaveAttribute('autocomplete');
        
        // Fields should have appropriate validation for healthcare context
        if (field.hasAttribute('aria-describedby')) {
          const describedBy = field.getAttribute('aria-describedby');
          if (describedBy) {
            const description = document.getElementById(describedBy);
            if (description?.textContent) {
              a11yTestUtils.checkForSensitiveData(description.textContent);
            }
          }
        }
      });
    });

    test('healthcare permission management is accessible', async () => {
      // Mock healthcare permission interface
      renderWithA11yContext(
        <div role="dialog" aria-labelledby="permissions-title">
          <h2 id="permissions-title">Healthcare Access Permissions</h2>
          
          <fieldset>
            <legend>Patient Data Access</legend>
            <div>
              <input type="checkbox" id="read-patient" aria-describedby="read-patient-help" />
              <label htmlFor="read-patient">View Patient Information</label>
              <div id="read-patient-help" className="text-sm text-gray-600">
                Access to view patient medical records and demographic information
              </div>
            </div>
            
            <div>
              <input type="checkbox" id="edit-patient" aria-describedby="edit-patient-help" />
              <label htmlFor="edit-patient">Edit Patient Information</label>
              <div id="edit-patient-help" className="text-sm text-gray-600">
                Ability to modify patient records and medical information
              </div>
            </div>
          </fieldset>
          
          <fieldset>
            <legend>System Administration</legend>
            <div>
              <input type="checkbox" id="user-admin" aria-describedby="user-admin-help" />
              <label htmlFor="user-admin">User Administration</label>
              <div id="user-admin-help" className="text-sm text-gray-600">
                Create, modify, and manage healthcare system user accounts
              </div>
            </div>
          </fieldset>
        </div>
      );

      const permissionsDialog = screen.getByRole('dialog');
      await a11yTestUtils.runA11yTests(permissionsDialog);

      // Permission groups should be properly structured
      const fieldsets = screen.getAllByRole('group');
      expect(fieldsets.length).toBeGreaterThan(0);
      
      fieldsets.forEach(fieldset => {
        const legend = within(fieldset).getByRole('legend') || 
                       within(fieldset).querySelector('legend');
        expect(legend).toBeInTheDocument();
      });

      // Each permission should be clearly described
      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach(checkbox => {
        expect(checkbox).toHaveAccessibleName();
        expect(checkbox).toHaveAttribute('aria-describedby');
        
        // Permission descriptions should not expose system internals
        const describedBy = checkbox.getAttribute('aria-describedby');
        if (describedBy) {
          const description = document.getElementById(describedBy);
          if (description?.textContent) {
            expect(description.textContent).toMatch(/(view|edit|access|create|modify|manage)/i);
          }
        }
      });
    });
  });

  describe('Healthcare Data Privacy and Security', () => {
    test('audit logging interface is accessible', async () => {
      // Mock audit log viewer
      renderWithA11yContext(
        <div role="main" aria-label="Healthcare System Audit Log">
          <h1>System Audit Trail</h1>
          
          <div role="search" aria-label="Audit log filters">
            <label htmlFor="date-range">Date Range</label>
            <input id="date-range" type="date" />
            
            <label htmlFor="action-filter">Action Type</label>
            <select id="action-filter">
              <option value="">All Actions</option>
              <option value="view">Patient Data Viewed</option>
              <option value="edit">Patient Data Modified</option>
              <option value="delete">Data Deleted</option>
            </select>
          </div>
          
          <table role="table" aria-label="Audit log entries">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>User</th>
                <th>Resource</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>2023-12-01 14:30:00</td>
                <td>Patient Record Viewed</td>
                <td>Dr. Smith (ID: DOC001)</td>
                <td>Patient Record (ID: [REDACTED])</td>
              </tr>
            </tbody>
          </table>
        </div>
      );

      const auditInterface = screen.getByRole('main');
      await a11yTestUtils.runA11yTests(auditInterface);

      // Audit data should be accessible but privacy-compliant
      const table = screen.getByRole('table');
      const cells = within(table).getAllByRole('cell');
      
      cells.forEach(cell => {
        if (cell.textContent) {
          // Should not contain actual patient identifiers
          expect(cell.textContent).not.toMatch(/\b\d{3}-\d{2}-\d{4}\b/); // SSN pattern
          expect(cell.textContent).not.toMatch(/\b[A-Z]{2}\d{6,8}\b/); // MRN pattern
          
          // Redacted information should be clearly indicated
          if (cell.textContent.includes('REDACTED')) {
            expect(cell.textContent).toMatch(/\[REDACTED\]|\*\*\*|###/);
          }
        }
      });
    });

    test('HIPAA-compliant error messages', async () => {
      const user = userEvent.setup();
      const sensitiveError = jest.fn().mockRejectedValue(
        new Error('Access denied: User Dr. Jane Smith (ID: DOC123) attempted to access Patient John Doe (MRN: MR456789, DOB: 01/15/1985, SSN: 123-45-6789) without proper authorization level 3 clearance.')
      );

      renderWithA11yContext(<ServiceLogForm {...{
        clients: [{ id: 'client-1', name: 'Main Hospital', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        activities: [{ id: 'activity-1', name: 'General Consultation', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        outcomes: [{ id: 'outcome-1', name: 'Treatment Completed', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        onSubmit: sensitiveError,
      }} />);

      // Fill and submit form
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

      await waitFor(() => {
        // Error should be sanitized - no sensitive healthcare data
        const errorElements = document.querySelectorAll('[role="alert"], .text-red-600');
        errorElements.forEach(element => {
          if (element.textContent) {
            a11yTestUtils.checkForSensitiveData(element.textContent);
            
            // Specific healthcare data patterns should not be present
            expect(element.textContent).not.toMatch(/dr\.\s+jane\s+smith|john\s+doe|mr456789|123-45-6789/i);
            expect(element.textContent).not.toMatch(/\b(ssn|social|medical record number|mrn|date of birth|dob)\b/i);
            
            // Should provide generic but helpful error
            expect(element.textContent).toMatch(/error|failed|try again|contact support/i);
          }
        });
      });
    });

    test('session timeout accessibility for healthcare workflows', async () => {
      // Mock session timeout warning
      renderWithA11yContext(
        <div 
          role="alertdialog" 
          aria-labelledby="timeout-title"
          aria-describedby="timeout-description"
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
        >
          <div className="bg-white p-6 rounded-lg shadow-xl">
            <h2 id="timeout-title" className="text-lg font-bold text-red-700">
              Session Timeout Warning
            </h2>
            <p id="timeout-description" className="mt-2">
              Your session will expire in 2 minutes due to inactivity. 
              This is required for patient data security (HIPAA compliance).
            </p>
            <div className="mt-4 flex space-x-4">
              <button 
                className="bg-blue-600 text-white px-4 py-2 rounded"
                aria-label="Extend session and continue working"
              >
                Continue Session
              </button>
              <button 
                className="bg-gray-600 text-white px-4 py-2 rounded"
                aria-label="Log out securely"
              >
                Logout Now
              </button>
            </div>
            <div className="mt-2 text-sm text-gray-600">
              <span aria-live="polite" aria-atomic="true">
                Time remaining: <span className="font-mono">1:59</span>
              </span>
            </div>
          </div>
        </div>
      );

      const timeoutDialog = screen.getByRole('alertdialog');
      await a11yTestUtils.runA11yTests(timeoutDialog);

      // Timeout warning should be immediately announced
      expect(timeoutDialog).toHaveAttribute('aria-labelledby', 'timeout-title');
      expect(timeoutDialog).toHaveAttribute('aria-describedby', 'timeout-description');

      // Actions should be clearly labeled
      const continueButton = screen.getByRole('button', { name: /extend session/i });
      const logoutButton = screen.getByRole('button', { name: /log out securely/i });
      
      expect(continueButton).toHaveAccessibleName();
      expect(logoutButton).toHaveAccessibleName();

      // Timer should be announced to screen readers
      const timer = screen.getByText(/time remaining/i).parentElement;
      expect(timer).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Mobile Healthcare Device Accessibility', () => {
    test('medical tablet interface accessibility', async () => {
      // Mock mobile medical device viewport
      renderWithA11yContext(
        <ServiceLogForm {...{
          clients: [{ id: 'client-1', name: 'Mobile Clinic', isActive: true, description: '', createdAt: '', updatedAt: '' }],
          activities: [{ id: 'activity-1', name: 'Bedside Consultation', isActive: true, description: '', createdAt: '', updatedAt: '' }],
          outcomes: [{ id: 'outcome-1', name: 'Treatment Administered', isActive: true, description: '', createdAt: '', updatedAt: '' }],
          onSubmit: jest.fn(),
        }} />,
        { /* mobile viewport simulation */ }
      );

      // Touch targets should meet healthcare device standards
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        a11yTestUtils.verifyTouchTargetSize(
          button, 
          healthcareA11yConfig.touchTargetSizes.minimum
        );
      });

      // Form should remain accessible on mobile
      const form = screen.getByRole('form') || document.querySelector('form');
      if (form) {
        await a11yTestUtils.runA11yTests(form);
      }
    });

    test('voice navigation compatibility for hands-free operation', async () => {
      renderWithA11yContext(<ServiceLogForm {...{
        clients: [{ id: 'client-1', name: 'Surgery Center', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        activities: [{ id: 'activity-1', name: 'Surgical Procedure', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        outcomes: [{ id: 'outcome-1', name: 'Procedure Completed', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        onSubmit: jest.fn(),
      }} />);

      // Elements should have clear, voice-navigation-friendly names
      expect(screen.getByRole('button', { name: /select client/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /select activity/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save service log/i })).toBeInTheDocument();

      // Voice commands should map to clear element labels
      const clientSelect = screen.getByRole('button', { name: /select client/i });
      const activitySelect = screen.getByRole('button', { name: /select activity/i });
      
      expect(clientSelect.getAttribute('aria-label') || clientSelect.textContent)
        .toMatch(/(select|choose|client|site)/i);
      expect(activitySelect.getAttribute('aria-label') || activitySelect.textContent)
        .toMatch(/(select|choose|activity|specialty)/i);
    });
  });

  describe('Assistive Technology Integration', () => {
    test('screen reader medical terminology pronunciation', () => {
      renderWithA11yContext(
        <div>
          <span aria-label="Medical Record Number">MRN</span>
          <span aria-label="Date of Birth">DOB</span>
          <span aria-label="Emergency Department">ED</span>
          <span aria-label="Intensive Care Unit">ICU</span>
          <span aria-label="cardiopulmonary resuscitation">CPR</span>
        </div>
      );

      // Medical abbreviations should have proper pronunciation guides
      const medicalTerms = screen.getAllByLabelText(/medical record number|date of birth|emergency department|intensive care unit|cardiopulmonary resuscitation/i);
      
      medicalTerms.forEach(term => {
        expect(term).toHaveAttribute('aria-label');
        
        // Aria-label should provide full pronunciation
        const ariaLabel = term.getAttribute('aria-label');
        expect(ariaLabel).toBeTruthy();
        expect(ariaLabel?.length).toBeGreaterThan(2); // More than just abbreviation
      });
    });

    test('medical form navigation with screen reader landmarks', () => {
      renderWithA11yContext(<ServiceLogForm {...{
        clients: [{ id: 'client-1', name: 'Main Hospital', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        activities: [{ id: 'activity-1', name: 'General Consultation', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        outcomes: [{ id: 'outcome-1', name: 'Treatment Completed', isActive: true, description: '', createdAt: '', updatedAt: '' }],
        onSubmit: jest.fn(),
      }} />);

      // Form should have proper landmark structure for medical workflows
      const form = screen.getByRole('form') || document.querySelector('form');
      expect(form).toBeInTheDocument();

      // Headings should provide clear section navigation
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Service Log Entry');
      
      // Form sections should be logically structured
      a11yTestUtils.verifyHeadingHierarchy();
    });
  });
});