/**
 * Frontend Performance Test Utilities
 * Following documented patterns from devdocs/jest.md and devdocs/react-testing-library.md
 * Healthcare-specific frontend performance testing utilities
 */

import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

export interface FrontendPerformanceMetrics {
  startTime: number;
  endTime: number;
  duration: number; // in milliseconds
  memoryUsage?: MemoryInfo;
  renderCount?: number;
  reRenderCount?: number;
}

export interface PageLoadMetrics {
  domContentLoaded: number;
  firstPaint: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  interactionToNextPaint: number;
}

export interface ComponentPerformanceMetrics {
  mountTime: number;
  updateTime: number;
  unmountTime: number;
  totalRenders: number;
  wastedRenders: number;
}

export class FrontendPerformanceTestUtils {
  private static measurements: Map<string, FrontendPerformanceMetrics> = new Map();
  private static renderCounts: Map<string, number> = new Map();

  /**
   * Start performance measurement for frontend operations
   */
  static startMeasurement(testName: string): void {
    const memoryInfo = (performance as any).memory || {
      usedJSHeapSize: 0,
      totalJSHeapSize: 0,
      jsHeapSizeLimit: 0,
    };

    this.measurements.set(testName, {
      startTime: performance.now(),
      endTime: 0,
      duration: 0,
      memoryUsage: memoryInfo,
      renderCount: 0,
      reRenderCount: 0,
    });
  }

  /**
   * End performance measurement and calculate metrics
   */
  static endMeasurement(testName: string): FrontendPerformanceMetrics {
    const measurement = this.measurements.get(testName);
    if (!measurement) {
      throw new Error(`No measurement started for test: ${testName}`);
    }

    measurement.endTime = performance.now();
    measurement.duration = measurement.endTime - measurement.startTime;

    return measurement;
  }

  /**
   * Assert frontend performance benchmark
   */
  static assertPerformance(
    testName: string,
    targetMs: number,
    description?: string
  ): { passed: boolean; actual: number; target: number } {
    const metrics = this.endMeasurement(testName);
    const passed = metrics.duration <= targetMs;

    if (!passed) {
      console.warn(`Frontend performance benchmark failed for ${testName}:`, {
        target: targetMs,
        actual: metrics.duration,
        difference: metrics.duration - targetMs,
        description,
      });
    }

    return {
      passed,
      actual: metrics.duration,
      target: targetMs,
    };
  }

