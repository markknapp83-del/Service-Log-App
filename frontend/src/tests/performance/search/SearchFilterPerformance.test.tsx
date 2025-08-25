/**
 * Search and Filter Performance Tests
 * Following documented patterns from devdocs/jest.md and devdocs/react-testing-library.md
 * Tests search/filter results < 500ms target
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { FrontendPerformanceTestUtils } from '../utils/PerformanceTestUtils';
import DashboardPage from '../../../pages/DashboardPage';
import { AuthProvider } from '../../../hooks/useAuth';

// Generate large datasets for search testing
const largePatientDataset = FrontendPerformanceTestUtils.generateLargePatientDataset(1000);
const largeServiceLogDataset = FrontendPerformanceTestUtils.generateLargeServiceLogDataset(2000, 
  largePatientDataset.slice(0, 200).map(p => p.id)
);

// Mock API responses with realistic search behavior
const mockSearchResponses = {
  patients: (searchTerm: string, filters?: any) => {
    let filteredPatients = largePatientDataset;

    if (searchTerm) {
      filteredPatients = largePatientDataset.filter(patient =>
        patient.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        patient.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        patient.phone.includes(searchTerm) ||
        patient.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filters?.status) {
      filteredPatients = filteredPatients.filter(p => p.status === filters.status);
    }

    if (filters?.dateRange) {
      filteredPatients = filteredPatients.filter(p => {
        const patientDate = new Date(p.createdAt);
        return patientDate >= new Date(filters.dateRange.start) && 
               patientDate <= new Date(filters.dateRange.end);
      });
    }

    return {
      patients: filteredPatients.slice(0, 20),
      total: filteredPatients.length,
      page: 1,
      totalPages: Math.ceil(filteredPatients.length / 20),
      searchTime: Math.random() * 100 + 50, // 50-150ms simulated search time
    };
  },

  serviceLogs: (searchTerm: string, filters?: any) => {
    let filteredLogs = largeServiceLogDataset;

    if (searchTerm) {
      filteredLogs = largeServiceLogDataset.filter(log =>
        log.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.serviceType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.notes.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filters?.status) {
      filteredLogs = filteredLogs.filter(l => l.status === filters.status);
    }

    if (filters?.serviceType) {
      filteredLogs = filteredLogs.filter(l => l.serviceType === filters.serviceType);
    }

    if (filters?.dateRange) {
      filteredLogs = filteredLogs.filter(l => {
        const logDate = new Date(l.scheduledDate);
        return logDate >= new Date(filters.dateRange.start) && 
               logDate <= new Date(filters.dateRange.end);
      });
    }

    return {
      serviceLogs: filteredLogs.slice(0, 20),
      total: filteredLogs.length,
      page: 1,
      totalPages: Math.ceil(filteredLogs.length / 20),
      searchTime: Math.random() * 150 + 80, // 80-230ms simulated search time
    };
  },
};

beforeEach(() => {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    const urlObj = new URL(url, 'http://localhost');
    const searchTerm = urlObj.searchParams.get('search') || '';
    const status = urlObj.searchParams.get('status');
    const serviceType = urlObj.searchParams.get('serviceType');
    const startDate = urlObj.searchParams.get('startDate');
    const endDate = urlObj.searchParams.get('endDate');

    const filters: any = {};
    if (status) filters.status = status;
    if (serviceType) filters.serviceType = serviceType;
    if (startDate && endDate) {
      filters.dateRange = { start: startDate, end: endDate };
    }

    // Simulate realistic API response times based on search complexity
    const baseDelay = 80;
    const searchComplexityDelay = searchTerm.length * 5;
    const filterComplexityDelay = Object.keys(filters).length * 20;
    const totalDelay = baseDelay + searchComplexityDelay + filterComplexityDelay;

    return new Promise((resolve) => {
      setTimeout(() => {
        if (url.includes('/api/patients')) {
          resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: mockSearchResponses.patients(searchTerm, filters),
            }),
          });
        } else if (url.includes('/api/service-logs')) {
          resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: mockSearchResponses.serviceLogs(searchTerm, filters),
            }),
          });
        } else if (url.includes('/api/dashboard')) {
          resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: {
                totalPatients: largePatientDataset.length,
                totalServiceLogs: largeServiceLogDataset.length,
                upcomingAppointments: 125,
                completedToday: 67,
                recentActivity: largeServiceLogDataset.slice(0, 10),
              },
            }),
          });
        } else {
          resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, data: {} }),
          });
        }
      }, totalDelay);
    });
  }) as jest.Mock;
});

afterEach(() => {
  FrontendPerformanceTestUtils.cleanup();
  jest.clearAllMocks();
});

describe('Search and Filter Performance Tests', () => {
  const SEARCH_TARGET_MS = 500;
  const FILTER_TARGET_MS = 300;
  const COMPLEX_SEARCH_TARGET_MS = 800;
  const TYPING_DEBOUNCE_TARGET_MS = 200;

  const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <AuthProvider>
        {children}
      </AuthProvider>
    </BrowserRouter>
  );

  describe('Patient Search Performance', () => {
    test('should perform patient name search within 500ms', async () => {
      const user = userEvent.setup();
      
      await act(async () => {
        render(
          <TestWrapper>
            <DashboardPage />
          </TestWrapper>
        );
      });

      // Wait for initial load
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      }, { timeout: 3000 });

      FrontendPerformanceTestUtils.startMeasurement('patient_name_search');

      // Navigate to patients section
      const patientsTab = screen.getByText(/patients/i) || screen.getByRole('button', { name: /patients/i });
      await user.click(patientsTab);

      // Perform search
      const searchInput = screen.getByPlaceholderText(/search patients/i) || 
                         screen.getByRole('textbox', { name: /search/i });
      await user.type(searchInput, 'John');

      // Wait for search results
      await waitFor(() => {
        expect(screen.getByText(/John/)).toBeInTheDocument();
      }, { timeout: 1000 });

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'patient_name_search',
        SEARCH_TARGET_MS,
        'Patient name search with results display'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(SEARCH_TARGET_MS);
    });

    test('should handle phone number search efficiently', async () => {
      const user = userEvent.setup();
      
      await act(async () => {
        render(
          <TestWrapper>
            <DashboardPage />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      const patientsTab = screen.getByText(/patients/i) || screen.getByRole('button', { name: /patients/i });
      await user.click(patientsTab);

      FrontendPerformanceTestUtils.startMeasurement('phone_number_search');

      const searchInput = screen.getByPlaceholderText(/search patients/i) || 
                         screen.getByRole('textbox', { name: /search/i });
      await user.type(searchInput, '555');

      await waitFor(() => {
        expect(screen.getByText(/555/)).toBeInTheDocument();
      }, { timeout: 1000 });

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'phone_number_search',
        SEARCH_TARGET_MS,
        'Phone number search performance'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(SEARCH_TARGET_MS);
    });

    test('should handle empty search results gracefully', async () => {
      const user = userEvent.setup();
      
      await act(async () => {
        render(
          <TestWrapper>
            <DashboardPage />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      const patientsTab = screen.getByText(/patients/i) || screen.getByRole('button', { name: /patients/i });
      await user.click(patientsTab);

      FrontendPerformanceTestUtils.startMeasurement('empty_search_results');

      const searchInput = screen.getByPlaceholderText(/search patients/i) || 
                         screen.getByRole('textbox', { name: /search/i });
      await user.type(searchInput, 'NonexistentPatientName12345');

      await waitFor(() => {
        expect(screen.getByText(/no results/i) || screen.getByText(/not found/i)).toBeInTheDocument();
      }, { timeout: 1000 });

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'empty_search_results',
        SEARCH_TARGET_MS,
        'Empty search results handling'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(SEARCH_TARGET_MS);
    });
  });

  describe('Service Log Search Performance', () => {
    test('should search service logs by patient name within 500ms', async () => {
      const user = userEvent.setup();
      
      await act(async () => {
        render(
          <TestWrapper>
            <DashboardPage />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      FrontendPerformanceTestUtils.startMeasurement('service_log_patient_search');

      const serviceLogsTab = screen.getByText(/service logs/i) || screen.getByRole('button', { name: /service/i });
      await user.click(serviceLogsTab);

      const searchInput = screen.getByPlaceholderText(/search service logs/i) || 
                         screen.getByRole('textbox', { name: /search/i });
      await user.type(searchInput, 'Patient 1');

      await waitFor(() => {
        expect(screen.getByText(/Patient 1/)).toBeInTheDocument();
      }, { timeout: 1000 });

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'service_log_patient_search',
        SEARCH_TARGET_MS,
        'Service log search by patient name'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(SEARCH_TARGET_MS);
    });

    test('should search service logs by provider efficiently', async () => {
      const user = userEvent.setup();
      
      await act(async () => {
        render(
          <TestWrapper>
            <DashboardPage />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      const serviceLogsTab = screen.getByText(/service logs/i) || screen.getByRole('button', { name: /service/i });
      await user.click(serviceLogsTab);

      FrontendPerformanceTestUtils.startMeasurement('service_log_provider_search');

      const searchInput = screen.getByPlaceholderText(/search service logs/i) || 
                         screen.getByRole('textbox', { name: /search/i });
      await user.type(searchInput, 'Dr. Provider');

      await waitFor(() => {
        expect(screen.getByText(/Dr. Provider/)).toBeInTheDocument();
      }, { timeout: 1000 });

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'service_log_provider_search',
        SEARCH_TARGET_MS,
        'Service log search by provider name'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(SEARCH_TARGET_MS);
    });
  });

  describe('Filter Performance', () => {
    test('should apply status filters quickly', async () => {
      const user = userEvent.setup();
      
      await act(async () => {
        render(
          <TestWrapper>
            <DashboardPage />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      const patientsTab = screen.getByText(/patients/i) || screen.getByRole('button', { name: /patients/i });
      await user.click(patientsTab);

      FrontendPerformanceTestUtils.startMeasurement('status_filter_application');

      // Apply status filter
      const statusFilter = screen.getByRole('combobox', { name: /status/i }) || 
                          screen.getByLabelText(/status/i);
      await user.selectOptions(statusFilter, 'active');

      await waitFor(() => {
        // Should show filtered results
        expect(screen.getAllByText(/active/i).length).toBeGreaterThan(0);
      }, { timeout: 800 });

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'status_filter_application',
        FILTER_TARGET_MS,
        'Status filter application and results update'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(FILTER_TARGET_MS);
    });

    test('should apply date range filters efficiently', async () => {
      const user = userEvent.setup();
      
      await act(async () => {
        render(
          <TestWrapper>
            <DashboardPage />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      const serviceLogsTab = screen.getByText(/service logs/i) || screen.getByRole('button', { name: /service/i });
      await user.click(serviceLogsTab);

      FrontendPerformanceTestUtils.startMeasurement('date_range_filter');

      // Apply date range filter
      const startDateInput = screen.getByLabelText(/start date/i) || 
                            screen.getByPlaceholderText(/start date/i);
      await user.type(startDateInput, '2024-01-01');

      const endDateInput = screen.getByLabelText(/end date/i) || 
                          screen.getByPlaceholderText(/end date/i);
      await user.type(endDateInput, '2024-12-31');

      const applyButton = screen.getByRole('button', { name: /apply|filter/i });
      await user.click(applyButton);

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      }, { timeout: 1000 });

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'date_range_filter',
        FILTER_TARGET_MS,
        'Date range filter application'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(FILTER_TARGET_MS);
    });

    test('should handle multiple simultaneous filters', async () => {
      const user = userEvent.setup();
      
      await act(async () => {
        render(
          <TestWrapper>
            <DashboardPage />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      const serviceLogsTab = screen.getByText(/service logs/i) || screen.getByRole('button', { name: /service/i });
      await user.click(serviceLogsTab);

      FrontendPerformanceTestUtils.startMeasurement('multiple_filters');

      // Apply multiple filters simultaneously
      const statusFilter = screen.getByRole('combobox', { name: /status/i }) || 
                          screen.getByLabelText(/status/i);
      await user.selectOptions(statusFilter, 'completed');

      const serviceTypeFilter = screen.getByRole('combobox', { name: /service type/i }) || 
                               screen.getByLabelText(/service type/i);
      await user.selectOptions(serviceTypeFilter, 'consultation');

      const startDateInput = screen.getByLabelText(/start date/i);
      await user.type(startDateInput, '2024-01-01');

      const applyButton = screen.getByRole('button', { name: /apply|filter/i });
      await user.click(applyButton);

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      }, { timeout: 1500 });

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'multiple_filters',
        COMPLEX_SEARCH_TARGET_MS,
        'Multiple simultaneous filter application'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(COMPLEX_SEARCH_TARGET_MS);
    });
  });

  describe('Search Debouncing Performance', () => {
    test('should debounce search input efficiently', async () => {
      const user = userEvent.setup({ delay: null }); // No delay for rapid typing
      
      await act(async () => {
        render(
          <TestWrapper>
            <DashboardPage />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      const patientsTab = screen.getByText(/patients/i) || screen.getByRole('button', { name: /patients/i });
      await user.click(patientsTab);

      FrontendPerformanceTestUtils.startMeasurement('search_debouncing');

      const searchInput = screen.getByPlaceholderText(/search patients/i) || 
                         screen.getByRole('textbox', { name: /search/i });

      // Simulate rapid typing
      await user.type(searchInput, 'J');
      await user.type(searchInput, 'o');
      await user.type(searchInput, 'h');
      await user.type(searchInput, 'n');

      // Wait for debounced search to trigger
      await waitFor(() => {
        expect(screen.getByDisplayValue('John')).toBeInTheDocument();
      }, { timeout: 1000 });

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'search_debouncing',
        TYPING_DEBOUNCE_TARGET_MS,
        'Search input debouncing during rapid typing'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(TYPING_DEBOUNCE_TARGET_MS);

      // Verify that search was debounced (should have made fewer API calls than keystrokes)
      const fetchCalls = (global.fetch as jest.Mock).mock.calls;
      const searchCalls = fetchCalls.filter(call => call[0].includes('search='));
      expect(searchCalls.length).toBeLessThan(4); // Should be debounced, not one call per letter
    });

    test('should handle rapid filter changes without performance degradation', async () => {
      const user = userEvent.setup({ delay: null });
      
      await act(async () => {
        render(
          <TestWrapper>
            <DashboardPage />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      const serviceLogsTab = screen.getByText(/service logs/i) || screen.getByRole('button', { name: /service/i });
      await user.click(serviceLogsTab);

      FrontendPerformanceTestUtils.startMeasurement('rapid_filter_changes');

      const statusFilter = screen.getByRole('combobox', { name: /status/i }) || 
                          screen.getByLabelText(/status/i);

      // Rapidly change filters
      await user.selectOptions(statusFilter, 'scheduled');
      await user.selectOptions(statusFilter, 'completed');
      await user.selectOptions(statusFilter, 'cancelled');
      await user.selectOptions(statusFilter, 'in-progress');

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      }, { timeout: 1000 });

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'rapid_filter_changes',
        FILTER_TARGET_MS * 2, // Allow more time for rapid changes
        'Rapid sequential filter changes'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(FILTER_TARGET_MS * 2);
    });
  });

  describe('Large Dataset Search Performance', () => {
    test('should handle search on 1000+ records efficiently', async () => {
      const user = userEvent.setup();
      
      await act(async () => {
        render(
          <TestWrapper>
            <DashboardPage />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      const patientsTab = screen.getByText(/patients/i) || screen.getByRole('button', { name: /patients/i });
      await user.click(patientsTab);

      FrontendPerformanceTestUtils.startMeasurement('large_dataset_search');

      // Search in large dataset
      const searchInput = screen.getByPlaceholderText(/search patients/i) || 
                         screen.getByRole('textbox', { name: /search/i });
      await user.type(searchInput, 'Patient');

      await waitFor(() => {
        expect(screen.getAllByText(/Patient/).length).toBeGreaterThan(0);
      }, { timeout: 1500 });

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'large_dataset_search',
        COMPLEX_SEARCH_TARGET_MS,
        'Search performance on 1000+ patient records'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(COMPLEX_SEARCH_TARGET_MS);
    });

    test('should maintain performance with complex search patterns', async () => {
      const user = userEvent.setup();
      
      await act(async () => {
        render(
          <TestWrapper>
            <DashboardPage />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      const serviceLogsTab = screen.getByText(/service logs/i) || screen.getByRole('button', { name: /service/i });
      await user.click(serviceLogsTab);

      FrontendPerformanceTestUtils.startMeasurement('complex_search_patterns');

      // Perform complex search with partial matches
      const searchInput = screen.getByPlaceholderText(/search service logs/i) || 
                         screen.getByRole('textbox', { name: /search/i });
      await user.type(searchInput, 'consultation routine');

      await waitFor(() => {
        expect(screen.getByText(/consultation/i)).toBeInTheDocument();
      }, { timeout: 1500 });

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'complex_search_patterns',
        COMPLEX_SEARCH_TARGET_MS,
        'Complex multi-word search patterns'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(COMPLEX_SEARCH_TARGET_MS);
    });
  });

  describe('Search Result Navigation Performance', () => {
    test('should paginate search results efficiently', async () => {
      const user = userEvent.setup();
      
      await act(async () => {
        render(
          <TestWrapper>
            <DashboardPage />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      const patientsTab = screen.getByText(/patients/i) || screen.getByRole('button', { name: /patients/i });
      await user.click(patientsTab);

      // Perform search first
      const searchInput = screen.getByPlaceholderText(/search patients/i) || 
                         screen.getByRole('textbox', { name: /search/i });
      await user.type(searchInput, 'First');

      await waitFor(() => {
        expect(screen.getByText(/First/)).toBeInTheDocument();
      });

      FrontendPerformanceTestUtils.startMeasurement('search_result_pagination');

      // Navigate to next page of results
      const nextPageButton = screen.getByRole('button', { name: /next|>/ }) || 
                             screen.getByText(/2/); // Page 2 button
      await user.click(nextPageButton);

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      }, { timeout: 1000 });

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'search_result_pagination',
        FILTER_TARGET_MS,
        'Search result pagination navigation'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(FILTER_TARGET_MS);
    });
  });

  describe('Memory Performance During Search Operations', () => {
    test('should not leak memory during repeated searches', async () => {
      const memoryMonitor = FrontendPerformanceTestUtils.monitorComponentMemory('search_memory');
      memoryMonitor.start();

      const user = userEvent.setup();
      
      await act(async () => {
        render(
          <TestWrapper>
            <DashboardPage />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });

      const patientsTab = screen.getByText(/patients/i) || screen.getByRole('button', { name: /patients/i });
      await user.click(patientsTab);

      const searchInput = screen.getByPlaceholderText(/search patients/i) || 
                         screen.getByRole('textbox', { name: /search/i });

      // Perform multiple searches
      const searchTerms = ['John', 'Smith', 'Doctor', '555', 'test@'];
      
      for (let i = 0; i < searchTerms.length; i++) {
        FrontendPerformanceTestUtils.startMeasurement(`search_${i}`);

        await user.clear(searchInput);
        await user.type(searchInput, searchTerms[i]);

        await waitFor(() => {
          expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
        }, { timeout: 1000 });

        const benchmark = FrontendPerformanceTestUtils.assertPerformance(
          `search_${i}`,
          SEARCH_TARGET_MS,
          `Search ${i + 1}: "${searchTerms[i]}"`
        );

        expect(benchmark.passed).toBe(true);

        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
        });
      }

      const memoryResult = memoryMonitor.end();
      
      // Memory should not increase significantly during multiple searches
      expect(FrontendPerformanceTestUtils.assertNoMemoryLeak(
        0, 
        memoryResult.memoryDelta, 
        15 * 1024 * 1024 // 15MB threshold for search operations
      )).toBe(true);

      console.log(`Memory usage after ${searchTerms.length} searches: ${(memoryResult.memoryDelta / 1024 / 1024).toFixed(2)}MB delta`);
    });
  });
});