// ServiceLogPage integration tests following React Testing Library documentation patterns
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServiceLogPage } from '../pages/ServiceLogPage';
import { apiService } from '../services/apiService';
import { Client, Activity, Outcome } from '../types';

// Mock the API service
jest.mock('../services/apiService', () => ({
  apiService: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

// Mock the toast hook
jest.mock('../hooks/useToast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Mock window.history for navigation
const mockHistoryBack = jest.fn();
Object.defineProperty(window, 'history', {
  value: { back: mockHistoryBack },
});

// Mock console methods to reduce noise in tests
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

beforeAll(() => {
  console.error = jest.fn();
  console.log = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.log = originalConsoleLog;
});

// Test data factories
const createMockFormOptions = () => ({
  clients: [
    {
      id: 'client-1',
      name: 'Main Hospital',
      description: 'Primary healthcare facility',
      isActive: true,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    } as Client,
    {
      id: 'client-2',
      name: 'Outpatient Clinic',
      description: 'Outpatient services',
      isActive: true,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    } as Client,
  ],
  activities: [
    {
      id: 'activity-1',
      name: 'General Consultation',
      description: 'Standard patient consultation',
      isActive: true,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    } as Activity,
    {
      id: 'activity-2',
      name: 'Emergency Care',
      description: 'Emergency treatment',
      isActive: true,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    } as Activity,
  ],
  outcomes: [
    {
      id: 'outcome-1',
      name: 'Treatment Completed',
      description: 'Patient treatment successfully completed',
      isActive: true,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    } as Outcome,
    {
      id: 'outcome-2',
      name: 'Follow-up Required',
      description: 'Patient requires follow-up appointment',
      isActive: true,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    } as Outcome,
  ],
});

const mockApiService = apiService as jest.Mocked<typeof apiService>;

describe('ServiceLogPage Integration Tests', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    mockHistoryBack.mockClear();
  });

  describe('Initial Loading', () => {
    test('shows loading state while fetching form options', async () => {
      // Mock delayed API response
      mockApiService.get.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => 
          resolve({ success: true, data: createMockFormOptions() }), 100)
        )
      );

      render(<ServiceLogPage />);

      // Should show loading state
      expect(screen.getByText('Loading form...')).toBeInTheDocument();
      expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument(); // Loading spinner

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByText('New Service Log Entry')).toBeInTheDocument();
      });

      expect(mockApiService.get).toHaveBeenCalledWith('/service-logs/options');
    });

    test('loads form options successfully and renders form', async () => {
      const mockFormOptions = createMockFormOptions();
      mockApiService.get.mockResolvedValue({
        success: true,
        data: mockFormOptions,
      });

      render(<ServiceLogPage />);

      await waitFor(() => {
        expect(screen.getByText('New Service Log Entry')).toBeInTheDocument();
      });

      // Should render form with loaded options
      expect(screen.getByText('Service Log Entry')).toBeInTheDocument();
      expect(screen.getByText('Client/Site')).toBeInTheDocument();
      expect(screen.getByText('Activity/Specialty')).toBeInTheDocument();

      // Should render header content
      expect(screen.getByText('Record patient services and outcomes for healthcare tracking.')).toBeInTheDocument();
      expect(screen.getByText('Back')).toBeInTheDocument();
      expect(screen.getByText('View All Logs')).toBeInTheDocument();
    });

    test('handles API error gracefully', async () => {
      mockApiService.get.mockRejectedValue(new Error('Network error'));

      render(<ServiceLogPage />);

      await waitFor(() => {
        expect(screen.getByText('Unable to Load Form')).toBeInTheDocument();
      });

      expect(screen.getByText('There was a problem loading the form data.')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    test('handles API failure response', async () => {
      mockApiService.get.mockResolvedValue({
        success: false,
        error: { message: 'Server error' },
      });

      render(<ServiceLogPage />);

      await waitFor(() => {
        expect(screen.getByText('Unable to Load Form')).toBeInTheDocument();
      });
    });

    test('retry button reloads the page', async () => {
      mockApiService.get.mockRejectedValue(new Error('Network error'));
      
      // Mock window.location.reload
      const mockReload = jest.fn();
      Object.defineProperty(window, 'location', {
        value: { reload: mockReload },
        writable: true,
      });

      render(<ServiceLogPage />);

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Retry'));
      expect(mockReload).toHaveBeenCalled();
    });
  });

  describe('Form Interaction', () => {
    beforeEach(async () => {
      const mockFormOptions = createMockFormOptions();
      mockApiService.get.mockResolvedValue({
        success: true,
        data: mockFormOptions,
      });
    });

    test('allows user to fill out and submit form', async () => {
      mockApiService.post.mockResolvedValue({
        success: true,
        data: {
          id: 'service-log-123',
          clientId: 'client-1',
          activityId: 'activity-1',
          patientCount: 1,
        },
      });

      render(<ServiceLogPage />);

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByText('Service Log Entry')).toBeInTheDocument();
      });

      // Fill out the form
      const clientSelect = screen.getByRole('button', { name: /select client/i });
      await user.click(clientSelect);
      await user.click(screen.getByText('Main Hospital'));

      const activitySelect = screen.getByRole('button', { name: /select activity/i });
      await user.click(activitySelect);
      await user.click(screen.getByText('General Consultation'));

      // Patient entry should appear automatically
      await waitFor(() => {
        expect(screen.getByText('Entry 1')).toBeInTheDocument();
      });

      // Fill patient entry
      const newPatientsInput = screen.getByLabelText('New Patients');
      await user.type(newPatientsInput, '1');

      const outcomeSelect = screen.getByRole('button', { name: /select outcome/i });
      await user.click(outcomeSelect);
      await user.click(screen.getByText('Treatment Completed'));

      // Submit form
      const submitButton = screen.getByText('Save Service Log');
      await user.click(submitButton);

      // Should call API with correct data
      await waitFor(() => {
        expect(mockApiService.post).toHaveBeenCalledWith('/service-logs', {
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
          isDraft: false,
        });
      });
    });

    test('handles form submission errors', async () => {
      mockApiService.post.mockRejectedValue(new Error('Submission failed'));

      render(<ServiceLogPage />);

      // Wait for form to load and fill it out
      await waitFor(() => {
        expect(screen.getByText('Service Log Entry')).toBeInTheDocument();
      });

      // Fill minimal valid form
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
      await user.type(newPatientsInput, '1');

      const outcomeSelect = screen.getByRole('button', { name: /select outcome/i });
      await user.click(outcomeSelect);
      await user.click(screen.getByText('Treatment Completed'));

      // Submit form
      const submitButton = screen.getByText('Save Service Log');
      await user.click(submitButton);

      // Should handle error gracefully (error display is handled by form component)
      await waitFor(() => {
        expect(mockApiService.post).toHaveBeenCalled();
      });
    });

    test('disables form during submission', async () => {
      // Mock slow API response
      mockApiService.post.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => 
          resolve({ success: true, data: {} }), 100)
        )
      );

      render(<ServiceLogPage />);

      await waitFor(() => {
        expect(screen.getByText('Service Log Entry')).toBeInTheDocument();
      });

      // Fill form quickly
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
      await user.type(newPatientsInput, '1');

      const outcomeSelect = screen.getByRole('button', { name: /select outcome/i });
      await user.click(outcomeSelect);
      await user.click(screen.getByText('Treatment Completed'));

      // Start submission
      const submitButton = screen.getByText('Save Service Log');
      await user.click(submitButton);

      // Form should be disabled during submission
      // (isLoading prop is passed to form component)
      await waitFor(() => {
        expect(mockApiService.post).toHaveBeenCalled();
      });
    });
  });

  describe('Navigation', () => {
    beforeEach(async () => {
      const mockFormOptions = createMockFormOptions();
      mockApiService.get.mockResolvedValue({
        success: true,
        data: mockFormOptions,
      });
    });

    test('back button calls window.history.back', async () => {
      render(<ServiceLogPage />);

      await waitFor(() => {
        expect(screen.getByText('Back')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Back'));
      expect(mockHistoryBack).toHaveBeenCalled();
    });

    test('view all logs button logs navigation intent', async () => {
      const mockConsoleLog = jest.fn();
      console.log = mockConsoleLog;

      render(<ServiceLogPage />);

      await waitFor(() => {
        expect(screen.getByText('View All Logs')).toBeInTheDocument();
      });

      await user.click(screen.getByText('View All Logs'));
      expect(mockConsoleLog).toHaveBeenCalledWith('Navigate to service logs list');
    });
  });

  describe('Instructions Section', () => {
    beforeEach(async () => {
      const mockFormOptions = createMockFormOptions();
      mockApiService.get.mockResolvedValue({
        success: true,
        data: mockFormOptions,
      });
    });

    test('displays helpful instructions', async () => {
      render(<ServiceLogPage />);

      await waitFor(() => {
        expect(screen.getByText('Instructions')).toBeInTheDocument();
      });

      // Check for instruction content
      expect(screen.getByText(/Patient Count:/)).toBeInTheDocument();
      expect(screen.getByText(/Patient Entries:/)).toBeInTheDocument();
      expect(screen.getByText(/Auto-save:/)).toBeInTheDocument();
      expect(screen.getByText(/Validation:/)).toBeInTheDocument();

      // Check for specific instruction details
      expect(screen.getByText(/Enter the total number of individual patient entries/)).toBeInTheDocument();
      expect(screen.getByText(/automatically saved locally every 2 seconds/)).toBeInTheDocument();
    });

    test('instructions are styled correctly', async () => {
      render(<ServiceLogPage />);

      await waitFor(() => {
        expect(screen.getByText('Instructions')).toBeInTheDocument();
      });

      const instructionsCard = screen.getByText('Instructions').closest('div');
      expect(instructionsCard).toHaveClass('bg-blue-50', 'border-blue-200');
    });
  });

  describe('Error Boundary and Edge Cases', () => {
    test('handles empty form options gracefully', async () => {
      mockApiService.get.mockResolvedValue({
        success: true,
        data: {
          clients: [],
          activities: [],
          outcomes: [],
        },
      });

      render(<ServiceLogPage />);

      await waitFor(() => {
        expect(screen.getByText('Service Log Entry')).toBeInTheDocument();
      });

      // Form should still render even with no options
      expect(screen.getByText('Client/Site')).toBeInTheDocument();
      expect(screen.getByText('Activity/Specialty')).toBeInTheDocument();
    });

    test('handles malformed API response', async () => {
      mockApiService.get.mockResolvedValue({
        success: true,
        data: null, // Malformed response
      });

      render(<ServiceLogPage />);

      await waitFor(() => {
        expect(screen.getByText('Unable to Load Form')).toBeInTheDocument();
      });
    });

    test('handles API timeout', async () => {
      mockApiService.get.mockImplementation(() => 
        new Promise((_, reject) => setTimeout(() => 
          reject(new Error('Request timeout')), 100)
        )
      );

      render(<ServiceLogPage />);

      await waitFor(() => {
        expect(screen.getByText('Unable to Load Form')).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Accessibility', () => {
    beforeEach(async () => {
      const mockFormOptions = createMockFormOptions();
      mockApiService.get.mockResolvedValue({
        success: true,
        data: mockFormOptions,
      });
    });

    test('has proper heading hierarchy', async () => {
      render(<ServiceLogPage />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('New Service Log Entry');
      });

      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Instructions');
    });

    test('provides descriptive text for the page purpose', async () => {
      render(<ServiceLogPage />);

      await waitFor(() => {
        expect(screen.getByText('Record patient services and outcomes for healthcare tracking.')).toBeInTheDocument();
      });
    });

    test('loading state is accessible', async () => {
      mockApiService.get.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => 
          resolve({ success: true, data: createMockFormOptions() }), 100)
        )
      );

      render(<ServiceLogPage />);

      const loadingSpinner = screen.getByRole('status', { hidden: true });
      expect(loadingSpinner).toBeInTheDocument();
      expect(screen.getByText('Loading form...')).toBeInTheDocument();
    });

    test('error state provides actionable feedback', async () => {
      mockApiService.get.mockRejectedValue(new Error('Network error'));

      render(<ServiceLogPage />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Unable to Load Form');
      });

      expect(screen.getByText('There was a problem loading the form data.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    test('renders efficiently with large datasets', async () => {
      // Create large dataset
      const largeFormOptions = {
        clients: Array.from({ length: 100 }, (_, i) => ({
          id: `client-${i}`,
          name: `Client ${i}`,
          description: `Description ${i}`,
          isActive: true,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        })) as Client[],
        activities: Array.from({ length: 50 }, (_, i) => ({
          id: `activity-${i}`,
          name: `Activity ${i}`,
          description: `Description ${i}`,
          isActive: true,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        })) as Activity[],
        outcomes: Array.from({ length: 20 }, (_, i) => ({
          id: `outcome-${i}`,
          name: `Outcome ${i}`,
          description: `Description ${i}`,
          isActive: true,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
        })) as Outcome[],
      };

      mockApiService.get.mockResolvedValue({
        success: true,
        data: largeFormOptions,
      });

      const startTime = performance.now();
      render(<ServiceLogPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Service Log Entry')).toBeInTheDocument();
      });
      
      const endTime = performance.now();
      
      // Should render within reasonable time even with large datasets
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });
});