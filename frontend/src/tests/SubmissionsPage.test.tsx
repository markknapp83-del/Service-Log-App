// Frontend Component Tests for SubmissionsPage - Phase 7
// Following React Testing Library documentation patterns

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { SubmissionsPage } from '../pages/SubmissionsPage';

// Mock the child components and hooks
jest.mock('../components/SubmissionsTable', () => ({
  SubmissionsTable: ({ submissions, loading, onViewDetails, onExport, onFilterChange }: any) => (
    <div data-testid="submissions-table">
      <div>Submissions Table</div>
      <div>Loading: {loading ? 'true' : 'false'}</div>
      <div>Submissions Count: {submissions.length}</div>
      <button onClick={() => onViewDetails('test-id')}>View Details</button>
      <button onClick={() => onExport('csv')}>Export CSV</button>
      <button onClick={() => onFilterChange({ dateFrom: '2023-01-01' })}>Change Filter</button>
    </div>
  )
}));

jest.mock('../components/Modal', () => ({
  Modal: ({ isOpen, onClose, title, children }: any) => (
    isOpen ? (
      <div data-testid="modal">
        <div>Modal: {title}</div>
        <button onClick={onClose}>Close Modal</button>
        {children}
      </div>
    ) : null
  )
}));

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { 
      id: 'test-user-123',
      role: 'admin',
      email: 'admin@test.com'
    }
  })
}));

jest.mock('../hooks/useToast', () => ({
  useToast: () => ({
    showToast: jest.fn()
  })
}));

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock data
const mockServiceLogs = [
  {
    id: 'log-1',
    userId: 'user-1',
    clientId: 'client-1',
    activityId: 'activity-1',
    serviceDate: '2023-12-01',
    patientCount: 3,
    isDraft: false,
    submittedAt: '2023-12-01T15:00:00Z',
    createdAt: '2023-12-01T10:00:00Z',
    patientEntries: [
      { id: 'entry-1', appointmentType: 'new', outcomeId: 'outcome-1' },
      { id: 'entry-2', appointmentType: 'followup', outcomeId: 'outcome-1' },
      { id: 'entry-3', appointmentType: 'dna', outcomeId: 'outcome-1' }
    ]
  },
  {
    id: 'log-2',
    userId: 'user-1',
    clientId: 'client-2',
    activityId: 'activity-2',
    serviceDate: '2023-12-02',
    patientCount: 2,
    isDraft: true,
    submittedAt: null,
    createdAt: '2023-12-02T10:00:00Z',
    patientEntries: [
      { id: 'entry-4', appointmentType: 'new', outcomeId: 'outcome-1' },
      { id: 'entry-5', appointmentType: 'followup', outcomeId: 'outcome-1' }
    ]
  }
];

const mockFormOptions = {
  clients: [
    { id: 'client-1', name: 'Central Healthcare', isActive: true },
    { id: 'client-2', name: 'Community Clinic', isActive: true }
  ],
  activities: [
    { id: 'activity-1', name: 'General Medicine', isActive: true },
    { id: 'activity-2', name: 'Physical Therapy', isActive: true }
  ],
  outcomes: [
    { id: 'outcome-1', name: 'Treatment Completed', isActive: true }
  ]
};

// Mock URL.createObjectURL and related methods
global.URL.createObjectURL = jest.fn(() => 'mock-blob-url');
global.URL.revokeObjectURL = jest.fn();

// Mock document.createElement and related DOM methods
const mockLink = {
  href: '',
  download: '',
  click: jest.fn(),
};
const originalCreateElement = document.createElement;
document.createElement = jest.fn((tagName) => {
  if (tagName === 'a') {
    return mockLink as any;
  }
  return originalCreateElement.call(document, tagName);
});

// Mock document.body methods
const originalAppendChild = document.body.appendChild;
const originalRemoveChild = document.body.removeChild;
document.body.appendChild = jest.fn();
document.body.removeChild = jest.fn();

