/**
 * Memory Leak Detection Tests for Long Sessions
 * Following documented patterns from devdocs/jest.md and devdocs/react-testing-library.md
 * Tests memory usage over extended periods and component lifecycles
 */

import React from 'react';
import { describe, test, expect, beforeEach, afterEach, beforeAll } from '@jest/globals';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { FrontendPerformanceTestUtils } from '../utils/PerformanceTestUtils';
import DashboardPage from '../../../pages/DashboardPage';
import ServiceLogPage from '../../../pages/ServiceLogPage';
import TemplateManagementPage from '../../../pages/TemplateManagementPage';
import ServiceLogForm from '../../../components/ServiceLogForm';
import SubmissionsTable from '../../../components/SubmissionsTable';
import { AuthProvider } from '../../../hooks/useAuth';

// Extended mock data for long session testing
const generateExtendedMockData = () => ({
  patients: FrontendPerformanceTestUtils.generateLargePatientDataset(500),
  serviceLogs: FrontendPerformanceTestUtils.generateLargeServiceLogDataset(1000),
  customFields: Array.from({ length: 100 }, (_, i) => ({
    id: `field-${i}`,
    name: `customField${i}`,
    label: `Custom Field ${i}`,
    type: ['text', 'select', 'checkbox', 'textarea', 'date', 'number'][i % 6],
    required: i % 5 === 0,
  })),
  dashboardData: {
    totalPatients: 2500,
    totalServiceLogs: 8000,
    upcomingAppointments: 150,
    completedToday: 89,
    recentActivity: Array.from({ length: 50 }, (_, i) => ({
      id: i,
      type: 'service_log_created',
      patient: `Patient ${i}`,
      timestamp: new Date(Date.now() - i * 3600000).toISOString(),
    })),
  },
});

const extendedMockData = generateExtendedMockData();

beforeAll(() => {
  // Ensure garbage collection is available for memory testing
  if (global.gc) {
    global.gc();
  }
});

beforeEach(() => {
  // Force garbage collection before each test
  if (global.gc) {
    global.gc();
  }

  global.fetch = jest.fn().mockImplementation((url: string, options?: any) => {
    const delay = 50 + Math.random() * 50; // 50-100ms response time
    
    return new Promise((resolve) => {
      setTimeout(() => {
        if (url.includes('/api/patients')) {
          resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: {
                patients: extendedMockData.patients.slice(0, 20),
                total: extendedMockData.patients.length,
              },
            }),
          });
        } else if (url.includes('/api/service-logs')) {
          resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: {
                serviceLogs: extendedMockData.serviceLogs.slice(0, 20),
                total: extendedMockData.serviceLogs.length,
              },
            }),
          });
        } else if (url.includes('/api/dashboard')) {
          resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: extendedMockData.dashboardData,
            }),
          });
        } else if (url.includes('/api/custom-fields')) {
          resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: extendedMockData.customFields,
            }),
          });
        } else if (options?.method === 'POST') {
          resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: { id: 'new-record-' + Date.now() },
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
  cleanup();
  jest.clearAllMocks();
  
  // Force garbage collection after each test
  if (global.gc) {
    global.gc();
  }
});

