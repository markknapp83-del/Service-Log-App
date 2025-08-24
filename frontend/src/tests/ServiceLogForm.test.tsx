// ServiceLogForm comprehensive tests following React Testing Library documentation patterns
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServiceLogForm } from '../components/ServiceLogForm';
import { serviceLogFormSchema } from '../utils/validation';
import { Client, Activity, Outcome } from '../types';

// Mock hooks and services
jest.mock('../hooks/useToast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Test data factories following healthcare patterns
const createMockClient = (overrides: Partial<Client> = {}): Client => ({
  id: 'client-1',
  name: 'Main Hospital',
  description: 'Primary healthcare facility',
  isActive: true,
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z',
  ...overrides,
});

const createMockActivity = (overrides: Partial<Activity> = {}): Activity => ({
  id: 'activity-1',
  name: 'General Consultation',
  description: 'Standard patient consultation',
  isActive: true,
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z',
  ...overrides,
});

const createMockOutcome = (overrides: Partial<Outcome> = {}): Outcome => ({
  id: 'outcome-1',
  name: 'Treatment Completed',
  description: 'Patient treatment successfully completed',
  isActive: true,
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z',
  ...overrides,
});

const defaultProps = {
  clients: [
    createMockClient(),
    createMockClient({ id: 'client-2', name: 'Outpatient Clinic' }),
  ],
  activities: [
    createMockActivity(),
    createMockActivity({ id: 'activity-2', name: 'Emergency Care' }),
  ],
  outcomes: [
    createMockOutcome(),
    createMockOutcome({ id: 'outcome-2', name: 'Follow-up Required' }),
  ],
  onSubmit: jest.fn(),
  onCancel: jest.fn(),
};

describe('ServiceLogForm', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial Rendering', () => {
    test('renders form with all required fields', () => {
      render(<ServiceLogForm {...defaultProps} />);

      // Header
      expect(screen.getByText('Service Log Entry')).toBeInTheDocument();
      
      // Required fields
      expect(screen.getByText('Client/Site')).toBeInTheDocument();
      expect(screen.getByText('Activity/Specialty')).toBeInTheDocument();
      expect(screen.getByLabelText(/number of patient entries/i)).toBeInTheDocument();
      
      // Required indicators
      expect(screen.getAllByText('*')).toHaveLength(3); // Client, Activity, Patient Count
      
      // Actions
      expect(screen.getByText('Clear Form')).toBeInTheDocument();
      expect(screen.getByText('Save Service Log')).toBeInTheDocument();
    });

    test('initializes with default values', () => {
      render(<ServiceLogForm {...defaultProps} />);

      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      expect(patientCountInput).toHaveValue(1);
    });

    test('renders with initial data when provided', () => {
      const initialData = {
        clientId: 'client-1',
        activityId: 'activity-1',
        patientCount: 2,
        patientEntries: [
          {
            newPatients: 3,
            followupPatients: 2,
            dnaCount: 1,
            outcomeId: 'outcome-1',
          },
          {
            newPatients: 1,
            followupPatients: 3,
            dnaCount: 0,
            outcomeId: 'outcome-2',
          },
        ],
      };

      render(<ServiceLogForm {...defaultProps} initialData={initialData} />);

      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      expect(patientCountInput).toHaveValue(2);
    });
  });

  describe('Form Validation', () => {
    test('shows validation errors for required fields', async () => {
      render(<ServiceLogForm {...defaultProps} />);

      const submitButton = screen.getByText('Save Service Log');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Please select a client/site')).toBeInTheDocument();
        expect(screen.getByText('Please select an activity')).toBeInTheDocument();
      });

      expect(defaultProps.onSubmit).not.toHaveBeenCalled();
    });

    test('validates patient count range', async () => {
      render(<ServiceLogForm {...defaultProps} />);

      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      
      // Test minimum validation
      await user.clear(patientCountInput);
      await user.type(patientCountInput, '0');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText('At least 1 patient is required')).toBeInTheDocument();
      });

      // Test maximum validation  
      await user.clear(patientCountInput);
      await user.type(patientCountInput, '101');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText('Cannot exceed 100 patients per session')).toBeInTheDocument();
      });
    });

    test('validates patient entries match patient count', async () => {
      render(<ServiceLogForm {...defaultProps} />);

      // Set patient count to 5
      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      await user.clear(patientCountInput);
      await user.type(patientCountInput, '5');

      // Wait for patient entry to appear
      await waitFor(() => {
        expect(screen.getByText('Entry 1')).toBeInTheDocument();
      });

      // Fill in patient data that doesn't match count (only 3 patients instead of 5)
      const newPatientsInput = screen.getByLabelText('New Patients');
      const followupPatientsInput = screen.getByLabelText('Follow-up Patients');
      
      await user.type(newPatientsInput, '2');
      await user.type(followupPatientsInput, '1');

      // Select client, activity, and outcome
      const clientSelect = screen.getByRole('button', { name: /select client/i });
      await user.click(clientSelect);
      await user.click(screen.getByText('Main Hospital'));

      const activitySelect = screen.getByRole('button', { name: /select activity/i });
      await user.click(activitySelect);
      await user.click(screen.getByText('General Consultation'));

      const outcomeSelect = screen.getByRole('button', { name: /select outcome/i });
      await user.click(outcomeSelect);
      await user.click(screen.getByText('Treatment Completed'));

      // Try to submit
      const submitButton = screen.getByText('Save Service Log');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Patient entries must match the total patient count')).toBeInTheDocument();
      });

      expect(defaultProps.onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Dynamic Patient Entries', () => {
    test('generates patient entries based on patient count', async () => {
      render(<ServiceLogForm {...defaultProps} />);

      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      await user.clear(patientCountInput);
      await user.type(patientCountInput, '3');

      await waitFor(() => {
        expect(screen.getByText('Entry 1')).toBeInTheDocument();
        expect(screen.getByText('Entry 2')).toBeInTheDocument();
        expect(screen.getByText('Entry 3')).toBeInTheDocument();
      });

      // Each entry should have required fields
      expect(screen.getAllByLabelText('New Patients')).toHaveLength(3);
      expect(screen.getAllByLabelText('Follow-up Patients')).toHaveLength(3);
      expect(screen.getAllByLabelText('DNA Count')).toHaveLength(3);
      expect(screen.getAllByRole('button', { name: /select outcome/i })).toHaveLength(3);
    });

    test('updates patient entries when count changes', async () => {
      render(<ServiceLogForm {...defaultProps} />);

      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      
      // Start with 2 entries
      await user.clear(patientCountInput);
      await user.type(patientCountInput, '2');

      await waitFor(() => {
        expect(screen.getByText('Entry 2')).toBeInTheDocument();
      });

      // Reduce to 1 entry
      await user.clear(patientCountInput);
      await user.type(patientCountInput, '1');

      await waitFor(() => {
        expect(screen.queryByText('Entry 2')).not.toBeInTheDocument();
        expect(screen.getByText('Entry 1')).toBeInTheDocument();
      });
    });

    test('preserves patient entry data when count increases', async () => {
      render(<ServiceLogForm {...defaultProps} />);

      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      
      // Fill first entry
      await waitFor(() => {
        expect(screen.getByText('Entry 1')).toBeInTheDocument();
      });

      const newPatientsInput = screen.getAllByLabelText('New Patients')[0];
      await user.type(newPatientsInput, '5');

      // Increase count to 2
      await user.clear(patientCountInput);
      await user.type(patientCountInput, '2');

      await waitFor(() => {
        expect(screen.getByText('Entry 2')).toBeInTheDocument();
      });

      // First entry data should be preserved
      expect(screen.getAllByLabelText('New Patients')[0]).toHaveValue(5);
    });
  });

  describe('Form Summary Calculations', () => {
    test('calculates and displays totals correctly', async () => {
      render(<ServiceLogForm {...defaultProps} />);

      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      await user.clear(patientCountInput);
      await user.type(patientCountInput, '2');

      await waitFor(() => {
        expect(screen.getByText('Entry 2')).toBeInTheDocument();
      });

      // Fill first entry
      const newPatientsInputs = screen.getAllByLabelText('New Patients');
      const followupPatientsInputs = screen.getAllByLabelText('Follow-up Patients');
      const dnaCountInputs = screen.getAllByLabelText('DNA Count');

      await user.type(newPatientsInputs[0], '3');
      await user.type(followupPatientsInputs[0], '2');
      await user.type(dnaCountInputs[0], '1');

      // Fill second entry
      await user.type(newPatientsInputs[1], '1');
      await user.type(followupPatientsInputs[1], '3');
      await user.type(dnaCountInputs[1], '0');

      // Wait for summary to update
      await waitFor(() => {
        expect(screen.getByText('Total patients: 9')).toBeInTheDocument();
      });

      // Check individual totals in summary
      const summarySection = screen.getByText('Summary').closest('div');
      expect(summarySection).toHaveTextContent('Total Patients:9');
      expect(summarySection).toHaveTextContent('New:4');
      expect(summarySection).toHaveTextContent('Follow-up:5');
      expect(summarySection).toHaveTextContent('DNA:1');
    });

    test('warns when totals do not match expected count', async () => {
      render(<ServiceLogForm {...defaultProps} />);

      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      await user.clear(patientCountInput);
      await user.type(patientCountInput, '10');

      await waitFor(() => {
        expect(screen.getByText('Entry 1')).toBeInTheDocument();
      });

      // Fill with fewer patients than expected
      const newPatientsInput = screen.getByLabelText('New Patients');
      await user.type(newPatientsInput, '3');

      await waitFor(() => {
        expect(screen.getByText('Total patients: 3')).toBeInTheDocument();
        expect(screen.getByText('(Expected: 10)')).toBeInTheDocument();
      });
    });
  });

  describe('Auto-save Functionality', () => {
    test('saves draft to localStorage when form is dirty', async () => {
      jest.useFakeTimers();
      
      render(<ServiceLogForm {...defaultProps} />);

      // Make form dirty
      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      await user.type(patientCountInput, '2');

      // Fast-forward time to trigger auto-save
      act(() => {
        jest.advanceTimersByTime(2500);
      });

      await waitFor(() => {
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          'serviceLogDraft',
          expect.stringContaining('"patientCount":12')
        );
      });

      jest.useRealTimers();
    });

    test('loads draft from localStorage on mount', () => {
      const draftData = {
        clientId: 'client-1',
        activityId: 'activity-1',
        patientCount: 3,
        patientEntries: [],
      };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(draftData));

      render(<ServiceLogForm {...defaultProps} />);

      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      expect(patientCountInput).toHaveValue(3);
    });

    test('shows auto-saving indicator', async () => {
      jest.useFakeTimers();
      
      render(<ServiceLogForm {...defaultProps} />);

      // Make form dirty
      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      await user.type(patientCountInput, '2');

      // Should show saving indicator
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(screen.getByText('Auto-saving draft...')).toBeInTheDocument();

      jest.useRealTimers();
    });
  });

  describe('Form Submission', () => {
    test('submits valid form data successfully', async () => {
      const mockOnSubmit = jest.fn().mockResolvedValue(undefined);
      
      render(<ServiceLogForm {...defaultProps} onSubmit={mockOnSubmit} />);

      // Fill required fields
      const clientSelect = screen.getByRole('button', { name: /select client/i });
      await user.click(clientSelect);
      await user.click(screen.getByText('Main Hospital'));

      const activitySelect = screen.getByRole('button', { name: /select activity/i });
      await user.click(activitySelect);
      await user.click(screen.getByText('General Consultation'));

      // Patient count will create one entry automatically
      await waitFor(() => {
        expect(screen.getByText('Entry 1')).toBeInTheDocument();
      });

      // Fill patient entry
      const newPatientsInput = screen.getByLabelText('New Patients');
      const outcomeSelect = screen.getByRole('button', { name: /select outcome/i });
      
      await user.type(newPatientsInput, '1');
      await user.click(outcomeSelect);
      await user.click(screen.getByText('Treatment Completed'));

      // Submit form
      const submitButton = screen.getByText('Save Service Log');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          clientId: 'client-1',
          activityId: 'activity-1',
          patientCount: 1,
          patientEntries: [
            {
              newPatients: 1,
              followupPatients: 0,
              dnaCount: 0,
              outcomeId: 'outcome-1',
            },
          ],
        });
      });
    });

    test('clears draft after successful submission', async () => {
      const mockOnSubmit = jest.fn().mockResolvedValue(undefined);
      
      render(<ServiceLogForm {...defaultProps} onSubmit={mockOnSubmit} />);

      // Set up valid form
      const clientSelect = screen.getByRole('button', { name: /select client/i });
      await user.click(clientSelect);
      await user.click(screen.getByText('Main Hospital'));

      const activitySelect = screen.getByRole('button', { name: /select activity/i });
      await user.click(activitySelect);
      await user.click(screen.getByText('General Consultation'));

      await waitFor(() => {
        expect(screen.getByText('Entry 1')).toBeInTheDocument();
      });

      const newPatientsInput = screen.getByLabelText('New Patients');
      const outcomeSelect = screen.getByRole('button', { name: /select outcome/i });
      
      await user.type(newPatientsInput, '1');
      await user.click(outcomeSelect);
      await user.click(screen.getByText('Treatment Completed'));

      const submitButton = screen.getByText('Save Service Log');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('serviceLogDraft');
      });
    });

    test('handles submission errors gracefully', async () => {
      const mockOnSubmit = jest.fn().mockRejectedValue(new Error('Network error'));
      
      render(<ServiceLogForm {...defaultProps} onSubmit={mockOnSubmit} />);

      // Set up valid form
      const clientSelect = screen.getByRole('button', { name: /select client/i });
      await user.click(clientSelect);
      await user.click(screen.getByText('Main Hospital'));

      const activitySelect = screen.getByRole('button', { name: /select activity/i });
      await user.click(activitySelect);
      await user.click(screen.getByText('General Consultation'));

      await waitFor(() => {
        expect(screen.getByText('Entry 1')).toBeInTheDocument();
      });

      const newPatientsInput = screen.getByLabelText('New Patients');
      const outcomeSelect = screen.getByRole('button', { name: /select outcome/i });
      
      await user.type(newPatientsInput, '1');
      await user.click(outcomeSelect);
      await user.click(screen.getByText('Treatment Completed'));

      const submitButton = screen.getByText('Save Service Log');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });

      // Draft should not be cleared on error
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalledWith('serviceLogDraft');
    });
  });

  describe('Form Actions', () => {
    test('clears form when Clear Form is clicked', async () => {
      render(<ServiceLogForm {...defaultProps} />);

      // Fill some data
      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      await user.clear(patientCountInput);
      await user.type(patientCountInput, '3');

      // Clear form
      const clearButton = screen.getByText('Clear Form');
      await user.click(clearButton);

      // Should reset to defaults
      expect(patientCountInput).toHaveValue(1);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('serviceLogDraft');
    });

    test('calls onCancel when Cancel is clicked', async () => {
      const mockOnCancel = jest.fn();
      render(<ServiceLogForm {...defaultProps} onCancel={mockOnCancel} />);

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });

    test('submit button is disabled when form is not dirty', () => {
      render(<ServiceLogForm {...defaultProps} />);

      const submitButton = screen.getByText('Save Service Log');
      expect(submitButton).toBeDisabled();
    });

    test('shows loading state during submission', async () => {
      render(<ServiceLogForm {...defaultProps} isLoading={true} />);

      const submitButton = screen.getByText('Save Service Log');
      expect(submitButton).toBeDisabled();
      
      // Other buttons should also be disabled during loading
      const clearButton = screen.getByText('Clear Form');
      expect(clearButton).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA labels and structure', () => {
      render(<ServiceLogForm {...defaultProps} />);

      // Required field indicators
      const requiredFields = screen.getAllByText('*');
      expect(requiredFields).toHaveLength(3);

      // Error messages are associated with inputs
      const clientSelect = screen.getByRole('button', { name: /select client/i });
      expect(clientSelect).toHaveAttribute('aria-describedby');
    });

    test('provides helper text for complex fields', () => {
      render(<ServiceLogForm {...defaultProps} />);

      expect(screen.getByText('How many individual patient entries to create (1-100)')).toBeInTheDocument();
      expect(screen.getByText('Did Not Attend')).toBeInTheDocument();
    });

    test('shows unsaved changes indicator', async () => {
      render(<ServiceLogForm {...defaultProps} />);

      // Make form dirty
      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      await user.type(patientCountInput, '2');

      await waitFor(() => {
        expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    test('handles empty dropdown options gracefully', () => {
      render(
        <ServiceLogForm
          {...defaultProps}
          clients={[]}
          activities={[]}
          outcomes={[]}
        />
      );

      // Should still render form without crashing
      expect(screen.getByText('Service Log Entry')).toBeInTheDocument();
    });

    test('handles inactive options by filtering them out', () => {
      const inactiveClient = createMockClient({ 
        id: 'inactive-client', 
        name: 'Inactive Client',
        isActive: false 
      });
      
      render(
        <ServiceLogForm
          {...defaultProps}
          clients={[...defaultProps.clients, inactiveClient]}
        />
      );

      const clientSelect = screen.getByRole('button', { name: /select client/i });
      user.click(clientSelect);

      // Should not show inactive client
      expect(screen.queryByText('Inactive Client')).not.toBeInTheDocument();
    });

    test('handles very large patient counts', async () => {
      render(<ServiceLogForm {...defaultProps} />);

      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      await user.clear(patientCountInput);
      await user.type(patientCountInput, '50');

      await waitFor(() => {
        expect(screen.getByText('Entry 1')).toBeInTheDocument();
        expect(screen.getByText('Entry 50')).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });
});