  /**
   * Measure page load performance metrics
   */
  static getPageLoadMetrics(): Promise<PageLoadMetrics> {
    return new Promise((resolve) => {
      // Use Performance Observer API to get detailed metrics
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const metrics: Partial<PageLoadMetrics> = {};

        entries.forEach((entry) => {
          switch (entry.entryType) {
            case 'navigation':
              const navEntry = entry as PerformanceNavigationTiming;
              metrics.domContentLoaded = navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart;
              break;
            case 'paint':
              if (entry.name === 'first-paint') {
                metrics.firstPaint = entry.startTime;
              } else if (entry.name === 'first-contentful-paint') {
                metrics.firstContentfulPaint = entry.startTime;
              }
              break;
            case 'largest-contentful-paint':
              metrics.largestContentfulPaint = entry.startTime;
              break;
            case 'layout-shift':
              if (!metrics.cumulativeLayoutShift) {
                metrics.cumulativeLayoutShift = 0;
              }
              metrics.cumulativeLayoutShift += (entry as any).value;
              break;
          }
        });

        resolve({
          domContentLoaded: metrics.domContentLoaded || 0,
          firstPaint: metrics.firstPaint || 0,
          firstContentfulPaint: metrics.firstContentfulPaint || 0,
          largestContentfulPaint: metrics.largestContentfulPaint || 0,
          cumulativeLayoutShift: metrics.cumulativeLayoutShift || 0,
          interactionToNextPaint: 0, // Would need more complex measurement
        });
      });

      observer.observe({ entryTypes: ['navigation', 'paint', 'largest-contentful-paint', 'layout-shift'] });

      // Fallback timeout
      setTimeout(() => {
        observer.disconnect();
        resolve({
          domContentLoaded: 0,
          firstPaint: 0,
          firstContentfulPaint: 0,
          largestContentfulPaint: 0,
          cumulativeLayoutShift: 0,
          interactionToNextPaint: 0,
        });
      }, 5000);
    });
  }

  /**
   * Simulate slow network conditions for performance testing
   */
  static simulateSlowNetwork(): void {
    // Mock fetch with delays for testing slow network conditions
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockImplementation(async (url, options) => {
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200)); // 100-300ms delay
      return originalFetch(url, options);
    });
  }

  /**
   * Restore normal network conditions
   */
  static restoreNetworkConditions(): void {
    if (jest.isMockFunction(global.fetch)) {
      (global.fetch as jest.Mock).mockRestore();
    }
  }

  /**
   * Generate large healthcare dataset for frontend performance testing
   */
  static generateLargePatientDataset(count: number): any[] {
    return Array.from({ length: count }, (_, index) => ({
      id: `patient-${index.toString().padStart(4, '0')}`,
      firstName: `FirstName${index}`,
      lastName: `LastName${index}`,
      dateOfBirth: `19${70 + (index % 50)}-${String((index % 12) + 1).padStart(2, '0')}-${String((index % 28) + 1).padStart(2, '0')}`,
      phone: `555${index.toString().padStart(7, '0')}`,
      email: `patient${index}@example.com`,
      emergencyContact: {
        name: `Emergency${index}`,
        phone: `666${index.toString().padStart(7, '0')}`,
        relationship: ['spouse', 'parent', 'child', 'sibling'][index % 4],
      },
      status: ['active', 'inactive', 'pending'][index % 3],
      lastVisit: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      servicesCount: Math.floor(Math.random() * 20),
      createdAt: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString(),
    }));
  }

  /**
   * Generate large service log dataset
   */
  static generateLargeServiceLogDataset(count: number, patientIds?: string[]): any[] {
    const defaultPatientIds = patientIds || Array.from({ length: 100 }, (_, i) => `patient-${i.toString().padStart(4, '0')}`);

    return Array.from({ length: count }, (_, index) => ({
      id: `service-${index.toString().padStart(6, '0')}`,
      patientId: defaultPatientIds[index % defaultPatientIds.length],
      patientName: `Patient ${index % defaultPatientIds.length}`,
      serviceType: ['consultation', 'procedure', 'therapy', 'diagnostic', 'follow-up'][index % 5],
      provider: `Dr. Provider${index % 20}`,
      scheduledDate: new Date(Date.now() + (index * 3600000)).toISOString(),
      duration: [15, 30, 45, 60, 90, 120][index % 6],
      status: ['scheduled', 'in-progress', 'completed', 'cancelled'][index % 4],
      priority: ['routine', 'urgent', 'emergency'][index % 3],
      notes: `Service log notes for entry ${index}. This includes detailed information about the patient's condition and treatment plan.`,
      customFields: {
        symptoms: `Symptom description ${index}`,
        vitals: {
          bloodPressure: `${120 + (index % 40)}/${80 + (index % 20)}`,
          heartRate: 60 + (index % 60),
          temperature: 98.6 + ((index % 10) - 5) * 0.1,
        },
        medications: ['Medication A', 'Medication B', 'Medication C'].slice(0, (index % 3) + 1),
        allergies: index % 5 === 0 ? ['Penicillin', 'Latex'] : [],
      },
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    }));
  }

  /**
   * Measure form interaction performance
   */
  static async measureFormInteraction(
    formSelector: string,
    interactions: Array<{ field: string; value: string; type?: 'type' | 'select' | 'click' }>
  ): Promise<number> {
    const startTime = performance.now();
    const user = userEvent.setup();

    for (const interaction of interactions) {
      const element = screen.getByLabelText(new RegExp(interaction.field, 'i')) || 
                     screen.getByRole('textbox', { name: new RegExp(interaction.field, 'i') }) ||
                     screen.getByDisplayValue(interaction.value);

      if (interaction.type === 'select') {
        await user.selectOptions(element, interaction.value);
      } else if (interaction.type === 'click') {
        await user.click(element);
      } else {
        await user.clear(element);
        await user.type(element, interaction.value);
      }

      // Wait for any async updates
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });
    }

    return performance.now() - startTime;
  }

  /**
   * Measure table rendering performance
   */
  static async measureTableRender(
    tableData: any[],
    renderFunction: (data: any[]) => void
  ): Promise<ComponentPerformanceMetrics> {
    const startTime = performance.now();
    
    await act(async () => {
      renderFunction(tableData);
    });

    const mountTime = performance.now() - startTime;

    // Measure update performance
    const updateStartTime = performance.now();
    const updatedData = [...tableData, ...tableData.slice(0, 10)]; // Add 10 more rows

    await act(async () => {
      renderFunction(updatedData);
    });

    const updateTime = performance.now() - updateStartTime;

    return {
      mountTime,
      updateTime,
      unmountTime: 0,
      totalRenders: 2,
      wastedRenders: 0,
    };
  }

  /**
   * Monitor memory usage during component lifecycle
   */
  static monitorComponentMemory(componentName: string): {
    start: () => void;
    end: () => { memoryDelta: number; finalMemory: number };
  } {
    let startMemory: number;

    return {
      start: () => {
        if ((performance as any).memory) {
          startMemory = (performance as any).memory.usedJSHeapSize;
        } else {
          startMemory = 0;
        }
      },
      end: () => {
        if ((performance as any).memory) {
          const endMemory = (performance as any).memory.usedJSHeapSize;
          return {
            memoryDelta: endMemory - startMemory,
            finalMemory: endMemory,
          };
        }
        return { memoryDelta: 0, finalMemory: 0 };
      },
    };
  }

  /**
   * Simulate user interactions for performance testing
   */
  static async simulateUserJourney(
    interactions: Array<{
      action: 'navigate' | 'click' | 'type' | 'wait';
      target?: string;
      value?: string;
      duration?: number;
    }>
  ): Promise<number> {
    const startTime = performance.now();
    const user = userEvent.setup();

    for (const interaction of interactions) {
      switch (interaction.action) {
        case 'click':
          if (interaction.target) {
            const element = screen.getByRole('button', { name: new RegExp(interaction.target, 'i') }) ||
                           screen.getByText(new RegExp(interaction.target, 'i'));
            await user.click(element);
          }
          break;
        
        case 'type':
          if (interaction.target && interaction.value) {
            const element = screen.getByLabelText(new RegExp(interaction.target, 'i')) ||
                           screen.getByRole('textbox', { name: new RegExp(interaction.target, 'i') });
            await user.clear(element);
            await user.type(element, interaction.value);
          }
          break;
        
        case 'wait':
          await waitFor(() => {
            // Wait for any pending updates
          }, { timeout: interaction.duration || 1000 });
          break;
        
        case 'navigate':
          // This would need router integration in actual tests
          await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 50));
          });
          break;
      }

      // Small delay between interactions to simulate real user behavior
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });
    }

    return performance.now() - startTime;
  }

  /**
   * Clean up performance measurements
   */
  static cleanup(): void {
    this.measurements.clear();
    this.renderCounts.clear();
    this.restoreNetworkConditions();
  }

  /**
   * Assert that no memory leaks occurred during test
   */
  static assertNoMemoryLeak(
    beforeMemory: number,
    afterMemory: number,
    threshold: number = 10 * 1024 * 1024 // 10MB default threshold
  ): boolean {
    const memoryDifference = afterMemory - beforeMemory;
    const hasLeak = memoryDifference > threshold;

    if (hasLeak) {
      console.warn(`Potential memory leak detected:
        - Before: ${(beforeMemory / 1024 / 1024).toFixed(2)}MB
        - After: ${(afterMemory / 1024 / 1024).toFixed(2)}MB
        - Difference: ${(memoryDifference / 1024 / 1024).toFixed(2)}MB
        - Threshold: ${(threshold / 1024 / 1024).toFixed(2)}MB`);
    }

    return !hasLeak;
  }

  /**
   * Measure bundle size impact
   */
  static getBundleMetrics(): {
    totalSize: number;
    compressedSize: number;
    moduleCount: number;
  } {
    // This would typically be integrated with webpack-bundle-analyzer
    // For testing purposes, we'll provide mock data
    return {
      totalSize: 1024 * 1024 * 2, // 2MB
      compressedSize: 1024 * 512, // 512KB
      moduleCount: 150,
    };
  }

  /**
   * Create performance-focused test data with realistic complexity
   */
  static createComplexFormData(): {
    basicFields: any;
    dynamicFields: any[];
    validationRules: any;
  } {
    return {
      basicFields: {
        firstName: 'Performance',
        lastName: 'Test',
        dateOfBirth: '1985-01-15',
        phone: '5551234567',
        email: 'performance@test.com',
      },
      dynamicFields: Array.from({ length: 50 }, (_, index) => ({
        id: `dynamic-field-${index}`,
        name: `dynamicField${index}`,
        label: `Dynamic Field ${index}`,
        type: ['text', 'select', 'checkbox', 'radio', 'textarea'][index % 5],
        required: index % 3 === 0,
        options: index % 5 === 1 ? [`Option ${index}A`, `Option ${index}B`, `Option ${index}C`] : undefined,
        value: index % 5 === 0 ? `Value for field ${index}` : 
               index % 5 === 1 ? `Option ${index}A` :
               index % 5 === 2 ? index % 2 === 0 :
               `Text value ${index}`,
        validation: {
          minLength: index % 5 === 0 ? 5 : undefined,
          maxLength: index % 5 === 0 ? 100 : undefined,
          pattern: index % 7 === 0 ? /^[A-Za-z0-9]+$/ : undefined,
        },
      })),
      validationRules: {
        required: ['firstName', 'lastName', 'dateOfBirth'],
        patterns: {
          phone: /^\d{10}$/,
          email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        },
        custom: [
          {
            field: 'dateOfBirth',
            validator: (value: string) => {
              const age = new Date().getFullYear() - new Date(value).getFullYear();
              return age >= 18 && age <= 120;
            },
            message: 'Age must be between 18 and 120 years',
          },
        ],
      },
    };
  }
}

