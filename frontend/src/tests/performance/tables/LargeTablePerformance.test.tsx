/**
 * Large Table Rendering Performance Tests
 * Following documented patterns from devdocs/jest.md and devdocs/react-testing-library.md
 * Tests large table rendering and interaction performance
 */

import React from 'react';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { FrontendPerformanceTestUtils } from '../utils/PerformanceTestUtils';
import SubmissionsTable from '../../../components/SubmissionsTable';
import { AuthProvider } from '../../../hooks/useAuth';

// Generate large datasets for table testing
const generateLargeTableData = (rows: number) => {
  return Array.from({ length: rows }, (_, index) => ({
    id: `submission-${index.toString().padStart(6, '0')}`,
    patientName: `Patient ${index % 100} ${['Smith', 'Johnson', 'Williams', 'Brown', 'Jones'][index % 5]}`,
    serviceType: ['consultation', 'procedure', 'therapy', 'diagnostic', 'follow-up', 'surgery'][index % 6],
    provider: `Dr. ${['Anderson', 'Thompson', 'Garcia', 'Martinez', 'Robinson'][index % 5]}`,
    scheduledDate: new Date(Date.now() + (index * 3600000)).toISOString().split('T')[0],
    status: ['scheduled', 'in-progress', 'completed', 'cancelled'][index % 4],
    priority: ['routine', 'urgent', 'emergency'][index % 3],
    duration: [15, 30, 45, 60, 90, 120][index % 6],
    notes: `Service notes for submission ${index}. This includes detailed information about the patient's condition, treatment plan, and any special considerations for this service.`,
    customFields: {
      symptoms: `Symptoms for patient ${index}`,
      vitals: {
        bloodPressure: `${110 + (index % 50)}/${70 + (index % 20)}`,
        heartRate: 60 + (index % 60),
        temperature: 98.6 + ((index % 10) - 5) * 0.1,
      },
      medications: ['Med A', 'Med B', 'Med C'].slice(0, (index % 3) + 1),
      allergies: index % 7 === 0 ? ['Penicillin', 'Latex'] : [],
    },
    createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - Math.random() * 5 * 24 * 60 * 60 * 1000).toISOString(),
  }));
};

// Mock data for different table sizes
const tableDatasets = {
  small: generateLargeTableData(50),
  medium: generateLargeTableData(200),
  large: generateLargeTableData(1000),
  xlarge: generateLargeTableData(5000),
};

beforeEach(() => {
  // Mock ResizeObserver for table virtualization
  global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));

  // Mock IntersectionObserver for lazy loading
  global.IntersectionObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));

  global.fetch = jest.fn().mockImplementation((url: string) => {
    const urlObj = new URL(url, 'http://localhost');
    const page = parseInt(urlObj.searchParams.get('page') || '1');
    const limit = parseInt(urlObj.searchParams.get('limit') || '20');
    const sortBy = urlObj.searchParams.get('sortBy');
    const sortOrder = urlObj.searchParams.get('sortOrder');

    let data = tableDatasets.large;

    // Apply sorting if specified
    if (sortBy) {
      data = [...data].sort((a: any, b: any) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = data.slice(startIndex, endIndex);

    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          submissions: paginatedData,
          total: data.length,
          page,
          limit,
          totalPages: Math.ceil(data.length / limit),
        },
      }),
    });
  }) as jest.Mock;
});

afterEach(() => {
  FrontendPerformanceTestUtils.cleanup();
  jest.clearAllMocks();
});

