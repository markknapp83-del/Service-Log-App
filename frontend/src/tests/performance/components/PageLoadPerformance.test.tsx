/**
 * Page Load Performance Tests
 * Following documented patterns from devdocs/jest.md and devdocs/react-testing-library.md
 * Tests page load time < 2 seconds target
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { render, screen, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { FrontendPerformanceTestUtils } from '../utils/PerformanceTestUtils';
import DashboardPage from '../../../pages/DashboardPage';
import ServiceLogPage from '../../../pages/ServiceLogPage';
import TemplateManagementPage from '../../../pages/TemplateManagementPage';
import { AuthProvider } from '../../../hooks/useAuth';

// Mock API responses for consistent performance testing
const mockApiResponses = {
  patients: FrontendPerformanceTestUtils.generateLargePatientDataset(100),
  serviceLogs: FrontendPerformanceTestUtils.generateLargeServiceLogDataset(200),
  customFields: Array.from({ length: 50 }, (_, i) => ({
    id: `field-${i}`,
    name: `Field ${i}`,
    type: 'text',
    required: i % 3 === 0,
  })),
  dashboard: {
    totalPatients: 1250,
    totalServiceLogs: 3500,
    upcomingAppointments: 45,
    completedToday: 23,
    recentActivity: Array.from({ length: 10 }, (_, i) => ({
      id: i,
      type: 'service_log_created',
      patient: `Patient ${i}`,
      timestamp: new Date(Date.now() - i * 3600000).toISOString(),
    })),
  },
};

// Mock fetch for consistent API responses
beforeEach(() => {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    const delay = 50 + Math.random() * 100; // 50-150ms API response time
    
    return new Promise((resolve) => {
      setTimeout(() => {
        if (url.includes('/api/patients')) {
          resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: {
                patients: mockApiResponses.patients.slice(0, 20),
                total: mockApiResponses.patients.length,
                page: 1,
                totalPages: Math.ceil(mockApiResponses.patients.length / 20),
              },
            }),
          });
        } else if (url.includes('/api/service-logs')) {
          resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: {
                serviceLogs: mockApiResponses.serviceLogs.slice(0, 20),
                total: mockApiResponses.serviceLogs.length,
                page: 1,
                totalPages: Math.ceil(mockApiResponses.serviceLogs.length / 20),
              },
            }),
          });
        } else if (url.includes('/api/dashboard')) {
          resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: mockApiResponses.dashboard,
            }),
          });
        } else if (url.includes('/api/custom-fields')) {
          resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: mockApiResponses.customFields,
            }),
          });
        } else {
          resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, data: {} }),
          });
        }
      }, delay);
    });
  }) as jest.Mock;
});

afterEach(() => {
  FrontendPerformanceTestUtils.cleanup();
  jest.clearAllMocks();
});

describe('Page Load Performance Tests', () => {
  const PAGE_LOAD_TARGET_MS = 2000;
  const COMPONENT_MOUNT_TARGET_MS = 500;
  const DATA_FETCH_TARGET_MS = 1000;

  const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <AuthProvider>
        {children}
      </AuthProvider>
    </BrowserRouter>
  );

  describe('Dashboard Page Performance', () => {
    test('should load dashboard page within 2 seconds', async () => {
      FrontendPerformanceTestUtils.startMeasurement('dashboard_page_load');

      await act(async () => {
        render(
          <TestWrapper>
            <DashboardPage />
          </TestWrapper>
        );
      });

      // Wait for all data to load
      await waitFor(
        () => {
          expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'dashboard_page_load',
        PAGE_LOAD_TARGET_MS,
        'Dashboard page initial load with data fetching'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(PAGE_LOAD_TARGET_MS);

      // Verify essential content is rendered
      expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
      expect(screen.getByText(/total patients/i)).toBeInTheDocument();
      expect(screen.getByText(/1250/)).toBeInTheDocument(); // Patient count
    });

    test('should handle dashboard with large dataset efficiently', async () => {
      // Mock larger dataset
      const largeDashboardData = {
        ...mockApiResponses.dashboard,
        totalPatients: 10000,
        totalServiceLogs: 50000,
        recentActivity: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          type: 'service_log_created',
          patient: `Patient ${i}`,
          timestamp: new Date(Date.now() - i * 3600000).toISOString(),
        })),
      };

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/api/dashboard')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: largeDashboardData,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: {} }),
        });
      });

      FrontendPerformanceTestUtils.startMeasurement('dashboard_large_dataset');

      await act(async () => {
        render(
          <TestWrapper>
            <DashboardPage />
          </TestWrapper>
        );
      });

      await waitFor(
        () => {
          expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'dashboard_large_dataset',
        PAGE_LOAD_TARGET_MS,
        'Dashboard with large dataset (10k+ records)'
      );

      expect(benchmark.passed).toBe(true);
      expect(screen.getByText(/10000/)).toBeInTheDocument(); // Large patient count
    });
  });

  describe('Service Log Page Performance', () => {
    test('should load service log page within 2 seconds', async () => {
      FrontendPerformanceTestUtils.startMeasurement('service_log_page_load');

      await act(async () => {
        render(
          <TestWrapper>
            <ServiceLogPage />
          </TestWrapper>
        );
      });

      await waitFor(
        () => {
          expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'service_log_page_load',
        PAGE_LOAD_TARGET_MS,
        'Service log page with form and data loading'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(PAGE_LOAD_TARGET_MS);

      // Verify form elements are rendered
      expect(screen.getByText(/service log/i)).toBeInTheDocument();
      expect(screen.getByRole('form')).toBeInTheDocument();
    });

    test('should load service log form with custom fields efficiently', async () => {
      // Mock complex custom fields
      const complexCustomFields = Array.from({ length: 100 }, (_, i) => ({
        id: `field-${i}`,
        name: `complexField${i}`,
        label: `Complex Field ${i}`,
        type: ['text', 'select', 'checkbox', 'textarea', 'date'][i % 5],
        required: i % 3 === 0,
        options: i % 5 === 1 ? [`Option ${i}A`, `Option ${i}B`, `Option ${i}C`] : undefined,
        validation: {
          minLength: i % 5 === 0 ? 5 : undefined,
          maxLength: i % 5 === 0 ? 100 : undefined,
          pattern: i % 7 === 0 ? '^[A-Za-z0-9]+$' : undefined,
        },
      }));

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/api/custom-fields')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: complexCustomFields,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: {} }),
        });
      });

      FrontendPerformanceTestUtils.startMeasurement('service_log_complex_form');

      await act(async () => {
        render(
          <TestWrapper>
            <ServiceLogPage />
          </TestWrapper>
        );
      });

      await waitFor(
        () => {
          expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
        },
        { timeout: 4000 }
      );

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'service_log_complex_form',
        PAGE_LOAD_TARGET_MS * 1.5, // Allow more time for complex form
        'Service log page with 100+ custom fields'
      );

      expect(benchmark.passed).toBe(true);
    });
  });

  describe('Template Management Page Performance', () => {
    test('should load template management page within 2 seconds', async () => {
      FrontendPerformanceTestUtils.startMeasurement('template_page_load');

      await act(async () => {
        render(
          <TestWrapper>
            <TemplateManagementPage />
          </TestWrapper>
        );
      });

      await waitFor(
        () => {
          expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'template_page_load',
        PAGE_LOAD_TARGET_MS,
        'Template management page with field configuration'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(PAGE_LOAD_TARGET_MS);

      // Verify template management elements
      expect(screen.getByText(/template/i)).toBeInTheDocument();
    });
  });

  describe('Memory Usage During Page Loads', () => {
    test('should maintain reasonable memory usage during page navigation', async () => {
      const memoryMonitor = FrontendPerformanceTestUtils.monitorComponentMemory('page_navigation');
      memoryMonitor.start();

      // Navigate through multiple pages
      const pages = [
        () => render(<TestWrapper><DashboardPage /></TestWrapper>),
        () => render(<TestWrapper><ServiceLogPage /></TestWrapper>),
        () => render(<TestWrapper><TemplateManagementPage /></TestWrapper>),
      ];

      for (let i = 0; i < pages.length; i++) {
        FrontendPerformanceTestUtils.startMeasurement(`page_${i}_load`);
        
        await act(async () => {
          pages[i]();
        });

        await waitFor(
          () => {
            expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
          },
          { timeout: 2000 }
        );

        const benchmark = FrontendPerformanceTestUtils.assertPerformance(
          `page_${i}_load`,
          PAGE_LOAD_TARGET_MS,
          `Page ${i} load during navigation sequence`
        );

        expect(benchmark.passed).toBe(true);

        // Small delay between page loads
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
        });
      }

      const memoryResult = memoryMonitor.end();
      
      // Memory usage should not increase dramatically during navigation
      expect(memoryResult.memoryDelta).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
    });
  });

  describe('Slow Network Conditions', () => {
    test('should handle slow network gracefully while maintaining performance targets', async () => {
      // Simulate slower network
      global.fetch = jest.fn().mockImplementation((url: string) => {
        const delay = 300 + Math.random() * 200; // 300-500ms delay
        
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: () => Promise.resolve({
                success: true,
                data: url.includes('/api/patients') ? 
                  { patients: mockApiResponses.patients.slice(0, 20), total: 100 } :
                  mockApiResponses.dashboard,
              }),
            });
          }, delay);
        });
      });

      FrontendPerformanceTestUtils.startMeasurement('slow_network_load');

      await act(async () => {
        render(
          <TestWrapper>
            <DashboardPage />
          </TestWrapper>
        );
      });

      await waitFor(
        () => {
          expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'slow_network_load',
        PAGE_LOAD_TARGET_MS * 1.5, // Allow more time for slow network
        'Page load under slow network conditions'
      );

      expect(benchmark.passed).toBe(true);

      // Verify loading states were shown appropriately
      expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
    });
  });

  describe('Progressive Loading Performance', () => {
    test('should show initial content quickly even with slow data loading', async () => {
      let dataLoadResolve: () => void;
      const dataLoadPromise = new Promise<void>(resolve => {
        dataLoadResolve = resolve;
      });

      // Mock delayed data loading
      global.fetch = jest.fn().mockImplementation(() => {
        return dataLoadPromise.then(() => ({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockApiResponses.dashboard,
          }),
        }));
      });

      FrontendPerformanceTestUtils.startMeasurement('progressive_loading');

      await act(async () => {
        render(
          <TestWrapper>
            <DashboardPage />
          </TestWrapper>
        );
      });

      // Should show initial layout quickly
      const initialBenchmark = FrontendPerformanceTestUtils.assertPerformance(
        'progressive_loading',
        COMPONENT_MOUNT_TARGET_MS, // Stricter target for initial render
        'Initial component mount without data'
      );

      expect(initialBenchmark.passed).toBe(true);

      // Verify loading state is shown
      expect(screen.getByText(/loading/i)).toBeInTheDocument();

      // Release data loading
      FrontendPerformanceTestUtils.startMeasurement('data_loading_complete');
      dataLoadResolve!();

      await waitFor(
        () => {
          expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      const dataLoadBenchmark = FrontendPerformanceTestUtils.assertPerformance(
        'data_loading_complete',
        DATA_FETCH_TARGET_MS,
        'Data loading completion'
      );

      expect(dataLoadBenchmark.passed).toBe(true);
    });
  });

  describe('Error State Performance', () => {
    test('should handle API errors efficiently without performance degradation', async () => {
      global.fetch = jest.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({
            success: false,
            error: { message: 'Server error' },
          }),
        });
      });

      FrontendPerformanceTestUtils.startMeasurement('error_state_performance');

      await act(async () => {
        render(
          <TestWrapper>
            <DashboardPage />
          </TestWrapper>
        );
      });

      await waitFor(
        () => {
          expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
        },
        { timeout: 2000 }
      );

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'error_state_performance',
        COMPONENT_MOUNT_TARGET_MS,
        'Error state rendering performance'
      );

      expect(benchmark.passed).toBe(true);

      // Verify error state is shown appropriately
      expect(screen.getByText(/error/i) || screen.getByText(/failed/i)).toBeInTheDocument();
    });
  });
});