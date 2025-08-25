/**
 * Form Submission Performance Tests
 * Following documented patterns from devdocs/jest.md and devdocs/react-hook-form.md
 * Tests form submission < 1 second target
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { FrontendPerformanceTestUtils, HealthcareFrontendScenarios } from '../utils/PerformanceTestUtils';
import ServiceLogForm from '../../../components/ServiceLogForm';
import { AuthProvider } from '../../../hooks/useAuth';

// Mock API responses for form submissions
const mockApiResponses = {
  patients: FrontendPerformanceTestUtils.generateLargePatientDataset(50),
  customFields: Array.from({ length: 30 }, (_, i) => ({
    id: `field-${i}`,
    name: `customField${i}`,
    label: `Custom Field ${i}`,
    type: ['text', 'select', 'checkbox', 'textarea', 'date', 'number'][i % 6],
    required: i % 4 === 0,
    options: i % 6 === 1 ? [`Option ${i}A`, `Option ${i}B`, `Option ${i}C`] : undefined,
  })),
  providers: Array.from({ length: 20 }, (_, i) => ({
    id: `provider-${i}`,
    name: `Dr. Provider ${i}`,
    speciality: ['Cardiology', 'Dermatology', 'Pediatrics', 'Orthopedics'][i % 4],
  })),
};

beforeEach(() => {
  global.fetch = jest.fn().mockImplementation((url: string, options?: any) => {
    const delay = 80 + Math.random() * 40; // 80-120ms API response time
    
    return new Promise((resolve) => {
      setTimeout(() => {
        if (options?.method === 'POST' && url.includes('/api/service-logs')) {
          resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: {
                id: 'new-service-log-123',
                ...JSON.parse(options.body),
                createdAt: new Date().toISOString(),
              },
            }),
          });
        } else if (url.includes('/api/patients')) {
          resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: {
                patients: mockApiResponses.patients.slice(0, 10),
                total: mockApiResponses.patients.length,
              },
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
        } else if (url.includes('/api/providers')) {
          resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: mockApiResponses.providers,
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

describe('Form Submission Performance Tests', () => {
  const FORM_SUBMISSION_TARGET_MS = 1000;
  const FORM_VALIDATION_TARGET_MS = 100;
  const FORM_INTERACTION_TARGET_MS = 200;
  const COMPLEX_FORM_TARGET_MS = 1500;

  const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <AuthProvider>
        {children}
      </AuthProvider>
    </BrowserRouter>
  );

  describe('Basic Form Submission Performance', () => {
    test('should submit simple service log form within 1 second', async () => {
      const user = userEvent.setup();
      
      await act(async () => {
        render(
          <TestWrapper>
            <ServiceLogForm onSubmit={jest.fn()} />
          </TestWrapper>
        );
      });

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByRole('form')).toBeInTheDocument();
      });

      FrontendPerformanceTestUtils.startMeasurement('simple_form_submission');

      // Fill out basic form fields
      const patientSelect = screen.getByLabelText(/patient/i);
      await user.click(patientSelect);
      await user.type(patientSelect, 'John Doe');
      
      const serviceTypeSelect = screen.getByLabelText(/service type/i);
      await user.selectOptions(serviceTypeSelect, 'consultation');

      const providerInput = screen.getByLabelText(/provider/i);
      await user.type(providerInput, 'Dr. Smith');

      const scheduledDateInput = screen.getByLabelText(/scheduled date/i);
      await user.type(scheduledDateInput, '2024-01-15');

      const durationInput = screen.getByLabelText(/duration/i);
      await user.type(durationInput, '30');

      const notesInput = screen.getByLabelText(/notes/i);
      await user.type(notesInput, 'Test service log submission');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /submit|create/i });
      await user.click(submitButton);

      // Wait for submission to complete
      await waitFor(() => {
        expect(screen.queryByText(/submitting/i)).not.toBeInTheDocument();
      }, { timeout: 2000 });

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'simple_form_submission',
        FORM_SUBMISSION_TARGET_MS,
        'Simple service log form submission'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(FORM_SUBMISSION_TARGET_MS);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/service-logs'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    test('should handle form validation efficiently', async () => {
      const user = userEvent.setup();
      
      await act(async () => {
        render(
          <TestWrapper>
            <ServiceLogForm onSubmit={jest.fn()} />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.getByRole('form')).toBeInTheDocument();
      });

      FrontendPerformanceTestUtils.startMeasurement('form_validation_performance');

      // Try to submit empty form to trigger validation
      const submitButton = screen.getByRole('button', { name: /submit|create/i });
      await user.click(submitButton);

      // Wait for validation messages to appear
      await waitFor(() => {
        expect(screen.queryByText(/required/i)).toBeInTheDocument();
      });

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'form_validation_performance',
        FORM_VALIDATION_TARGET_MS,
        'Form validation error display'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(FORM_VALIDATION_TARGET_MS);
    });
  });

  describe('Complex Form Submission Performance', () => {
    test('should submit form with many custom fields within target time', async () => {
      // Mock form with 50 custom fields
      const complexCustomFields = Array.from({ length: 50 }, (_, i) => ({
        id: `field-${i}`,
        name: `customField${i}`,
        label: `Custom Field ${i}`,
        type: ['text', 'select', 'checkbox', 'textarea', 'date', 'number', 'radio'][i % 7],
        required: i % 5 === 0,
        options: i % 7 === 1 || i % 7 === 6 ? 
          [`Option ${i}A`, `Option ${i}B`, `Option ${i}C`] : undefined,
        validation: {
          minLength: i % 7 === 0 ? 3 : undefined,
          maxLength: i % 7 === 0 ? 100 : undefined,
          min: i % 7 === 5 ? 0 : undefined,
          max: i % 7 === 5 ? 1000 : undefined,
        },
      }));

      global.fetch = jest.fn().mockImplementation((url: string, options?: any) => {
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
          json: () => Promise.resolve({
            success: true,
            data: options?.method === 'POST' ? { id: 'new-id' } : {},
          }),
        });
      });

      const user = userEvent.setup();
      
      await act(async () => {
        render(
          <TestWrapper>
            <ServiceLogForm onSubmit={jest.fn()} />
          </TestWrapper>
        );
      });

      // Wait for complex form to load
      await waitFor(() => {
        expect(screen.getByRole('form')).toBeInTheDocument();
      }, { timeout: 3000 });

      FrontendPerformanceTestUtils.startMeasurement('complex_form_submission');

      // Fill out basic required fields quickly
      const patientSelect = screen.getByLabelText(/patient/i);
      await user.type(patientSelect, 'Test Patient');
      
      const serviceTypeSelect = screen.getByLabelText(/service type/i);
      await user.selectOptions(serviceTypeSelect, 'consultation');

      // Fill out some custom fields (sample to simulate user behavior)
      const customFieldInputs = screen.getAllByRole('textbox').slice(3, 8); // First 5 custom text fields
      for (let i = 0; i < customFieldInputs.length; i++) {
        await user.type(customFieldInputs[i], `Value ${i}`);
      }

      // Submit the complex form
      const submitButton = screen.getByRole('button', { name: /submit|create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByText(/submitting/i)).not.toBeInTheDocument();
      }, { timeout: 3000 });

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'complex_form_submission',
        COMPLEX_FORM_TARGET_MS,
        'Complex form submission with 50+ custom fields'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(COMPLEX_FORM_TARGET_MS);
    });

    test('should handle dynamic field updates efficiently', async () => {
      const user = userEvent.setup();
      
      await act(async () => {
        render(
          <TestWrapper>
            <ServiceLogForm onSubmit={jest.fn()} />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.getByRole('form')).toBeInTheDocument();
      });

      FrontendPerformanceTestUtils.startMeasurement('dynamic_field_updates');

      // Simulate rapid field updates that might trigger dynamic behavior
      const patientSelect = screen.getByLabelText(/patient/i);
      
      // Simulate typing and deleting to trigger dynamic updates
      for (let i = 0; i < 10; i++) {
        await user.type(patientSelect, 'Test');
        await user.clear(patientSelect);
      }

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'dynamic_field_updates',
        FORM_INTERACTION_TARGET_MS,
        'Dynamic field updates and re-renders'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(FORM_INTERACTION_TARGET_MS);
    });
  });

  describe('Form Interaction Performance', () => {
    test('should handle rapid user interactions without performance degradation', async () => {
      const user = userEvent.setup({ delay: null }); // Remove delay for rapid testing
      
      await act(async () => {
        render(
          <TestWrapper>
            <ServiceLogForm onSubmit={jest.fn()} />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.getByRole('form')).toBeInTheDocument();
      });

      FrontendPerformanceTestUtils.startMeasurement('rapid_form_interactions');

      // Simulate rapid user interactions
      const interactions = [
        { element: screen.getByLabelText(/patient/i), value: 'John Doe' },
        { element: screen.getByLabelText(/service type/i), value: 'consultation', type: 'select' },
        { element: screen.getByLabelText(/provider/i), value: 'Dr. Smith' },
        { element: screen.getByLabelText(/duration/i), value: '30' },
        { element: screen.getByLabelText(/notes/i), value: 'Rapid interaction test notes' },
      ];

      for (const interaction of interactions) {
        if (interaction.type === 'select') {
          await user.selectOptions(interaction.element, interaction.value);
        } else {
          await user.clear(interaction.element);
          await user.type(interaction.element, interaction.value, { delay: 10 });
        }
      }

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'rapid_form_interactions',
        FORM_INTERACTION_TARGET_MS,
        'Rapid sequential form field interactions'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(FORM_INTERACTION_TARGET_MS);
    });

    test('should measure complete patient registration journey performance', async () => {
      const user = userEvent.setup();
      
      await act(async () => {
        render(
          <TestWrapper>
            <ServiceLogForm onSubmit={jest.fn()} />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.getByRole('form')).toBeInTheDocument();
      });

      const journeyTime = await FrontendPerformanceTestUtils.simulateUserJourney([
        { action: 'type', target: 'patient', value: 'John Doe' },
        { action: 'wait', duration: 100 },
        { action: 'type', target: 'serviceType', value: 'consultation' },
        { action: 'type', target: 'provider', value: 'Dr. Smith' },
        { action: 'type', target: 'scheduledDate', value: '2024-01-15' },
        { action: 'type', target: 'duration', value: '30' },
        { action: 'type', target: 'notes', value: 'Complete journey test with detailed notes' },
        { action: 'wait', duration: 50 },
        { action: 'click', target: 'submit' },
        { action: 'wait', duration: 500 },
      ]);

      expect(journeyTime).toBeLessThanOrEqual(COMPLEX_FORM_TARGET_MS);
      
      console.log(`Complete form journey completed in ${journeyTime.toFixed(2)}ms`);
    });
  });

  describe('Memory Performance During Form Operations', () => {
    test('should not leak memory during repeated form submissions', async () => {
      const memoryMonitor = FrontendPerformanceTestUtils.monitorComponentMemory('form_memory');
      memoryMonitor.start();

      const user = userEvent.setup();
      
      await act(async () => {
        render(
          <TestWrapper>
            <ServiceLogForm onSubmit={jest.fn()} />
          </TestWrapper>
        );
      });

      // Perform multiple form submissions
      for (let i = 0; i < 5; i++) {
        FrontendPerformanceTestUtils.startMeasurement(`form_submission_${i}`);

        const patientSelect = screen.getByLabelText(/patient/i);
        await user.clear(patientSelect);
        await user.type(patientSelect, `Patient ${i}`);

        const serviceTypeSelect = screen.getByLabelText(/service type/i);
        await user.selectOptions(serviceTypeSelect, 'consultation');

        const submitButton = screen.getByRole('button', { name: /submit|create/i });
        await user.click(submitButton);

        await waitFor(() => {
          expect(screen.queryByText(/submitting/i)).not.toBeInTheDocument();
        }, { timeout: 2000 });

        const benchmark = FrontendPerformanceTestUtils.assertPerformance(
          `form_submission_${i}`,
          FORM_SUBMISSION_TARGET_MS,
          `Form submission ${i + 1} in memory test sequence`
        );

        expect(benchmark.passed).toBe(true);

        // Small delay between submissions
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
        });
      }

      const memoryResult = memoryMonitor.end();
      
      // Memory usage should remain stable across multiple submissions
      expect(FrontendPerformanceTestUtils.assertNoMemoryLeak(
        0, 
        memoryResult.memoryDelta, 
        20 * 1024 * 1024 // 20MB threshold for 5 submissions
      )).toBe(true);

      console.log(`Memory usage after 5 submissions: ${(memoryResult.memoryDelta / 1024 / 1024).toFixed(2)}MB delta`);
    });
  });

  describe('Error Handling Performance', () => {
    test('should handle submission errors efficiently without performance impact', async () => {
      // Mock API error
      global.fetch = jest.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: () => Promise.resolve({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid form data',
              details: {
                patient: 'Patient is required',
                serviceType: 'Service type is required',
              },
            },
          }),
        });
      });

      const user = userEvent.setup();
      
      await act(async () => {
        render(
          <TestWrapper>
            <ServiceLogForm onSubmit={jest.fn()} />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.getByRole('form')).toBeInTheDocument();
      });

      FrontendPerformanceTestUtils.startMeasurement('error_handling_performance');

      const submitButton = screen.getByRole('button', { name: /submit|create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/error/i) || screen.getByText(/invalid/i)).toBeInTheDocument();
      }, { timeout: 2000 });

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'error_handling_performance',
        FORM_VALIDATION_TARGET_MS * 2, // Allow more time for error handling
        'Form error handling and display'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(FORM_VALIDATION_TARGET_MS * 2);
    });

    test('should recover from errors quickly on retry', async () => {
      // First call fails, second succeeds
      let callCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({
              success: false,
              error: { message: 'Server error' },
            }),
          });
        } else {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: { id: 'retry-success' },
            }),
          });
        }
      });

      const user = userEvent.setup();
      
      await act(async () => {
        render(
          <TestWrapper>
            <ServiceLogForm onSubmit={jest.fn()} />
          </TestWrapper>
        );
      });

      // Fill out form
      const patientSelect = screen.getByLabelText(/patient/i);
      await user.type(patientSelect, 'Retry Test Patient');
      
      const serviceTypeSelect = screen.getByLabelText(/service type/i);
      await user.selectOptions(serviceTypeSelect, 'consultation');

      // First submission (will fail)
      const submitButton = screen.getByRole('button', { name: /submit|create/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });

      FrontendPerformanceTestUtils.startMeasurement('error_recovery_performance');

      // Retry submission
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
      }, { timeout: 2000 });

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'error_recovery_performance',
        FORM_SUBMISSION_TARGET_MS,
        'Form error recovery and successful retry'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(FORM_SUBMISSION_TARGET_MS);
    });
  });

  describe('Auto-save Performance', () => {
    test('should auto-save form data efficiently without user interruption', async () => {
      const user = userEvent.setup();
      
      await act(async () => {
        render(
          <TestWrapper>
            <ServiceLogForm onSubmit={jest.fn()} enableAutoSave={true} />
          </TestWrapper>
        );
      });

      await waitFor(() => {
        expect(screen.getByRole('form')).toBeInTheDocument();
      });

      FrontendPerformanceTestUtils.startMeasurement('auto_save_performance');

      // Type in a field that should trigger auto-save
      const notesInput = screen.getByLabelText(/notes/i);
      await user.type(notesInput, 'This should trigger auto-save functionality after a delay');

      // Wait for auto-save to potentially trigger
      await waitFor(() => {
        // Auto-save would typically show an indicator
        expect(screen.queryByText(/saving/i)).not.toBeInTheDocument();
      }, { timeout: 3000 });

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'auto_save_performance',
        FORM_INTERACTION_TARGET_MS * 2, // Allow more time for auto-save
        'Auto-save form field updates'
      );

      expect(benchmark.passed).toBe(true);
      expect(benchmark.actual).toBeLessThanOrEqual(FORM_INTERACTION_TARGET_MS * 2);
    });
  });
});