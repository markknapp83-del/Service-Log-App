// Submissions Table component following shadcn/ui data table patterns with performance optimizations
import React, { useState, useMemo, useCallback, memo, startTransition, useRef, useEffect } from 'react';
import { ServiceLog, Client, Activity, User, AppointmentType } from '../types';
import { Button } from './Button';
import { Select } from './Select';
import { Input } from './Input';
import { Card } from './Card';

// Type definitions for table data
export interface SubmissionTableRow {
  id: string;
  userId: string;
  userName: string;
  clientName: string;
  activityName: string;
  serviceDate: string;
  totalPatients: number;
  newPatients: number;
  followupPatients: number;
  dnaPatients: number;
  isDraft: boolean;
  submittedAt?: string;
  createdAt: string;
}

export interface SubmissionsTableProps {
  submissions: SubmissionTableRow[];
  loading?: boolean;
  onViewDetails: (submissionId: string) => void;
  onExport?: (format: 'csv' | 'excel') => Promise<void>;
  onFilterChange?: (filters: SubmissionFilters) => void;
}

export interface SubmissionFilters {
  dateFrom?: string;
  dateTo?: string;
  clientId?: string;
  activityId?: string;
  userId?: string;
  isDraft?: boolean;
  searchTerm?: string;
}

// Sorting types
type SortField = 'serviceDate' | 'clientName' | 'activityName' | 'totalPatients' | 'submittedAt';
type SortDirection = 'asc' | 'desc';

interface SortState {
  field: SortField;
  direction: SortDirection;
}

// Debounce hook for search input
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
}

// Memoized table row component
interface TableRowProps {
  submission: SubmissionTableRow;
  onViewDetails: (id: string) => void;
  formatDate: (date: string) => string;
  formatDateTime: (date: string) => string;
}