describe('Memory Leak Detection Tests', () => {
  const MEMORY_LEAK_THRESHOLD = 20 * 1024 * 1024; // 20MB
  const COMPONENT_LIFECYCLE_THRESHOLD = 10 * 1024 * 1024; // 10MB
  const LONG_SESSION_THRESHOLD = 50 * 1024 * 1024; // 50MB
  const SESSION_DURATION_MS = 10000; // 10 second simulated session

  const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <AuthProvider>
        {children}
      </AuthProvider>
    </BrowserRouter>
  );

  describe('Component Lifecycle Memory Tests', () => {
    test('should not leak memory during repeated component mounting/unmounting', async () => {
      const memoryMonitor = FrontendPerformanceTestUtils.monitorComponentMemory('component_lifecycle');
      memoryMonitor.start();

      const MountUnmountTest = () => {
        const [showDashboard, setShowDashboard] = React.useState(true);
        const [showServiceLog, setShowServiceLog] = React.useState(false);
        const [showTemplate, setShowTemplate] = React.useState(false);

        React.useEffect(() => {
          const interval = setInterval(() => {
            setShowDashboard(prev => !prev);
            setShowServiceLog(prev => !prev);
            setShowTemplate(prev => !prev);
          }, 500);

          return () => clearInterval(interval);
        }, []);

        return (
          <div>
            {showDashboard && <DashboardPage />}
            {showServiceLog && <ServiceLogPage />}
            {showTemplate && <TemplateManagementPage />}
          </div>
        );
      };

      await act(async () => {
        render(
          <TestWrapper>
            <MountUnmountTest />
          </TestWrapper>
        );
      });

      // Run for multiple cycles
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds of cycling
      });

      const memoryResult = memoryMonitor.end();

      expect(FrontendPerformanceTestUtils.assertNoMemoryLeak(
        0, 
        memoryResult.memoryDelta, 
        COMPONENT_LIFECYCLE_THRESHOLD
      )).toBe(true);

      console.log(`Component lifecycle memory usage: ${(memoryResult.memoryDelta / 1024 / 1024).toFixed(2)}MB`);
    });

    test('should not leak memory with repeated form submissions', async () => {
      const memoryMonitor = FrontendPerformanceTestUtils.monitorComponentMemory('form_submissions');
      memoryMonitor.start();

      const user = userEvent.setup();
      let submissionCount = 0;

      await act(async () => {
        render(
          <TestWrapper>
            <ServiceLogForm onSubmit={jest.fn()} />
          </TestWrapper>
        );
      });

      // Perform multiple form submissions
      for (let i = 0; i < 10; i++) {
        try {
          const patientInput = screen.getByLabelText(/patient/i);
          await user.clear(patientInput);
          await user.type(patientInput, `Patient ${i}`);

          const serviceTypeSelect = screen.getByLabelText(/service type/i);
          await user.selectOptions(serviceTypeSelect, 'consultation');

          const submitButton = screen.getByRole('button', { name: /submit|create/i });
          await user.click(submitButton);

          await waitFor(() => {
            expect(screen.queryByText(/submitting/i)).not.toBeInTheDocument();
          }, { timeout: 2000 });

          submissionCount++;

          // Brief pause between submissions
          await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
          });

          // Force garbage collection periodically
          if (i % 3 === 0 && global.gc) {
            global.gc();
          }
        } catch (error) {
          // Continue with test even if individual submission fails
          console.warn(`Form submission ${i} failed:`, error);
        }
      }

      const memoryResult = memoryMonitor.end();

      expect(submissionCount).toBeGreaterThan(5); // At least some submissions should succeed
      expect(FrontendPerformanceTestUtils.assertNoMemoryLeak(
        0, 
        memoryResult.memoryDelta, 
        MEMORY_LEAK_THRESHOLD
      )).toBe(true);

      console.log(`Form submissions memory usage (${submissionCount} submissions): ${(memoryResult.memoryDelta / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Long Session Memory Tests', () => {
    test('should maintain stable memory during extended dashboard usage', async () => {
      const memoryMonitor = FrontendPerformanceTestUtils.monitorComponentMemory('long_dashboard_session');
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

      // Simulate extended user activity
      const startTime = Date.now();
      const actions = [
        () => user.click(screen.getByText(/patients/i)),
        () => user.click(screen.getByText(/service logs/i)),
        () => user.click(screen.getByText(/dashboard/i)),
      ];

      while (Date.now() - startTime < SESSION_DURATION_MS) {
        try {
          const randomAction = actions[Math.floor(Math.random() * actions.length)];
          await randomAction();

          await waitFor(() => {
            expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
          }, { timeout: 1000 });

          // Random delay between actions (100-500ms)
          await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 400));
          });

          // Periodic garbage collection
          if (Math.random() < 0.1 && global.gc) { // 10% chance
            global.gc();
          }
        } catch (error) {
          // Continue with test even if individual action fails
          await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
          });
        }
      }

      const memoryResult = memoryMonitor.end();

      expect(FrontendPerformanceTestUtils.assertNoMemoryLeak(
        0, 
        memoryResult.memoryDelta, 
        LONG_SESSION_THRESHOLD
      )).toBe(true);

      console.log(`Long dashboard session memory usage (${SESSION_DURATION_MS}ms): ${(memoryResult.memoryDelta / 1024 / 1024).toFixed(2)}MB`);
    });

    test('should handle memory efficiently during continuous table interactions', async () => {
      const memoryMonitor = FrontendPerformanceTestUtils.monitorComponentMemory('continuous_table_interactions');
      memoryMonitor.start();

      const user = userEvent.setup();
      const tableData = FrontendPerformanceTestUtils.generateLargeServiceLogDataset(200);

      await act(async () => {
        render(
          <TestWrapper>
            <SubmissionsTable 
              data={tableData}
              loading={false}
              onRowClick={jest.fn()}
              onSort={jest.fn()}
              selectable={true}
            />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.getAllByRole('row').length).toBeGreaterThan(50);
      });

      // Continuous table interactions
      const startTime = Date.now();
      let interactionCount = 0;

      while (Date.now() - startTime < SESSION_DURATION_MS) {
        try {
          const rows = screen.getAllByRole('row').slice(1); // Skip header
          if (rows.length > 0) {
            const randomRow = rows[Math.floor(Math.random() * Math.min(rows.length, 20))];
            await user.click(randomRow);
            interactionCount++;
          }

          // Occasionally sort columns
          if (interactionCount % 10 === 0) {
            const headers = screen.getAllByRole('columnheader');
            if (headers.length > 0) {
              const randomHeader = headers[Math.floor(Math.random() * headers.length)];
              await user.click(randomHeader);
            }
          }

          await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 50));
          });

          // Periodic garbage collection
          if (interactionCount % 20 === 0 && global.gc) {
            global.gc();
          }
        } catch (error) {
          // Continue with test even if individual interaction fails
          await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 50));
          });
        }
      }

      const memoryResult = memoryMonitor.end();

      expect(interactionCount).toBeGreaterThan(50); // Should have many interactions
      expect(FrontendPerformanceTestUtils.assertNoMemoryLeak(
        0, 
        memoryResult.memoryDelta, 
        MEMORY_LEAK_THRESHOLD
      )).toBe(true);

      console.log(`Continuous table interactions memory usage (${interactionCount} interactions): ${(memoryResult.memoryDelta / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Event Listener Memory Leaks', () => {
    test('should properly clean up event listeners on component unmount', async () => {
      const memoryMonitor = FrontendPerformanceTestUtils.monitorComponentMemory('event_listener_cleanup');
      memoryMonitor.start();

      const EventHeavyComponent = () => {
        const [data, setData] = React.useState(extendedMockData.serviceLogs.slice(0, 50));

        React.useEffect(() => {
          const handleResize = () => setData(prev => [...prev]);
          const handleScroll = () => setData(prev => [...prev].reverse());
          const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'r') setData(prev => [...prev].sort(() => Math.random() - 0.5));
          };

          window.addEventListener('resize', handleResize);
          window.addEventListener('scroll', handleScroll);
          document.addEventListener('keydown', handleKeyDown);

          const interval = setInterval(() => {
            setData(prev => [...prev].slice(-45).concat(prev.slice(0, 5)));
          }, 200);

          return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('scroll', handleScroll);
            document.removeEventListener('keydown', handleKeyDown);
            clearInterval(interval);
          };
        }, []);

        return (
          <div>
            {data.slice(0, 10).map(item => (
              <div key={item.id}>{item.patientName} - {item.serviceType}</div>
            ))}
          </div>
        );
      };

      const TestContainer = () => {
        const [showComponent, setShowComponent] = React.useState(true);

        React.useEffect(() => {
          const timer = setTimeout(() => setShowComponent(false), 2000);
          return () => clearTimeout(timer);
        }, []);

        return showComponent ? <EventHeavyComponent /> : <div>Component unmounted</div>;
      };

      await act(async () => {
        render(
          <TestWrapper>
            <TestContainer />
          </TestWrapper>
        );
      });

      // Wait for component to mount, run, and unmount
      await waitFor(() => {
        expect(screen.getByText(/Component unmounted/)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Give additional time for cleanup
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
      });

      const memoryResult = memoryMonitor.end();

      expect(FrontendPerformanceTestUtils.assertNoMemoryLeak(
        0, 
        memoryResult.memoryDelta, 
        COMPONENT_LIFECYCLE_THRESHOLD
      )).toBe(true);

      console.log(`Event listener cleanup memory usage: ${(memoryResult.memoryDelta / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Context Provider Memory Tests', () => {
    test('should not leak memory with frequent context updates', async () => {
      const memoryMonitor = FrontendPerformanceTestUtils.monitorComponentMemory('context_updates');
      memoryMonitor.start();

      const TestContext = React.createContext<any>({});

      const ContextProvider = ({ children }: { children: React.ReactNode }) => {
        const [contextData, setContextData] = React.useState(extendedMockData.patients.slice(0, 20));

        React.useEffect(() => {
          const interval = setInterval(() => {
            setContextData(prev => {
              const shuffled = [...prev].sort(() => Math.random() - 0.5);
              // Add some new data and remove old data to simulate real app behavior
              return [
                ...shuffled.slice(0, 15),
                ...extendedMockData.patients.slice(Math.floor(Math.random() * 50), Math.floor(Math.random() * 50) + 5)
              ];
            });
          }, 200);

          return () => clearInterval(interval);
        }, []);

        return (
          <TestContext.Provider value={{ data: contextData, updateData: setContextData }}>
            {children}
          </TestContext.Provider>
        );
      };

      const ConsumerComponent = () => {
        const context = React.useContext(TestContext);
        
        return (
          <div>
            {context.data?.slice(0, 5).map((patient: any) => (
              <div key={patient.id}>{patient.firstName} {patient.lastName}</div>
            ))}
          </div>
        );
      };

      await act(async () => {
        render(
          <TestWrapper>
            <ContextProvider>
              <ConsumerComponent />
              <ConsumerComponent />
              <ConsumerComponent />
            </ContextProvider>
          </TestWrapper>
        );
      });

      // Let context updates run for several seconds
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 3000));
      });

      const memoryResult = memoryMonitor.end();

      expect(FrontendPerformanceTestUtils.assertNoMemoryLeak(
        0, 
        memoryResult.memoryDelta, 
        MEMORY_LEAK_THRESHOLD
      )).toBe(true);

      console.log(`Context provider updates memory usage: ${(memoryResult.memoryDelta / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('API Request Memory Tests', () => {
    test('should not accumulate memory from cancelled API requests', async () => {
      const memoryMonitor = FrontendPerformanceTestUtils.monitorComponentMemory('cancelled_api_requests');
      memoryMonitor.start();

      let requestCount = 0;
      
      // Mock fetch with potential for cancellation
      global.fetch = jest.fn().mockImplementation(() => {
        requestCount++;
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            resolve({
              ok: true,
              json: () => Promise.resolve({
                success: true,
                data: extendedMockData.patients.slice(0, 10),
              }),
            });
          }, 100 + Math.random() * 200); // Variable response time

          // Simulate request cancellation
          if (Math.random() < 0.3) { // 30% chance of cancellation
            setTimeout(() => {
              clearTimeout(timeout);
              reject(new Error('Request cancelled'));
            }, 50);
          }
        });
      });

      const ApiHeavyComponent = () => {
        const [data, setData] = React.useState([]);
        const [loading, setLoading] = React.useState(false);

        React.useEffect(() => {
          let active = true;

          const fetchData = async () => {
            setLoading(true);
            try {
              const response = await fetch('/api/patients');
              const result = await response.json();
              if (active) {
                setData(result.data.patients || []);
              }
            } catch (error) {
              // Handle cancelled requests gracefully
              if (active) {
                setData([]);
              }
            } finally {
              if (active) {
                setLoading(false);
              }
            }
          };

          const interval = setInterval(fetchData, 300);

          return () => {
            active = false;
            clearInterval(interval);
          };
        }, []);

        return (
          <div>
            {loading ? 'Loading...' : `Data count: ${data.length}`}
          </div>
        );
      };

      await act(async () => {
        render(
          <TestWrapper>
            <ApiHeavyComponent />
          </TestWrapper>
        );
      });

      // Let API requests run and potentially cancel
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 5000));
      });

      const memoryResult = memoryMonitor.end();

      expect(requestCount).toBeGreaterThan(10); // Should have made many requests
      expect(FrontendPerformanceTestUtils.assertNoMemoryLeak(
        0, 
        memoryResult.memoryDelta, 
        MEMORY_LEAK_THRESHOLD
      )).toBe(true);

      console.log(`API request memory usage (${requestCount} requests): ${(memoryResult.memoryDelta / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Timer and Interval Memory Tests', () => {
    test('should properly clean up timers and intervals', async () => {
      const memoryMonitor = FrontendPerformanceTestUtils.monitorComponentMemory('timer_cleanup');
      memoryMonitor.start();

      const TimerComponent = () => {
        const [count, setCount] = React.useState(0);

        React.useEffect(() => {
          const interval = setInterval(() => {
            setCount(prev => prev + 1);
          }, 100);

          const timeout1 = setTimeout(() => {
            setCount(prev => prev + 10);
          }, 500);

          const timeout2 = setTimeout(() => {
            setCount(prev => prev + 100);
          }, 1000);

          return () => {
            clearInterval(interval);
            clearTimeout(timeout1);
            clearTimeout(timeout2);
          };
        }, []);

        return <div>Count: {count}</div>;
      };

      const TestContainer = () => {
        const [components, setComponents] = React.useState([1]);

        React.useEffect(() => {
          const interval = setInterval(() => {
            setComponents(prev => {
              if (prev.length < 5) {
                return [...prev, prev.length + 1];
              } else {
                return [1]; // Reset to single component
              }
            });
          }, 800);

          return () => clearInterval(interval);
        }, []);

        return (
          <div>
            {components.map(id => (
              <TimerComponent key={id} />
            ))}
          </div>
        );
      };

      await act(async () => {
        render(
          <TestWrapper>
            <TestContainer />
          </TestWrapper>
        );
      });

      // Let timers run through multiple cycles
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 4000));
      });

      const memoryResult = memoryMonitor.end();

      expect(FrontendPerformanceTestUtils.assertNoMemoryLeak(
        0, 
        memoryResult.memoryDelta, 
        COMPONENT_LIFECYCLE_THRESHOLD
      )).toBe(true);

      console.log(`Timer cleanup memory usage: ${(memoryResult.memoryDelta / 1024 / 1024).toFixed(2)}MB`);
    });
  });
});