/**
 * Performance test decorator for React components
 */
export function measureComponentPerformance(targetMs: number) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const testName = `${target.constructor.name}.${propertyName}`;
      FrontendPerformanceTestUtils.startMeasurement(testName);

      try {
        const result = await method.apply(this, args);
        const benchmark = FrontendPerformanceTestUtils.assertPerformance(testName, targetMs);

        expect(benchmark.passed).toBe(true);
        expect(benchmark.actual).toBeLessThanOrEqual(targetMs);

        return result;
      } catch (error) {
        FrontendPerformanceTestUtils.endMeasurement(testName);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Healthcare-specific test scenarios
 */
export const HealthcareFrontendScenarios = {
  /**
   * Patient registration form completion scenario
   */
  patientRegistrationJourney: [
    { action: 'type', target: 'firstName', value: 'John' },
    { action: 'type', target: 'lastName', value: 'Doe' },
    { action: 'type', target: 'dateOfBirth', value: '01/15/1985' },
    { action: 'type', target: 'phone', value: '5551234567' },
    { action: 'type', target: 'email', value: 'john.doe@example.com' },
    { action: 'type', target: 'emergencyContactName', value: 'Jane Doe' },
    { action: 'type', target: 'emergencyContactPhone', value: '5551234568' },
    { action: 'click', target: 'spouse' }, // Emergency contact relationship
    { action: 'wait', duration: 100 },
    { action: 'click', target: 'Save Patient' },
    { action: 'wait', duration: 500 },
  ] as const,

  /**
   * Service log creation with complex form
   */
  serviceLogCreationJourney: [
    { action: 'click', target: 'Select Patient' },
    { action: 'type', target: 'patient search', value: 'John Doe' },
    { action: 'wait', duration: 200 },
    { action: 'click', target: 'John Doe' },
    { action: 'click', target: 'serviceType' },
    { action: 'click', target: 'consultation' },
    { action: 'type', target: 'provider', value: 'Dr. Smith' },
    { action: 'type', target: 'scheduledDate', value: '2024-01-15' },
    { action: 'type', target: 'duration', value: '30' },
    { action: 'click', target: 'routine' }, // Priority
    { action: 'type', target: 'notes', value: 'Patient presents with routine checkup requirements. Vital signs to be recorded.' },
    { action: 'type', target: 'symptoms', value: 'No acute symptoms reported' },
    { action: 'type', target: 'bloodPressure', value: '120/80' },
    { action: 'type', target: 'heartRate', value: '72' },
    { action: 'wait', duration: 100 },
    { action: 'click', target: 'Create Service Log' },
    { action: 'wait', duration: 800 },
  ] as const,

  /**
   * Dashboard navigation and data loading
   */
  dashboardNavigationJourney: [
    { action: 'navigate', target: '/dashboard' },
    { action: 'wait', duration: 500 },
    { action: 'click', target: 'Patients' },
    { action: 'wait', duration: 300 },
    { action: 'type', target: 'search patients', value: 'Smith' },
    { action: 'wait', duration: 300 },
    { action: 'click', target: 'Service Logs' },
    { action: 'wait', duration: 300 },
    { action: 'click', target: 'Filter by Date' },
    { action: 'type', target: 'start date', value: '2024-01-01' },
    { action: 'type', target: 'end date', value: '2024-12-31' },
    { action: 'click', target: 'Apply Filters' },
    { action: 'wait', duration: 500 },
  ] as const,
};