describe('Large Table Rendering Performance Tests', () => {
  const TABLE_RENDER_TARGET_MS = 500;
  const TABLE_SCROLL_TARGET_MS = 100;
  const TABLE_SORT_TARGET_MS = 300;
  const LARGE_TABLE_TARGET_MS = 1000;
  const ROW_SELECTION_TARGET_MS = 50;

  const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <AuthProvider>
        {children}
      </AuthProvider>
    </BrowserRouter>
  );

  describe('Initial Table Rendering Performance', () => {
    test('should render table with 50 rows within 500ms', async () => {
      FrontendPerformanceTestUtils.startMeasurement('small_table_render');

      await act(async () => {
        render(
          <TestWrapper>
            <SubmissionsTable 
              data={tableDatasets.small}
              loading={false}
              onRowClick={jest.fn()}
              onSort={jest.fn()}
            />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.getAllByRole('row').length).toBeGreaterThan(50);
      });

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'small_table_render',
        TABLE_RENDER_TARGET_MS,
        'Small table (50 rows) initial render'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(TABLE_RENDER_TARGET_MS);
    });

    test('should render table with 200 rows within 500ms', async () => {
      FrontendPerformanceTestUtils.startMeasurement('medium_table_render');

      await act(async () => {
        render(
          <TestWrapper>
            <SubmissionsTable 
              data={tableDatasets.medium}
              loading={false}
              onRowClick={jest.fn()}
              onSort={jest.fn()}
            />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.getAllByRole('row').length).toBeGreaterThan(100);
      });

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'medium_table_render',
        TABLE_RENDER_TARGET_MS,
        'Medium table (200 rows) initial render'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(TABLE_RENDER_TARGET_MS);
    });

    test('should render virtualized table with 1000 rows within 1 second', async () => {
      FrontendPerformanceTestUtils.startMeasurement('large_table_render');

      await act(async () => {
        render(
          <TestWrapper>
            <SubmissionsTable 
              data={tableDatasets.large}
              loading={false}
              onRowClick={jest.fn()}
              onSort={jest.fn()}
              virtualized={true}
            />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        // With virtualization, only visible rows should be rendered
        expect(screen.getAllByRole('row').length).toBeLessThan(100); // Should be much less than 1000
        expect(screen.getByText(/Patient 0/)).toBeInTheDocument(); // First row should be visible
      });

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'large_table_render',
        LARGE_TABLE_TARGET_MS,
        'Large virtualized table (1000 rows) initial render'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(LARGE_TABLE_TARGET_MS);
    });

    test('should handle extremely large dataset with 5000 rows efficiently', async () => {
      FrontendPerformanceTestUtils.startMeasurement('xlarge_table_render');

      await act(async () => {
        render(
          <TestWrapper>
            <SubmissionsTable 
              data={tableDatasets.xlarge}
              loading={false}
              onRowClick={jest.fn()}
              onSort={jest.fn()}
              virtualized={true}
              pageSize={50} // Smaller page size for large datasets
            />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        // Should render efficiently with pagination
        expect(screen.getAllByRole('row').length).toBeLessThan(60); // Page size + headers
      });

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'xlarge_table_render',
        LARGE_TABLE_TARGET_MS,
        'Extra large table (5000 rows) with pagination'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(LARGE_TABLE_TARGET_MS);
    });
  });

  describe('Table Interaction Performance', () => {
    test('should handle table sorting efficiently', async () => {
      const user = userEvent.setup();
      const onSort = jest.fn();

      await act(async () => {
        render(
          <TestWrapper>
            <SubmissionsTable 
              data={tableDatasets.medium}
              loading={false}
              onRowClick={jest.fn()}
              onSort={onSort}
            />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.getAllByRole('row').length).toBeGreaterThan(50);
      });

      FrontendPerformanceTestUtils.startMeasurement('table_sorting');

      // Click on a sortable column header
      const patientNameHeader = screen.getByText(/patient name/i) || 
                               screen.getByRole('columnheader', { name: /patient/i });
      await user.click(patientNameHeader);

      await waitFor(() => {
        expect(onSort).toHaveBeenCalled();
      });

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'table_sorting',
        TABLE_SORT_TARGET_MS,
        'Table column sorting interaction'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(TABLE_SORT_TARGET_MS);
    });

    test('should handle row selection efficiently', async () => {
      const user = userEvent.setup();
      const onRowClick = jest.fn();

      await act(async () => {
        render(
          <TestWrapper>
            <SubmissionsTable 
              data={tableDatasets.medium}
              loading={false}
              onRowClick={onRowClick}
              onSort={jest.fn()}
              selectable={true}
            />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.getAllByRole('row').length).toBeGreaterThan(50);
      });

      FrontendPerformanceTestUtils.startMeasurement('row_selection');

      // Click on the first data row
      const firstDataRow = screen.getAllByRole('row')[1]; // Skip header row
      await user.click(firstDataRow);

      await waitFor(() => {
        expect(onRowClick).toHaveBeenCalled();
      });

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'row_selection',
        ROW_SELECTION_TARGET_MS,
        'Table row selection interaction'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(ROW_SELECTION_TARGET_MS);
    });

    test('should handle multiple row selections efficiently', async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(
          <TestWrapper>
            <SubmissionsTable 
              data={tableDatasets.medium}
              loading={false}
              onRowClick={jest.fn()}
              onSort={jest.fn()}
              selectable={true}
              multiSelect={true}
            />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.getAllByRole('row').length).toBeGreaterThan(50);
      });

      FrontendPerformanceTestUtils.startMeasurement('multi_row_selection');

      // Select multiple rows
      const dataRows = screen.getAllByRole('row').slice(1, 11); // First 10 data rows
      
      for (const row of dataRows) {
        await user.click(row, { ctrlKey: true }); // Ctrl+click for multi-select
      }

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'multi_row_selection',
        ROW_SELECTION_TARGET_MS * 10, // Allow more time for 10 selections
        'Multiple row selection (10 rows)'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(ROW_SELECTION_TARGET_MS * 10);
    });
  });

  describe('Table Scrolling Performance', () => {
    test('should handle vertical scrolling smoothly in large table', async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(
          <TestWrapper>
            <div style={{ height: '400px', overflow: 'auto' }}>
              <SubmissionsTable 
                data={tableDatasets.large}
                loading={false}
                onRowClick={jest.fn()}
                onSort={jest.fn()}
                virtualized={true}
              />
            </div>
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.getAllByRole('row').length).toBeGreaterThan(10);
      });

      const tableContainer = screen.getByRole('table').closest('div');
      
      FrontendPerformanceTestUtils.startMeasurement('table_scrolling');

      // Simulate scrolling
      await act(async () => {
        if (tableContainer) {
          tableContainer.scrollTop = 1000;
          tableContainer.dispatchEvent(new Event('scroll'));
        }
      });

      await waitFor(() => {
        // Should update visible rows after scroll
        expect(screen.getAllByRole('row').length).toBeGreaterThan(10);
      });

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'table_scrolling',
        TABLE_SCROLL_TARGET_MS,
        'Large table vertical scrolling'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(TABLE_SCROLL_TARGET_MS);
    });

    test('should handle horizontal scrolling efficiently', async () => {
      await act(async () => {
        render(
          <TestWrapper>
            <div style={{ width: '800px', overflow: 'auto' }}>
              <SubmissionsTable 
                data={tableDatasets.medium}
                loading={false}
                onRowClick={jest.fn()}
                onSort={jest.fn()}
                showAllColumns={true} // Show all columns to trigger horizontal scroll
              />
            </div>
          </TestWrapper>
        );
      });

      const tableContainer = screen.getByRole('table').closest('div');
      
      FrontendPerformanceTestUtils.startMeasurement('horizontal_scrolling');

      await act(async () => {
        if (tableContainer) {
          tableContainer.scrollLeft = 300;
          tableContainer.dispatchEvent(new Event('scroll'));
        }
      });

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'horizontal_scrolling',
        TABLE_SCROLL_TARGET_MS,
        'Table horizontal scrolling'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(TABLE_SCROLL_TARGET_MS);
    });
  });

  describe('Table Pagination Performance', () => {
    test('should handle pagination efficiently', async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(
          <TestWrapper>
            <SubmissionsTable 
              data={[]} // Empty initial data to test async loading
              loading={false}
              onRowClick={jest.fn()}
              onSort={jest.fn()}
              pagination={true}
              totalRows={1000}
              currentPage={1}
              onPageChange={jest.fn()}
            />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.getByText(/page/i)).toBeInTheDocument();
      });

      FrontendPerformanceTestUtils.startMeasurement('table_pagination');

      // Click to next page
      const nextButton = screen.getByRole('button', { name: /next/i }) || 
                        screen.getByText('2');
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
      });

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'table_pagination',
        TABLE_SORT_TARGET_MS,
        'Table pagination navigation'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(TABLE_SORT_TARGET_MS);
    });
  });

  describe('Table Filtering Performance', () => {
    test('should handle client-side filtering efficiently', async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(
          <TestWrapper>
            <SubmissionsTable 
              data={tableDatasets.medium}
              loading={false}
              onRowClick={jest.fn()}
              onSort={jest.fn()}
              filterable={true}
            />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.getAllByRole('row').length).toBeGreaterThan(50);
      });

      FrontendPerformanceTestUtils.startMeasurement('client_side_filtering');

      // Apply a filter
      const filterInput = screen.getByPlaceholderText(/filter/i) || 
                         screen.getByRole('textbox', { name: /filter/i });
      await user.type(filterInput, 'consultation');

      await waitFor(() => {
        // Should show filtered results
        expect(screen.getByText(/consultation/i)).toBeInTheDocument();
      });

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'client_side_filtering',
        TABLE_SORT_TARGET_MS,
        'Client-side table filtering'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(TABLE_SORT_TARGET_MS);
    });
  });

  describe('Memory Performance During Table Operations', () => {
    test('should not leak memory during table updates', async () => {
      const memoryMonitor = FrontendPerformanceTestUtils.monitorComponentMemory('table_memory');
      memoryMonitor.start();

      let currentData = tableDatasets.small;

      const TestComponent = () => {
        const [data, setData] = React.useState(currentData);
        
        React.useEffect(() => {
          const interval = setInterval(() => {
            // Simulate data updates
            setData(prevData => [...prevData].sort(() => Math.random() - 0.5));
          }, 500);

          return () => clearInterval(interval);
        }, []);

        return (
          <SubmissionsTable 
            data={data}
            loading={false}
            onRowClick={jest.fn()}
            onSort={jest.fn()}
          />
        );
      };

      await act(async () => {
        render(
          <TestWrapper>
            <TestComponent />
          </TestWrapper>
        );
      });

      // Let the component update several times
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 3000));
      });

      const memoryResult = memoryMonitor.end();

      // Memory should remain stable during table updates
      expect(FrontendPerformanceTestUtils.assertNoMemoryLeak(
        0, 
        memoryResult.memoryDelta, 
        30 * 1024 * 1024 // 30MB threshold for table operations
      )).toBe(true);

      console.log(`Memory usage during table updates: ${(memoryResult.memoryDelta / 1024 / 1024).toFixed(2)}MB delta`);
    });
  });

  describe('Table Resize Performance', () => {
    test('should handle column resizing efficiently', async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(
          <TestWrapper>
            <SubmissionsTable 
              data={tableDatasets.medium}
              loading={false}
              onRowClick={jest.fn()}
              onSort={jest.fn()}
              resizable={true}
            />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.getAllByRole('row').length).toBeGreaterThan(50);
      });

      FrontendPerformanceTestUtils.startMeasurement('column_resize');

      // Find a column resize handle (typically at column borders)
      const columnHeader = screen.getAllByRole('columnheader')[0];
      
      await act(async () => {
        // Simulate resize drag (this would normally be done with mouse events)
        const resizeEvent = new MouseEvent('mousedown', { clientX: 200 });
        columnHeader.dispatchEvent(resizeEvent);
        
        const moveEvent = new MouseEvent('mousemove', { clientX: 250 });
        document.dispatchEvent(moveEvent);
        
        const upEvent = new MouseEvent('mouseup', { clientX: 250 });
        document.dispatchEvent(upEvent);
      });

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'column_resize',
        TABLE_SORT_TARGET_MS,
        'Table column resize interaction'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(TABLE_SORT_TARGET_MS);
    });
  });

  describe('Table Export Performance', () => {
    test('should handle table data export efficiently', async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(
          <TestWrapper>
            <SubmissionsTable 
              data={tableDatasets.medium}
              loading={false}
              onRowClick={jest.fn()}
              onSort={jest.fn()}
              exportable={true}
            />
          </TestWrapper>
        );
      });

      FrontendPerformanceTestUtils.startMeasurement('table_export');

      // Click export button
      const exportButton = screen.getByRole('button', { name: /export/i });
      await user.click(exportButton);

      await waitFor(() => {
        // Export should complete (might show success message or download)
        expect(screen.queryByText(/exporting/i)).not.toBeInTheDocument();
      });

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'table_export',
        LARGE_TABLE_TARGET_MS,
        'Table data export (200 rows)'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(LARGE_TABLE_TARGET_MS);
    });
  });
});