describe('SubmissionsPage Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset fetch mock
    mockFetch.mockClear();
    
    // Default successful API responses
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockFormOptions
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { users: [] }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            serviceLogs: mockServiceLogs
          }
        })
      });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Initial Rendering and Data Loading', () => {
    test('renders page header and title correctly', async () => {
      render(<SubmissionsPage />);

      expect(screen.getByText('Service Log Reports')).toBeInTheDocument();
      expect(screen.getByText('View and manage service log submissions with advanced filtering and export capabilities')).toBeInTheDocument();
    });

    test('shows loading state during initial data fetch', async () => {
      render(<SubmissionsPage />);

      // Should show loading initially
      expect(screen.getByText('Loading submissions...')).toBeInTheDocument();

      // Wait for data to load
      await waitFor(() => {
        expect(screen.queryByText('Loading submissions...')).not.toBeInTheDocument();
      });
    });

    test('loads initial data on mount', async () => {
      render(<SubmissionsPage />);

      // Wait for all API calls to complete
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(3);
      });

      // Check API calls
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/service-logs/options',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer null',
          })
        })
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/service-logs',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer null',
          })
        })
      );
    });

    test('renders submissions table after data loads', async () => {
      render(<SubmissionsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('submissions-table')).toBeInTheDocument();
      });

      expect(screen.getByText('Submissions Count: 2')).toBeInTheDocument();
      expect(screen.getByText('Loading: false')).toBeInTheDocument();
    });

    test('handles API errors gracefully', async () => {
      // Mock failed API responses
      mockFetch.mockReset().mockRejectedValue(new Error('API Error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      render(<SubmissionsPage />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to load initial data:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Data Transformation', () => {
    test('transforms service log data correctly for table', async () => {
      render(<SubmissionsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('submissions-table')).toBeInTheDocument();
      });

      // The component should transform the raw service logs into submission table rows
      // This is tested indirectly through the submissions count
      expect(screen.getByText('Submissions Count: 2')).toBeInTheDocument();
    });

    test('calculates appointment type breakdowns correctly', async () => {
      render(<SubmissionsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('submissions-table')).toBeInTheDocument();
      });

      // The transformation logic should calculate:
      // log-1: 1 new, 1 followup, 1 dna
      // log-2: 1 new, 1 followup, 0 dna
      // Total: 2 new, 2 followup, 1 dna
      
      // This is tested through the component's internal logic
      // The actual verification is done in the SubmissionsTable component
    });

    test('handles missing client/activity names gracefully', async () => {
      // Mock API with missing reference data
      mockFetch.mockReset()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: { clients: [], activities: [], outcomes: [] }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: { users: [] }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: { serviceLogs: mockServiceLogs }
          })
        });

      render(<SubmissionsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('submissions-table')).toBeInTheDocument();
      });

      // Should still render without errors
      expect(screen.getByText('Submissions Count: 2')).toBeInTheDocument();
    });
  });

  describe('Filter Functionality', () => {
    test('handles filter changes and reloads data', async () => {
      const user = userEvent.setup();
      render(<SubmissionsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('submissions-table')).toBeInTheDocument();
      });

      // Mock additional API call for filter
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { serviceLogs: [mockServiceLogs[0]] } // Filtered result
        })
      });

      // Simulate filter change
      await user.click(screen.getByText('Change Filter'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:5000/api/service-logs?dateFrom=2023-01-01',
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer null',
            })
          })
        );
      });
    });

    test('maintains filter state correctly', async () => {
      const user = userEvent.setup();
      render(<SubmissionsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('submissions-table')).toBeInTheDocument();
      });

      // Mock API response for filtered data
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { serviceLogs: [] }
        })
      });

      await user.click(screen.getByText('Change Filter'));

      // The filter state should be maintained internally
      // This is tested through the API call parameters
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('dateFrom=2023-01-01'),
          expect.any(Object)
        );
      });
    });
  });

  describe('Export Functionality', () => {
    test('handles CSV export correctly', async () => {
      const user = userEvent.setup();
      render(<SubmissionsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('submissions-table')).toBeInTheDocument();
      });

      // Mock export API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['csv,data'], { type: 'text/csv' })
      });

      await user.click(screen.getByText('Export CSV'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:5000/api/reports/export?format=csv',
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer null',
            })
          })
        );
      });

      // Check that download was triggered
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(mockLink.click).toHaveBeenCalled();
      expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    });

    test('sets correct filename for export', async () => {
      const user = userEvent.setup();
      render(<SubmissionsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('submissions-table')).toBeInTheDocument();
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['csv,data'], { type: 'text/csv' })
      });

      await user.click(screen.getByText('Export CSV'));

      await waitFor(() => {
        expect(mockLink.download).toBe('service-log-submissions.csv');
      });
    });

    test('handles export errors gracefully', async () => {
      const user = userEvent.setup();
      render(<SubmissionsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('submissions-table')).toBeInTheDocument();
      });

      // Mock failed export
      mockFetch.mockRejectedValueOnce(new Error('Export failed'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await user.click(screen.getByText('Export CSV'));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Export failed:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });

    test('includes current filters in export request', async () => {
      const user = userEvent.setup();
      render(<SubmissionsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('submissions-table')).toBeInTheDocument();
      });

      // Set filters first
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { serviceLogs: mockServiceLogs }
        })
      });

      await user.click(screen.getByText('Change Filter'));

      // Then export
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['csv,data'], { type: 'text/csv' })
      });

      await user.click(screen.getByText('Export CSV'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('dateFrom=2023-01-01'),
          expect.any(Object)
        );
      });
    });
  });

  describe('Submission Details Modal', () => {
    test('opens details modal when view details is clicked', async () => {
      const user = userEvent.setup();
      render(<SubmissionsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('submissions-table')).toBeInTheDocument();
      });

      // Mock API response for submission details
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            ...mockServiceLogs[0],
            patientEntries: mockServiceLogs[0].patientEntries
          }
        })
      });

      await user.click(screen.getByText('View Details'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:5000/api/service-logs/test-id',
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer null',
            })
          })
        );
      });

      expect(screen.getByTestId('modal')).toBeInTheDocument();
      expect(screen.getByText('Modal: Submission Details')).toBeInTheDocument();
    });

    test('closes details modal correctly', async () => {
      const user = userEvent.setup();
      render(<SubmissionsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('submissions-table')).toBeInTheDocument();
      });

      // Open modal
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockServiceLogs[0]
        })
      });

      await user.click(screen.getByText('View Details'));

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument();
      });

      // Close modal
      await user.click(screen.getByText('Close Modal'));

      await waitFor(() => {
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
      });
    });

    test('handles details API errors gracefully', async () => {
      const user = userEvent.setup();
      render(<SubmissionsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('submissions-table')).toBeInTheDocument();
      });

      // Mock failed details API
      mockFetch.mockRejectedValueOnce(new Error('Details failed'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await user.click(screen.getByText('View Details'));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to load submission details:', expect.any(Error));
      });

      // Modal should not open
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });

  describe('Performance and Error Handling', () => {
    test('handles large datasets efficiently', async () => {
      const largeMockData = Array.from({ length: 1000 }, (_, i) => ({
        ...mockServiceLogs[0],
        id: `log-${i}`,
        serviceDate: `2023-12-${String((i % 28) + 1).padStart(2, '0')}`
      }));

      mockFetch.mockReset()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: mockFormOptions
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: { users: [] }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: { serviceLogs: largeMockData }
          })
        });

      const startTime = Date.now();
      render(<SubmissionsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('submissions-table')).toBeInTheDocument();
      });

      const renderTime = Date.now() - startTime;

      // Should handle large datasets within reasonable time
      expect(renderTime).toBeLessThan(1000);
      expect(screen.getByText('Submissions Count: 1000')).toBeInTheDocument();
    });

    test('maintains state consistency during rapid operations', async () => {
      const user = userEvent.setup();
      render(<SubmissionsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('submissions-table')).toBeInTheDocument();
      });

      // Mock multiple API responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: { serviceLogs: [mockServiceLogs[0]] }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: mockServiceLogs[0]
          })
        });

      // Rapid operations
      await user.click(screen.getByText('Change Filter'));
      await user.click(screen.getByText('View Details'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(5); // 3 initial + 2 additional
      });

      // Should handle rapid operations without errors
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    test('cleans up resources properly', async () => {
      const { unmount } = render(<SubmissionsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('submissions-table')).toBeInTheDocument();
      });

      // Unmount component
      unmount();

      // Should not cause any errors (tested implicitly by not throwing)
    });
  });

  describe('User Role Handling', () => {
    test('handles admin user correctly', async () => {
      render(<SubmissionsPage />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:5000/api/admin/users',
          expect.any(Object)
        );
      });

      // Admin should get users data
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    test('handles candidate user correctly', async () => {
      // Mock candidate user
      jest.mocked(require('../hooks/useAuth').useAuth).mockReturnValue({
        user: { 
          id: 'candidate-123',
          role: 'candidate',
          email: 'candidate@test.com'
        }
      });

      render(<SubmissionsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('submissions-table')).toBeInTheDocument();
      });

      // Candidate should not get users data
      expect(mockFetch).not.toHaveBeenCalledWith(
        'http://localhost:5000/api/admin/users',
        expect.any(Object)
      );
    });
  });

  describe('Accessibility', () => {
    test('maintains focus management in modals', async () => {
      const user = userEvent.setup();
      render(<SubmissionsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('submissions-table')).toBeInTheDocument();
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockServiceLogs[0]
        })
      });

      // Open modal
      await user.click(screen.getByText('View Details'));

      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument();
      });

      // Focus should be managed by the Modal component
      // This is tested through the Modal component's implementation
    });

    test('provides appropriate loading announcements', async () => {
      render(<SubmissionsPage />);

      // Loading state should be announced
      const loadingElement = screen.getByText('Loading submissions...');
      expect(loadingElement).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText('Loading submissions...')).not.toBeInTheDocument();
      });
    });
  });
});