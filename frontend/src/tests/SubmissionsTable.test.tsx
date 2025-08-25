// Frontend Component Tests for SubmissionsTable - Phase 7
// Following React Testing Library documentation patterns

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { SubmissionsTable, SubmissionTableRow, SubmissionFilters } from '../components/SubmissionsTable';

// Mock data for testing
const createMockSubmission = (overrides: Partial<SubmissionTableRow> = {}): SubmissionTableRow => ({
  id: 'sub-123',
  userId: 'user-456',
  userName: 'Dr. Sarah Johnson',
  clientName: 'Central Healthcare Clinic',
  activityName: 'General Consultation',
  serviceDate: '2023-12-01',
  totalPatients: 3,
  newPatients: 1,
  followupPatients: 1,
  dnaPatients: 1,
  isDraft: false,
  submittedAt: '2023-12-01T14:30:00Z',
  createdAt: '2023-12-01T10:00:00Z',
  ...overrides,
});

const mockSubmissions: SubmissionTableRow[] = [
  createMockSubmission({
    id: 'sub-1',
    serviceDate: '2023-12-01',
    clientName: 'Clinic A',
    activityName: 'General Medicine',
    totalPatients: 5,
    newPatients: 3,
    followupPatients: 2,
    dnaPatients: 0,
    isDraft: false,
    submittedAt: '2023-12-01T15:00:00Z'
  }),
  createMockSubmission({
    id: 'sub-2',
    serviceDate: '2023-12-02',
    clientName: 'Clinic B',
    activityName: 'Physical Therapy',
    totalPatients: 2,
    newPatients: 1,
    followupPatients: 0,
    dnaPatients: 1,
    isDraft: true,
    submittedAt: undefined
  }),
  createMockSubmission({
    id: 'sub-3',
    serviceDate: '2023-11-30',
    clientName: 'Clinic A',
    activityName: 'Mental Health',
    totalPatients: 4,
    newPatients: 2,
    followupPatients: 1,
    dnaPatients: 1,
    isDraft: false,
    submittedAt: '2023-11-30T16:30:00Z'
  }),
];