const TableRow = memo<TableRowProps>(({ submission, onViewDetails, formatDate, formatDateTime }) => (
  <tr key={submission.id} className="hover:bg-gray-50">
    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
      {formatDate(submission.serviceDate)}
    </td>
    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
      {submission.userName}
    </td>
    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
      {submission.clientName}
    </td>
    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
      {submission.activityName}
    </td>
    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
      {submission.totalPatients}
    </td>
    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
      <div className="space-y-1">
        <div className="text-xs">New: {submission.newPatients}</div>
        <div className="text-xs">Follow-up: {submission.followupPatients}</div>
        <div className="text-xs">DNA: {submission.dnaPatients}</div>
      </div>
    </td>
    <td className="px-6 py-4 whitespace-nowrap">
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        submission.isDraft 
          ? 'bg-yellow-100 text-yellow-800' 
          : 'bg-green-100 text-green-800'
      }`}>
        {submission.isDraft ? 'Draft' : 'Submitted'}
      </span>
    </td>
    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
      {submission.submittedAt ? formatDateTime(submission.submittedAt) : '-'}
    </td>
    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onViewDetails(submission.id)}
      >
        View Details
      </Button>
    </td>
  </tr>
));

TableRow.displayName = 'TableRow';

export const SubmissionsTable = memo<SubmissionsTableProps>(({ 
  submissions, 
  loading = false, 
  onViewDetails,
  onExport,
  onFilterChange 
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortState, setSortState] = useState<SortState>({ field: 'submittedAt', direction: 'desc' });
  const [filters, setFilters] = useState<SubmissionFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Debounced search term to prevent excessive filtering
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  
  // Refs for performance tracking
  const renderStartTime = useRef<number>(Date.now());
  const tableContainerRef = useRef<HTMLDivElement>(null);
  
  // Track render performance in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const renderTime = Date.now() - renderStartTime.current;
      if (renderTime > 100) {
        console.warn(`SubmissionsTable render took ${renderTime}ms`);
      }
    }
    renderStartTime.current = Date.now();
  });

  // Memoized date formatters to prevent recreation on every render
  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }, []);

  const formatDateTime = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  // Filter and sort submissions with React 18 performance optimizations
  const filteredAndSortedSubmissions = useMemo(() => {
    // Early return for empty data
    if (!submissions || submissions.length === 0) {
      return [];
    }

    let filtered = submissions;

    // Use debounced search term for better performance
    const effectiveSearchTerm = filters.searchTerm || debouncedSearchTerm;
    if (effectiveSearchTerm) {
      const searchLower = effectiveSearchTerm.toLowerCase().trim();
      if (searchLower.length > 0) {
        filtered = filtered.filter(sub => {
          // Use includes for better performance than regex
          return (
            sub.userName.toLowerCase().includes(searchLower) ||
            sub.clientName.toLowerCase().includes(searchLower) ||
            sub.activityName.toLowerCase().includes(searchLower)
          );
        });
      }
    }

    // Optimized date filtering with proper date comparison
    if (filters.dateFrom) {
      const fromDate = filters.dateFrom;
      filtered = filtered.filter(sub => sub.serviceDate >= fromDate);
    }

    if (filters.dateTo) {
      const toDate = filters.dateTo;
      filtered = filtered.filter(sub => sub.serviceDate <= toDate);
    }

    if (filters.clientId) {
      filtered = filtered.filter(sub => sub.clientName === filters.clientId);
    }

    if (filters.activityId) {
      filtered = filtered.filter(sub => sub.activityName === filters.activityId);
    }

    if (filters.isDraft !== undefined) {
      const isDraftFilter = filters.isDraft;
      filtered = filtered.filter(sub => sub.isDraft === isDraftFilter);
    }

    // Optimized sorting with memoized comparison functions
    if (filtered.length > 1) {
      filtered.sort((a, b) => {
        let valueA: any = a[sortState.field];
        let valueB: any = b[sortState.field];

        // Handle null/undefined values
        if (valueA == null && valueB == null) return 0;
        if (valueA == null) return 1;
        if (valueB == null) return -1;

        // Handle date strings with cached Date objects for better performance
        if (sortState.field === 'serviceDate' || sortState.field === 'submittedAt') {
          valueA = new Date(valueA).getTime();
          valueB = new Date(valueB).getTime();
        } else if (typeof valueA === 'string' && typeof valueB === 'string') {
          // Use localeCompare for better string sorting
          const comparison = valueA.localeCompare(valueB);
          return sortState.direction === 'desc' ? -comparison : comparison;
        }

        let comparison = 0;
        if (valueA < valueB) comparison = -1;
        if (valueA > valueB) comparison = 1;

        return sortState.direction === 'desc' ? -comparison : comparison;
      });
    }

    return filtered;
  }, [submissions, filters, sortState, debouncedSearchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedSubmissions.length / pageSize);
  const paginatedSubmissions = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredAndSortedSubmissions.slice(startIndex, startIndex + pageSize);
  }, [filteredAndSortedSubmissions, currentPage, pageSize]);

  // Handle sorting with React 18 concurrent features
  const handleSort = useCallback((field: SortField) => {
    startTransition(() => {
      setSortState(prev => ({
        field,
        direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
      }));
    });
  }, []);

  // Handle filter changes with React 18 concurrent features and performance optimizations
  const handleFilterChange = useCallback((newFilters: Partial<SubmissionFilters>) => {
    startTransition(() => {
      const updatedFilters = { ...filters, ...newFilters };
      setFilters(updatedFilters);
      setCurrentPage(1); // Reset to first page when filtering
      onFilterChange?.(updatedFilters);
    });
  }, [filters, onFilterChange]);

  // Optimized search handler with immediate local update
  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    // Update filters with debounced value
    startTransition(() => {
      handleFilterChange({ searchTerm: value });
    });
  }, [handleFilterChange]);

  // Clear filters
  const clearFilters = useCallback(() => {
    const emptyFilters = {};
    setFilters(emptyFilters);
    setCurrentPage(1);
    onFilterChange?.(emptyFilters);
  }, [onFilterChange]);

  // Generate sort indicator
  const getSortIndicator = (field: SortField) => {
    if (sortState.field !== field) return '';
    return sortState.direction === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Service Log Submissions</h2>
          <p className="text-sm text-gray-600">
            {filteredAndSortedSubmissions.length} submission{filteredAndSortedSubmissions.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="text-sm"
          >
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </Button>
          
          {onExport && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onExport('csv')}
                className="text-sm"
                disabled={loading}
              >
                Export CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => onExport('excel')}
                className="text-sm"
                disabled={loading}
              >
                Export Excel
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <Input
                type="text"
                placeholder="User, client, or activity..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date From
              </label>
              <Input
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => handleFilterChange({ dateFrom: e.target.value })}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date To
              </label>
              <Input
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => handleFilterChange({ dateTo: e.target.value })}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <Select
                value={filters.isDraft !== undefined ? (filters.isDraft ? 'draft' : 'submitted') : ''}
                onChange={(value) => handleFilterChange({ 
                  isDraft: value === '' ? undefined : value === 'draft' 
                })}
                className="w-full"
              >
                <option value="">All Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="draft">Draft</option>
              </Select>
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <Button
              variant="outline"
              onClick={clearFilters}
              className="text-sm"
            >
              Clear Filters
            </Button>
          </div>
        </Card>
      )}

      {/* Table */}
      <Card className="overflow-hidden">
        {loading && (
          <div className="p-8 text-center">
            <div className="animate-spin inline-block w-6 h-6 border-[3px] border-current border-t-transparent text-blue-600 rounded-full" />
            <span className="ml-2 text-gray-600">Loading submissions...</span>
          </div>
        )}

        {!loading && paginatedSubmissions.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            {filteredAndSortedSubmissions.length === 0 ? (
              filters.searchTerm || filters.dateFrom || filters.dateTo || filters.isDraft !== undefined ? (
                <div>
                  <p className="text-lg font-medium mb-2">No submissions found</p>
                  <p className="text-sm">Try adjusting your search criteria</p>
                </div>
              ) : (
                <div>
                  <p className="text-lg font-medium mb-2">No submissions yet</p>
                  <p className="text-sm">Service log submissions will appear here once created</p>
                </div>
              )
            ) : null}
          </div>
        )}

        {!loading && paginatedSubmissions.length > 0 && (
          <div className="overflow-x-auto" ref={tableContainerRef}>
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('serviceDate')}
                  >
                    Service Date{getSortIndicator('serviceDate')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('clientName')}
                  >
                    Client{getSortIndicator('clientName')}
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('activityName')}
                  >
                    Activity{getSortIndicator('activityName')}
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('totalPatients')}
                  >
                    Patients{getSortIndicator('totalPatients')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Breakdown
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('submittedAt')}
                  >
                    Submitted{getSortIndicator('submittedAt')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedSubmissions.map((submission) => (
                  <TableRow
                    key={submission.id}
                    submission={submission}
                    onViewDetails={onViewDetails}
                    formatDate={formatDate}
                    formatDateTime={formatDateTime}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-3 bg-white border border-gray-200 rounded-lg">
          <div className="flex items-center text-sm text-gray-700">
            <span className="mr-2">Show</span>
            <Select
              value={pageSize.toString()}
              onChange={(value) => {
                setPageSize(parseInt(value));
                setCurrentPage(1);
              }}
              className="w-20"
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </Select>
            <span className="ml-2">per page</span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </span>
            
            <div className="flex space-x-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Summary statistics */}
      {!loading && filteredAndSortedSubmissions.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Summary Statistics</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {filteredAndSortedSubmissions.length}
              </div>
              <div className="text-xs text-gray-600">Total Submissions</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {filteredAndSortedSubmissions.reduce((sum, sub) => sum + sub.totalPatients, 0)}
              </div>
              <div className="text-xs text-gray-600">Total Patients</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {filteredAndSortedSubmissions.reduce((sum, sub) => sum + sub.newPatients, 0)}
              </div>
              <div className="text-xs text-gray-600">New Patients</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {filteredAndSortedSubmissions.reduce((sum, sub) => sum + sub.followupPatients, 0)}
              </div>
              <div className="text-xs text-gray-600">Follow-up Patients</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
});

SubmissionsTable.displayName = 'SubmissionsTable';