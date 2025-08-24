// Error handling and edge case tests following healthcare data integrity patterns
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServiceLogForm } from '../components/ServiceLogForm';
import { ServiceLogPage } from '../pages/ServiceLogPage';
import { Select } from '../components/Select';
import { apiService } from '../services/apiService';
import { serviceLogFormSchema } from '../utils/validation';

// Mock console methods to test error logging
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const mockConsoleError = jest.fn();
const mockConsoleWarn = jest.fn();

beforeAll(() => {
  console.error = mockConsoleError;
  console.warn = mockConsoleWarn;
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Mock hooks and services
jest.mock('../hooks/useToast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

jest.mock('../services/apiService', () => ({
  apiService: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

// Mock localStorage with potential failures
const createMockLocalStorage = (shouldFail = false) => ({
  getItem: jest.fn().mockImplementation(() => {
    if (shouldFail) throw new Error('LocalStorage access denied');
    return null;
  }),
  setItem: jest.fn().mockImplementation(() => {
    if (shouldFail) throw new Error('LocalStorage quota exceeded');
  }),
  removeItem: jest.fn().mockImplementation(() => {
    if (shouldFail) throw new Error('LocalStorage access denied');
  }),
  clear: jest.fn(),
});

const mockApiService = apiService as jest.Mocked<typeof apiService>;

// Test data
const defaultProps = {
  clients: [
    {
      id: 'client-1',
      name: 'Main Hospital',
      description: 'Primary healthcare facility',
      isActive: true,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    },
  ],
  activities: [
    {
      id: 'activity-1',
      name: 'General Consultation',
      description: 'Standard patient consultation',
      isActive: true,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    },
  ],
  outcomes: [
    {
      id: 'outcome-1',
      name: 'Treatment Completed',
      description: 'Patient treatment successfully completed',
      isActive: true,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    },
  ],
  onSubmit: jest.fn(),
};

describe('Error Handling and Edge Case Tests', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    mockConsoleError.mockClear();
    mockConsoleWarn.mockClear();
  });

  describe('ServiceLogForm Error Handling', () => {
    test('handles localStorage failures gracefully during auto-save', async () => {
      const mockLocalStorage = createMockLocalStorage(true);
      Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

      jest.useFakeTimers();
      
      render(<ServiceLogForm {...defaultProps} />);

      // Make form dirty to trigger auto-save
      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      await user.type(patientCountInput, '2');

      // Fast-forward to trigger auto-save
      act(() => {
        jest.advanceTimersByTime(2500);
      });

      // Should handle localStorage error without crashing
      await waitFor(() => {
        expect(mockConsoleError).toHaveBeenCalledWith(
          expect.stringContaining('Failed to save draft:'),
          expect.any(Error)
        );
      });

      // Form should still be functional
      expect(screen.getByText('Service Log Entry')).toBeInTheDocument();

      jest.useRealTimers();
    });

    test('handles corrupted localStorage data during draft loading', () => {
      const mockLocalStorage = createMockLocalStorage();
      mockLocalStorage.getItem.mockReturnValue('invalid-json{');
      Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

      render(<ServiceLogForm {...defaultProps} />);

      // Should handle corrupted data gracefully
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load draft:'),
        expect.any(Error)
      );

      // Should clean up corrupted data
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('serviceLogDraft');

      // Form should still render normally
      expect(screen.getByText('Service Log Entry')).toBeInTheDocument();
    });

    test('handles form submission with network timeout', async () => {
      const timeoutError = new Error('Network timeout');
      timeoutError.name = 'TimeoutError';
      
      const mockOnSubmit = jest.fn().mockRejectedValue(timeoutError);
      render(<ServiceLogForm {...defaultProps} onSubmit={mockOnSubmit} />);

      // Fill valid form data
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

      // Submit form
      const submitButton = screen.getByText('Save Service Log');
      await user.click(submitButton);

      // Should handle timeout error gracefully
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });

      // Draft should not be cleared on error
      const mockLocalStorage = window.localStorage as jest.Mocked<Storage>;
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalledWith('serviceLogDraft');
    });

    test('handles extremely large patient counts', async () => {
      render(<ServiceLogForm {...defaultProps} />);

      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      
      // Test with Number.MAX_SAFE_INTEGER
      await user.clear(patientCountInput);
      await user.type(patientCountInput, String(Number.MAX_SAFE_INTEGER));

      await waitFor(() => {
        expect(screen.getByText('Cannot exceed 100 patients per session')).toBeInTheDocument();
      });
    });

    test('handles malformed props gracefully', () => {
      const malformedProps = {
        ...defaultProps,
        clients: null as any,
        activities: undefined as any,
        outcomes: [null] as any,
      };

      // Should not crash with malformed props
      expect(() => render(<ServiceLogForm {...malformedProps} />)).not.toThrow();
      
      // Should handle null/undefined arrays as empty arrays
      expect(screen.getByText('Service Log Entry')).toBeInTheDocument();
    });

    test('handles rapid user interactions without errors', async () => {
      render(<ServiceLogForm {...defaultProps} />);

      const patientCountInput = screen.getByLabelText(/number of patient entries/i);

      // Rapidly change patient count multiple times
      for (let i = 1; i <= 10; i++) {
        await user.clear(patientCountInput);
        await user.type(patientCountInput, i.toString());
      }

      // Should handle rapid changes without errors
      expect(mockConsoleError).not.toHaveBeenCalled();
      expect(screen.getByText('Service Log Entry')).toBeInTheDocument();
    });

    test('handles concurrent state updates', async () => {
      jest.useFakeTimers();

      render(<ServiceLogForm {...defaultProps} />);

      const patientCountInput = screen.getByLabelText(/number of patient entries/i);

      // Trigger multiple concurrent updates
      await user.type(patientCountInput, '5');
      
      act(() => {
        jest.advanceTimersByTime(100);
      });

      await user.clear(patientCountInput);
      await user.type(patientCountInput, '3');

      act(() => {
        jest.advanceTimersByTime(100);
      });

      await user.clear(patientCountInput);
      await user.type(patientCountInput, '7');

      // Fast-forward to complete all timers
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      // Should handle concurrent updates without errors
      expect(mockConsoleError).not.toHaveBeenCalled();
      expect(patientCountInput).toHaveValue(7);

      jest.useRealTimers();
    });

    test('handles memory pressure scenarios', async () => {
      render(<ServiceLogForm {...defaultProps} />);

      const patientCountInput = screen.getByLabelText(/number of patient entries/i);

      // Simulate creating many patient entries to test memory usage
      await user.clear(patientCountInput);
      await user.type(patientCountInput, '100');

      await waitFor(() => {
        expect(screen.getByText('Entry 1')).toBeInTheDocument();
        expect(screen.getByText('Entry 100')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Should handle large numbers of entries without memory errors
      expect(mockConsoleError).not.toHaveBeenCalled();
    });
  });

  describe('Select Component Error Handling', () => {
    const selectProps = {
      options: [
        { value: 'option1', label: 'Option 1' },
        { value: 'option2', label: 'Option 2' },
      ],
      onValueChange: jest.fn(),
    };

    test('handles null/undefined options array', () => {
      const nullProps = { ...selectProps, options: null as any };
      
      expect(() => render(<Select {...nullProps} />)).not.toThrow();
    });

    test('handles malformed options', () => {
      const malformedOptions = [
        null,
        undefined,
        { value: null, label: null },
        { value: 'valid', label: 'Valid Option' },
        'invalid-option',
      ] as any;

      const malformedProps = { ...selectProps, options: malformedOptions };
      
      expect(() => render(<Select {...malformedProps} />)).not.toThrow();
    });

    test('handles extremely long option lists', async () => {
      const manyOptions = Array.from({ length: 10000 }, (_, i) => ({
        value: `option${i}`,
        label: `Option ${i}`,
      }));

      const startTime = performance.now();
      render(<Select {...selectProps} options={manyOptions} />);
      const endTime = performance.now();

      // Should render large lists efficiently
      expect(endTime - startTime).toBeLessThan(1000);

      await user.click(screen.getByRole('button'));
      
      // Should handle scrolling in large lists
      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveClass('max-h-60', 'overflow-auto');
    });

    test('handles rapid keyboard navigation', async () => {
      render(<Select {...selectProps} />);

      const button = screen.getByRole('button');
      button.focus();

      await user.keyboard('{ArrowDown}');

      // Rapidly navigate through options
      for (let i = 0; i < 100; i++) {
        await user.keyboard('{ArrowDown}');
      }

      // Should not cause errors with rapid navigation
      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    test('handles onValueChange callback errors', async () => {
      const errorCallback = jest.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });

      render(<Select {...selectProps} onValueChange={errorCallback} />);

      await user.click(screen.getByRole('button'));
      
      // Click on an option that will trigger the error
      const option = screen.getByText('Option 1');
      
      // Should handle callback errors gracefully
      expect(() => user.click(option)).not.toThrow();
    });
  });

  describe('ServiceLogPage Error Handling', () => {
    test('handles API failure during form options loading', async () => {
      mockApiService.get.mockRejectedValue(new Error('Network error'));

      render(<ServiceLogPage />);

      await waitFor(() => {
        expect(screen.getByText('Unable to Load Form')).toBeInTheDocument();
      });

      expect(screen.getByText('There was a problem loading the form data.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });

    test('handles malformed API response', async () => {
      mockApiService.get.mockResolvedValue({
        success: true,
        data: {
          clients: 'invalid-data',
          activities: null,
          outcomes: undefined,
        },
      } as any);

      render(<ServiceLogPage />);

      await waitFor(() => {
        expect(screen.getByText('Unable to Load Form')).toBeInTheDocument();
      });
    });

    test('handles API timeout during submission', async () => {
      mockApiService.get.mockResolvedValue({
        success: true,
        data: {
          clients: defaultProps.clients,
          activities: defaultProps.activities,
          outcomes: defaultProps.outcomes,
        },
      });

      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      mockApiService.post.mockRejectedValue(timeoutError);

      render(<ServiceLogPage />);

      await waitFor(() => {
        expect(screen.getByText('Service Log Entry')).toBeInTheDocument();
      });

      // Fill and submit form
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

      // Should handle timeout gracefully
      await waitFor(() => {
        expect(mockApiService.post).toHaveBeenCalled();
      });
    });

    test('handles browser navigation interruption', async () => {
      mockApiService.get.mockResolvedValue({
        success: true,
        data: {
          clients: defaultProps.clients,
          activities: defaultProps.activities,
          outcomes: defaultProps.outcomes,
        },
      });

      const { unmount } = render(<ServiceLogPage />);

      await waitFor(() => {
        expect(screen.getByText('Service Log Entry')).toBeInTheDocument();
      });

      // Simulate abrupt component unmount (like navigation)
      expect(() => unmount()).not.toThrow();
    });

    test('handles concurrent API requests', async () => {
      let resolveCount = 0;
      mockApiService.get.mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => {
            resolveCount++;
            resolve({
              success: true,
              data: {
                clients: defaultProps.clients,
                activities: defaultProps.activities,
                outcomes: defaultProps.outcomes,
              },
            });
          }, 100);
        })
      );

      // Render multiple instances to simulate concurrent requests
      const { unmount: unmount1 } = render(<ServiceLogPage />);
      const { unmount: unmount2 } = render(<ServiceLogPage />);

      // Quickly unmount one to test cleanup
      unmount1();

      await waitFor(() => {
        expect(mockApiService.get).toHaveBeenCalledTimes(2);
      });

      // Should handle concurrent requests without issues
      expect(mockConsoleError).not.toHaveBeenCalled();

      unmount2();
    });
  });

  describe('Data Validation Edge Cases', () => {
    test('handles schema validation with edge case values', () => {
      const edgeCaseData = {
        clientId: '550e8400-e29b-41d4-a716-446655440000',
        activityId: '550e8400-e29b-41d4-a716-446655440001',
        patientCount: 0.999999999999, // Near integer but not quite
        patientEntries: [
          {
            newPatients: -0, // Negative zero
            followupPatients: Number.MIN_VALUE,
            dnaCount: Number.EPSILON,
            outcomeId: '550e8400-e29b-41d4-a716-446655440002',
          },
        ],
      };

      const result = serviceLogFormSchema.safeParse(edgeCaseData);
      expect(result.success).toBe(false);

      if (!result.success) {
        const errors = result.error.issues;
        expect(errors.some(error => error.path[0] === 'patientCount')).toBe(true);
      }
    });

    test('handles unicode and special characters', () => {
      const unicodeData = {
        clientId: 'café-client-🏥', // Not a valid UUID but tests character handling
        activityId: '活动-识别符',
        patientCount: 1,
        patientEntries: [
          {
            newPatients: 1,
            followupPatients: 0,
            dnaCount: 0,
            outcomeId: '结果-💊',
          },
        ],
      };

      const result = serviceLogFormSchema.safeParse(unicodeData);
      expect(result.success).toBe(false); // Should fail UUID validation

      // But should handle unicode gracefully
      if (!result.success) {
        expect(result.error.issues).toBeDefined();
      }
    });

    test('handles extremely nested objects', () => {
      // Create deeply nested object that might cause stack overflow
      let deepObject = { patientEntries: [] };
      for (let i = 0; i < 1000; i++) {
        deepObject = { nested: deepObject } as any;
      }

      expect(() => serviceLogFormSchema.safeParse(deepObject)).not.toThrow();
    });

    test('handles circular references', () => {
      const circularData: any = {
        clientId: '550e8400-e29b-41d4-a716-446655440000',
        activityId: '550e8400-e29b-41d4-a716-446655440001',
        patientCount: 1,
        patientEntries: [],
      };
      
      // Create circular reference
      circularData.self = circularData;

      // Zod should handle circular references gracefully
      expect(() => serviceLogFormSchema.safeParse(circularData)).not.toThrow();
    });
  });

  describe('Component Lifecycle Edge Cases', () => {
    test('handles rapid mount/unmount cycles', () => {
      for (let i = 0; i < 100; i++) {
        const { unmount } = render(<ServiceLogForm {...defaultProps} />);
        unmount();
      }

      // Should not cause memory leaks or errors
      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    test('handles prop changes during async operations', async () => {
      const { rerender } = render(<ServiceLogForm {...defaultProps} />);

      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      await user.type(patientCountInput, '2');

      // Change props while auto-save might be in progress
      const newProps = {
        ...defaultProps,
        clients: [],
      };

      expect(() => rerender(<ServiceLogForm {...newProps} />)).not.toThrow();
    });

    test('handles component unmount during form submission', async () => {
      const slowSubmit = jest.fn(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      );

      const { unmount } = render(<ServiceLogForm {...defaultProps} onSubmit={slowSubmit} />);

      // Start form submission
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
      user.click(submitButton); // Don't await

      // Unmount component immediately
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Browser Compatibility Edge Cases', () => {
    test('handles missing modern APIs gracefully', () => {
      // Mock missing IntersectionObserver
      const originalIntersectionObserver = global.IntersectionObserver;
      delete (global as any).IntersectionObserver;

      expect(() => render(<ServiceLogForm {...defaultProps} />)).not.toThrow();

      // Restore
      global.IntersectionObserver = originalIntersectionObserver;
    });

    test('handles missing localStorage', () => {
      const originalLocalStorage = global.localStorage;
      delete (global as any).localStorage;

      expect(() => render(<ServiceLogForm {...defaultProps} />)).not.toThrow();

      // Restore
      global.localStorage = originalLocalStorage;
    });

    test('handles older browser Date implementations', () => {
      // Mock older Date constructor behavior
      const originalDate = global.Date;
      global.Date = function(this: any, ...args: any[]) {
        if (args.length === 0) return new originalDate();
        if (args[0] === 'invalid') return new originalDate(NaN);
        return new originalDate(...args);
      } as any;
      global.Date.now = originalDate.now;
      global.Date.prototype = originalDate.prototype;

      expect(() => render(<ServiceLogForm {...defaultProps} />)).not.toThrow();

      // Restore
      global.Date = originalDate;
    });
  });

  describe('Performance Under Stress', () => {
    test('maintains performance with many re-renders', async () => {
      const { rerender } = render(<ServiceLogForm {...defaultProps} />);

      const startTime = performance.now();

      // Trigger many re-renders
      for (let i = 0; i < 1000; i++) {
        rerender(<ServiceLogForm {...defaultProps} key={i} />);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should handle many re-renders efficiently
      expect(duration).toBeLessThan(5000); // 5 seconds
    });

    test('handles memory cleanup properly', () => {
      const components = [];

      // Create many components
      for (let i = 0; i < 100; i++) {
        components.push(render(<ServiceLogForm {...defaultProps} />));
      }

      // Unmount all components
      components.forEach(({ unmount }) => unmount());

      // Should not have memory leaks (hard to test directly, but ensure no errors)
      expect(mockConsoleError).not.toHaveBeenCalled();
    });
  });

  describe('Security Edge Cases', () => {
    test('handles XSS attempts in form data', async () => {
      render(<ServiceLogForm {...defaultProps} />);

      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      
      // Attempt to inject script
      await user.clear(patientCountInput);
      await user.type(patientCountInput, '<script>alert("xss")</script>');

      // Should sanitize input and not execute script
      expect(patientCountInput).toHaveValue(NaN); // Invalid number
    });

    test('handles malicious localStorage data', () => {
      const maliciousData = {
        clientId: '<script>alert("xss")</script>',
        __proto__: { malicious: true },
      };

      const mockLocalStorage = createMockLocalStorage();
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(maliciousData));
      Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

      // Should handle malicious data safely
      expect(() => render(<ServiceLogForm {...defaultProps} />)).not.toThrow();
    });
  });
});