describe('SubmissionsTable Component', () => {
  const defaultProps = {
    submissions: mockSubmissions,
    loading: false,
    onViewDetails: jest.fn(),
    onExport: jest.fn(),
    onFilterChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    test('renders table with submission data', () => {
      render(<SubmissionsTable {...defaultProps} />);

      // Check header
      expect(screen.getByText('Service Log Submissions')).toBeInTheDocument();
      expect(screen.getByText('3 submissions')).toBeInTheDocument();

      // Check table headers
      expect(screen.getByText('Service Date')).toBeInTheDocument();
      expect(screen.getByText('Client')).toBeInTheDocument();
      expect(screen.getByText('Activity')).toBeInTheDocument();
      expect(screen.getByText('Patients')).toBeInTheDocument();
      expect(screen.getByText('Breakdown')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();

      // Check data rows
      expect(screen.getByText('Clinic A')).toBeInTheDocument();
      expect(screen.getByText('General Medicine')).toBeInTheDocument();
      expect(screen.getByText('Physical Therapy')).toBeInTheDocument();
    });

    test('displays correct submission counts', () => {
      render(<SubmissionsTable {...defaultProps} />);
      
      expect(screen.getByText('3 submissions')).toBeInTheDocument();
    });

    test('shows loading state correctly', () => {
      render(<SubmissionsTable {...defaultProps} loading={true} />);
      
      expect(screen.getByText('Loading submissions...')).toBeInTheDocument();
      expect(screen.getByRole('progressbar', { hidden: true })).toBeInTheDocument();
    });

    test('shows empty state when no submissions', () => {
      render(<SubmissionsTable {...defaultProps} submissions={[]} />);
      
      expect(screen.getByText('No submissions yet')).toBeInTheDocument();
      expect(screen.getByText('Service log submissions will appear here once created')).toBeInTheDocument();
    });

    test('displays patient count breakdown correctly', () => {
      render(<SubmissionsTable {...defaultProps} />);

      // Check for breakdown data
      expect(screen.getByText('New: 3')).toBeInTheDocument();
      expect(screen.getByText('Follow-up: 2')).toBeInTheDocument();
      expect(screen.getByText('DNA: 0')).toBeInTheDocument();

      expect(screen.getByText('New: 1')).toBeInTheDocument();
      expect(screen.getByText('DNA: 1')).toBeInTheDocument();
    });

    test('shows draft and submitted status correctly', () => {
      render(<SubmissionsTable {...defaultProps} />);

      // Should show status badges
      expect(screen.getByText('Draft')).toBeInTheDocument();
      expect(screen.getAllByText('Submitted')).toHaveLength(2);
      
      // Check status styling
      const draftBadge = screen.getByText('Draft');
      expect(draftBadge).toHaveClass('bg-yellow-100', 'text-yellow-800');
      
      const submittedBadges = screen.getAllByText('Submitted');
      expect(submittedBadges[0]).toHaveClass('bg-green-100', 'text-green-800');
    });

    test('formats dates correctly', () => {
      render(<SubmissionsTable {...defaultProps} />);

      expect(screen.getByText('Dec 1, 2023')).toBeInTheDocument();
      expect(screen.getByText('Dec 2, 2023')).toBeInTheDocument();
      expect(screen.getByText('Nov 30, 2023')).toBeInTheDocument();
    });
  });

  describe('Filtering Functionality', () => {
    test('shows and hides filter panel', async () => {
      const user = userEvent.setup();
      render(<SubmissionsTable {...defaultProps} />);

      // Filter panel should be hidden initially
      expect(screen.queryByLabelText('Search')).not.toBeInTheDocument();

      // Click show filters
      await user.click(screen.getByText('Show Filters'));
      
      expect(screen.getByLabelText('Search')).toBeInTheDocument();
      expect(screen.getByLabelText('Date From')).toBeInTheDocument();
      expect(screen.getByLabelText('Date To')).toBeInTheDocument();
      expect(screen.getByLabelText('Status')).toBeInTheDocument();

      // Click hide filters
      await user.click(screen.getByText('Hide Filters'));
      
      await waitFor(() => {
        expect(screen.queryByLabelText('Search')).not.toBeInTheDocument();
      });
    });

    test('search filter works correctly', async () => {
      const user = userEvent.setup();
      const mockOnFilterChange = jest.fn();
      
      render(<SubmissionsTable {...defaultProps} onFilterChange={mockOnFilterChange} />);
      
      // Show filters
      await user.click(screen.getByText('Show Filters'));
      
      // Type in search box
      const searchInput = screen.getByLabelText('Search');
      await user.type(searchInput, 'Clinic A');
      
      await waitFor(() => {
        expect(mockOnFilterChange).toHaveBeenCalledWith({
          searchTerm: 'Clinic A'
        });
      });
    });

    test('date range filters work correctly', async () => {
      const user = userEvent.setup();
      const mockOnFilterChange = jest.fn();
      
      render(<SubmissionsTable {...defaultProps} onFilterChange={mockOnFilterChange} />);
      
      // Show filters
      await user.click(screen.getByText('Show Filters'));
      
      // Set date from
      const dateFromInput = screen.getByLabelText('Date From');
      await user.type(dateFromInput, '2023-12-01');
      
      await waitFor(() => {
        expect(mockOnFilterChange).toHaveBeenCalledWith({
          dateFrom: '2023-12-01'
        });
      });

      // Set date to
      const dateToInput = screen.getByLabelText('Date To');
      await user.type(dateToInput, '2023-12-31');
      
      await waitFor(() => {
        expect(mockOnFilterChange).toHaveBeenCalledWith({
          dateFrom: '2023-12-01',
          dateTo: '2023-12-31'
        });
      });
    });

    test('status filter works correctly', async () => {
      const user = userEvent.setup();
      const mockOnFilterChange = jest.fn();
      
      render(<SubmissionsTable {...defaultProps} onFilterChange={mockOnFilterChange} />);
      
      // Show filters
      await user.click(screen.getByText('Show Filters'));
      
      // Select draft status
      const statusSelect = screen.getByLabelText('Status');
      await user.selectOptions(statusSelect, 'draft');
      
      await waitFor(() => {
        expect(mockOnFilterChange).toHaveBeenCalledWith({
          isDraft: true
        });
      });

      // Select submitted status
      await user.selectOptions(statusSelect, 'submitted');
      
      await waitFor(() => {
        expect(mockOnFilterChange).toHaveBeenCalledWith({
          isDraft: false
        });
      });
    });

    test('clear filters works correctly', async () => {
      const user = userEvent.setup();
      const mockOnFilterChange = jest.fn();
      
      render(<SubmissionsTable {...defaultProps} onFilterChange={mockOnFilterChange} />);
      
      // Show filters
      await user.click(screen.getByText('Show Filters'));
      
      // Add some filters first
      const searchInput = screen.getByLabelText('Search');
      await user.type(searchInput, 'test');
      
      // Clear filters
      await user.click(screen.getByText('Clear Filters'));
      
      await waitFor(() => {
        expect(mockOnFilterChange).toHaveBeenCalledWith({});
      });
    });

    test('filters data correctly', () => {
      const filteredSubmissions = mockSubmissions.filter(sub => 
        sub.clientName.toLowerCase().includes('clinic a')
      );
      
      render(<SubmissionsTable {...defaultProps} submissions={filteredSubmissions} />);
      
      expect(screen.getByText('2 submissions')).toBeInTheDocument();
      expect(screen.getAllByText('Clinic A')).toHaveLength(2);
      expect(screen.queryByText('Clinic B')).not.toBeInTheDocument();
    });

    test('shows no results message when filtered data is empty', () => {
      render(<SubmissionsTable {...defaultProps} submissions={[]} />);
      
      expect(screen.getByText('No submissions yet')).toBeInTheDocument();
    });
  });

  describe('Sorting Functionality', () => {
    test('sorting by service date works', async () => {
      const user = userEvent.setup();
      render(<SubmissionsTable {...defaultProps} />);

      // Click on service date header
      const serviceDateHeader = screen.getByText('Service Date');
      await user.click(serviceDateHeader);

      // Should show sort indicator
      expect(screen.getByText(/Service Date.*↑/)).toBeInTheDocument();

      // Click again to reverse sort
      await user.click(serviceDateHeader);
      expect(screen.getByText(/Service Date.*↓/)).toBeInTheDocument();
    });

    test('sorting by client name works', async () => {
      const user = userEvent.setup();
      render(<SubmissionsTable {...defaultProps} />);

      const clientHeader = screen.getByText('Client');
      await user.click(clientHeader);

      expect(screen.getByText(/Client.*↑/)).toBeInTheDocument();
    });

    test('sorting by activity name works', async () => {
      const user = userEvent.setup();
      render(<SubmissionsTable {...defaultProps} />);

      const activityHeader = screen.getByText('Activity');
      await user.click(activityHeader);

      expect(screen.getByText(/Activity.*↑/)).toBeInTheDocument();
    });

    test('sorting by total patients works', async () => {
      const user = userEvent.setup();
      render(<SubmissionsTable {...defaultProps} />);

      const patientsHeader = screen.getByText('Patients');
      await user.click(patientsHeader);

      expect(screen.getByText(/Patients.*↑/)).toBeInTheDocument();
    });
  });

  describe('Pagination', () => {
    const manySubmissions = Array.from({ length: 50 }, (_, i) => 
      createMockSubmission({
        id: `sub-${i}`,
        serviceDate: `2023-12-${String(i % 28 + 1).padStart(2, '0')}`,
        clientName: `Clinic ${String.fromCharCode(65 + i % 3)}`,
      })
    );

    test('shows pagination controls for large datasets', () => {
      render(<SubmissionsTable {...defaultProps} submissions={manySubmissions} />);

      expect(screen.getByText('Page 1 of')).toBeInTheDocument();
      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
      expect(screen.getByDisplayValue('20')).toBeInTheDocument(); // Page size selector
    });

    test('pagination navigation works', async () => {
      const user = userEvent.setup();
      render(<SubmissionsTable {...defaultProps} submissions={manySubmissions} />);

      // Should show first page
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
      
      // Next button should be enabled
      const nextButton = screen.getByText('Next');
      expect(nextButton).not.toBeDisabled();
      
      // Previous button should be disabled
      const prevButton = screen.getByText('Previous');
      expect(prevButton).toBeDisabled();

      // Click next
      await user.click(nextButton);
      
      await waitFor(() => {
        expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
      });
    });

    test('page size selector works', async () => {
      const user = userEvent.setup();
      render(<SubmissionsTable {...defaultProps} submissions={manySubmissions} />);

      // Change page size to 50
      const pageSizeSelect = screen.getByDisplayValue('20');
      await user.selectOptions(pageSizeSelect, '50');
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('50')).toBeInTheDocument();
        expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
      });
    });

    test('pagination resets when filtering', async () => {
      const user = userEvent.setup();
      
      render(<SubmissionsTable {...defaultProps} submissions={manySubmissions} />);
      
      // Go to page 2
      await user.click(screen.getByText('Next'));
      await waitFor(() => {
        expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
      });
      
      // Apply filter (this should reset to page 1)
      await user.click(screen.getByText('Show Filters'));
      const searchInput = screen.getByLabelText('Search');
      await user.type(searchInput, 'Clinic A');
      
      // Should be back to page 1
      await waitFor(() => {
        expect(screen.getByText('Page 1 of')).toBeInTheDocument();
      });
    });
  });

  describe('Export Functionality', () => {
    test('export buttons are present and functional', async () => {
      const user = userEvent.setup();
      const mockOnExport = jest.fn().mockResolvedValue(undefined);
      
      render(<SubmissionsTable {...defaultProps} onExport={mockOnExport} />);

      const csvButton = screen.getByText('Export CSV');
      const excelButton = screen.getByText('Export Excel');

      expect(csvButton).toBeInTheDocument();
      expect(excelButton).toBeInTheDocument();

      await user.click(csvButton);
      expect(mockOnExport).toHaveBeenCalledWith('csv');

      await user.click(excelButton);
      expect(mockOnExport).toHaveBeenCalledWith('excel');
    });

    test('export buttons are disabled when loading', () => {
      const mockOnExport = jest.fn();
      
      render(<SubmissionsTable {...defaultProps} onExport={mockOnExport} loading={true} />);

      const csvButton = screen.getByText('Export CSV');
      const excelButton = screen.getByText('Export Excel');

      expect(csvButton).toBeDisabled();
      expect(excelButton).toBeDisabled();
    });
  });

  describe('Action Buttons', () => {
    test('view details button works correctly', async () => {
      const user = userEvent.setup();
      const mockOnViewDetails = jest.fn();
      
      render(<SubmissionsTable {...defaultProps} onViewDetails={mockOnViewDetails} />);

      const viewDetailsButtons = screen.getAllByText('View Details');
      await user.click(viewDetailsButtons[0]);

      expect(mockOnViewDetails).toHaveBeenCalledWith('sub-1');
    });

    test('all submissions have view details button', () => {
      render(<SubmissionsTable {...defaultProps} />);

      const viewDetailsButtons = screen.getAllByText('View Details');
      expect(viewDetailsButtons).toHaveLength(mockSubmissions.length);
    });
  });

  describe('Summary Statistics', () => {
    test('displays summary statistics correctly', () => {
      render(<SubmissionsTable {...defaultProps} />);

      // Check summary card
      expect(screen.getByText('Summary Statistics')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument(); // Total submissions
      expect(screen.getByText('Total Submissions')).toBeInTheDocument();
      
      // Check patient counts
      expect(screen.getByText('11')).toBeInTheDocument(); // Total patients (5+2+4)
      expect(screen.getByText('Total Patients')).toBeInTheDocument();
      
      expect(screen.getByText('6')).toBeInTheDocument(); // New patients (3+1+2)
      expect(screen.getByText('New Patients')).toBeInTheDocument();
      
      expect(screen.getByText('3')).toBeInTheDocument(); // Follow-up patients (2+0+1)
      expect(screen.getByText('Follow-up Patients')).toBeInTheDocument();
    });

    test('summary statistics update with filtered data', () => {
      const filteredData = mockSubmissions.slice(0, 2);
      render(<SubmissionsTable {...defaultProps} submissions={filteredData} />);

      expect(screen.getByText('2')).toBeInTheDocument(); // Total submissions
      expect(screen.getByText('7')).toBeInTheDocument(); // Total patients (5+2)
    });

    test('summary statistics hidden when no data', () => {
      render(<SubmissionsTable {...defaultProps} submissions={[]} />);

      expect(screen.queryByText('Summary Statistics')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('table has proper accessibility attributes', () => {
      render(<SubmissionsTable {...defaultProps} />);

      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();

      const columnHeaders = screen.getAllByRole('columnheader');
      expect(columnHeaders.length).toBeGreaterThan(0);

      const rows = screen.getAllByRole('row');
      expect(rows.length).toBeGreaterThan(1); // Header + data rows
    });

    test('sortable headers have proper accessibility', async () => {
      const user = userEvent.setup();
      render(<SubmissionsTable {...defaultProps} />);

      const serviceDateHeader = screen.getByText('Service Date');
      expect(serviceDateHeader).toHaveAttribute('role', 'button');
      
      // Should be focusable
      serviceDateHeader.focus();
      expect(serviceDateHeader).toHaveFocus();

      // Should work with keyboard
      await user.keyboard('{Enter}');
      expect(screen.getByText(/Service Date.*↑/)).toBeInTheDocument();
    });

    test('filter inputs have proper labels', async () => {
      const user = userEvent.setup();
      render(<SubmissionsTable {...defaultProps} />);

      await user.click(screen.getByText('Show Filters'));

      expect(screen.getByLabelText('Search')).toBeInTheDocument();
      expect(screen.getByLabelText('Date From')).toBeInTheDocument();
      expect(screen.getByLabelText('Date To')).toBeInTheDocument();
      expect(screen.getByLabelText('Status')).toBeInTheDocument();
    });

    test('loading state is announced to screen readers', () => {
      render(<SubmissionsTable {...defaultProps} loading={true} />);

      expect(screen.getByText('Loading submissions...')).toHaveAttribute('aria-live');
    });
  });

  describe('Performance and Edge Cases', () => {
    test('handles large datasets without performance issues', () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => 
        createMockSubmission({ id: `sub-${i}` })
      );

      const startTime = Date.now();
      render(<SubmissionsTable {...defaultProps} submissions={largeDataset} />);
      const renderTime = Date.now() - startTime;

      // Should render within reasonable time (100ms)
      expect(renderTime).toBeLessThan(100);

      // Should only show paginated results
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBeLessThanOrEqual(21); // Header + 20 data rows
    });

    test('handles missing or undefined data gracefully', () => {
      const incompleteSubmission: SubmissionTableRow = {
        id: 'incomplete',
        userId: 'user-123',
        userName: 'Test User',
        clientName: 'Test Clinic',
        activityName: 'Test Activity',
        serviceDate: '2023-12-01',
        totalPatients: 0,
        newPatients: 0,
        followupPatients: 0,
        dnaPatients: 0,
        isDraft: false,
        submittedAt: undefined,
        createdAt: '2023-12-01T10:00:00Z',
      };

      render(<SubmissionsTable {...defaultProps} submissions={[incompleteSubmission]} />);

      expect(screen.getByText('Test Clinic')).toBeInTheDocument();
      expect(screen.getByText('-')).toBeInTheDocument(); // For missing submittedAt
    });

    test('handles rapid filter changes without errors', async () => {
      const user = userEvent.setup();
      const mockOnFilterChange = jest.fn();
      
      render(<SubmissionsTable {...defaultProps} onFilterChange={mockOnFilterChange} />);
      
      await user.click(screen.getByText('Show Filters'));
      const searchInput = screen.getByLabelText('Search');
      
      // Rapid typing should be handled gracefully
      await user.type(searchInput, 'test search query', { delay: 1 });
      
      await waitFor(() => {
        expect(mockOnFilterChange).toHaveBeenCalled();
      });
    });
  });
});