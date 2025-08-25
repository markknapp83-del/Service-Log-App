/**
 * Performance Test Utilities
 * Following documented patterns from devdocs/jest.md
 * Healthcare-specific performance testing utilities
 */

import { faker } from '@faker-js/faker';

export interface PerformanceMetrics {
  startTime: bigint;
  endTime: bigint;
  duration: number; // in milliseconds
  memoryUsage?: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
}

export interface PerformanceBenchmark {
  name: string;
  target: number; // target time in milliseconds
  actual: number; // actual time in milliseconds
  passed: boolean;
  details?: any;
}

export class PerformanceTestUtils {
  private static measurements: Map<string, PerformanceMetrics> = new Map();

  /**
   * Start performance measurement for a test
   */
  static startMeasurement(testName: string): void {
    this.measurements.set(testName, {
      startTime: process.hrtime.bigint(),
      endTime: 0n,
      duration: 0,
      memoryUsage: process.memoryUsage(),
    });
  }

  /**
   * End performance measurement and calculate metrics
   */
  static endMeasurement(testName: string): PerformanceMetrics {
    const measurement = this.measurements.get(testName);
    if (!measurement) {
      throw new Error(`No measurement started for test: ${testName}`);
    }

    measurement.endTime = process.hrtime.bigint();
    measurement.duration = Number(measurement.endTime - measurement.startTime) / 1_000_000;

    return measurement;
  }

  /**
   * Assert performance benchmark against target
   */
  static assertPerformance(
    testName: string,
    targetMs: number,
    description?: string
  ): PerformanceBenchmark {
    const metrics = this.endMeasurement(testName);
    const passed = metrics.duration <= targetMs;

    const benchmark: PerformanceBenchmark = {
      name: testName,
      target: targetMs,
      actual: metrics.duration,
      passed,
      details: {
        description: description || `${testName} performance benchmark`,
        memoryUsage: metrics.memoryUsage,
      },
    };

    if (!passed) {
      console.warn(`Performance benchmark failed for ${testName}:`, {
        target: targetMs,
        actual: metrics.duration,
        difference: metrics.duration - targetMs,
      });
    }

    return benchmark;
  }

  /**
   * Monitor memory usage during test execution
   */
  static measureMemoryUsage(): NodeJS.MemoryUsage {
    return process.memoryUsage();
  }

  /**
   * Create large healthcare dataset for performance testing
   */
  static createLargePatientDataset(count: number): any[] {
    return Array.from({ length: count }, () => ({
      id: faker.string.uuid(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      dateOfBirth: faker.date.past({ years: 80 }).toISOString().split('T')[0],
      phone: faker.phone.number('##########'),
      email: faker.internet.email(),
      emergencyContact: JSON.stringify({
        name: faker.person.fullName(),
        phone: faker.phone.number('##########'),
        relationship: faker.helpers.arrayElement(['spouse', 'parent', 'child', 'sibling']),
      }),
      createdAt: faker.date.recent().toISOString(),
      updatedAt: faker.date.recent().toISOString(),
    }));
  }

  /**
   * Create large service log dataset for performance testing
   */
  static createLargeServiceLogDataset(count: number, patientIds?: string[]): any[] {
    const defaultPatientIds = patientIds || Array.from({ length: 100 }, () => faker.string.uuid());

    return Array.from({ length: count }, () => ({
      id: faker.string.uuid(),
      patientId: faker.helpers.arrayElement(defaultPatientIds),
      serviceType: faker.helpers.arrayElement(['consultation', 'procedure', 'therapy', 'diagnostic']),
      providerId: faker.string.uuid(),
      scheduledDate: faker.date.future().toISOString(),
      duration: faker.helpers.arrayElement([15, 30, 45, 60, 90, 120]),
      status: faker.helpers.arrayElement(['scheduled', 'in-progress', 'completed', 'cancelled']),
      priority: faker.helpers.arrayElement(['routine', 'urgent', 'emergency']),
      notes: faker.lorem.paragraphs(2),
      customFields: JSON.stringify({
        symptoms: faker.lorem.sentence(),
        vitals: {
          bloodPressure: `${faker.number.int({ min: 90, max: 180 })}/${faker.number.int({ min: 60, max: 120 })}`,
          heartRate: faker.number.int({ min: 60, max: 120 }),
          temperature: faker.number.float({ min: 96, max: 102, fractionDigits: 1 }),
        },
        medications: faker.helpers.arrayElements([
          'Aspirin', 'Ibuprofen', 'Acetaminophen', 'Amoxicillin', 'Metformin'
        ], { min: 0, max: 3 }),
      }),
      createdAt: faker.date.recent().toISOString(),
      updatedAt: faker.date.recent().toISOString(),
    }));
  }

  /**
   * Simulate concurrent requests for load testing
   */
  static async simulateConcurrentRequests<T>(
    requestFunction: () => Promise<T>,
    concurrentCount: number,
    totalRequests: number
  ): Promise<{
    results: (T | Error)[];
    averageResponseTime: number;
    successRate: number;
    totalTime: number;
  }> {
    const startTime = process.hrtime.bigint();
    const results: (T | Error)[] = [];
    const responseTimes: number[] = [];

    // Execute requests in batches of concurrent users
    for (let i = 0; i < totalRequests; i += concurrentCount) {
      const batch = Math.min(concurrentCount, totalRequests - i);
      const batchPromises: Promise<T | Error>[] = [];

      for (let j = 0; j < batch; j++) {
        const requestStart = process.hrtime.bigint();
        batchPromises.push(
          requestFunction()
            .then(result => {
              const requestEnd = process.hrtime.bigint();
              responseTimes.push(Number(requestEnd - requestStart) / 1_000_000);
              return result;
            })
            .catch(error => {
              const requestEnd = process.hrtime.bigint();
              responseTimes.push(Number(requestEnd - requestStart) / 1_000_000);
              return error;
            })
        );
      }

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(
        ...batchResults.map(result =>
          result.status === 'fulfilled' ? result.value : result.reason
        )
      );
    }

    const endTime = process.hrtime.bigint();
    const totalTime = Number(endTime - startTime) / 1_000_000;

    const successCount = results.filter(result => !(result instanceof Error)).length;
    const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;

    return {
      results,
      averageResponseTime,
      successRate: (successCount / totalRequests) * 100,
      totalTime,
    };
  }

  /**
   * Generate CSV data for export performance testing
   */
  static generateLargeCsvData(rows: number): string {
    const headers = [
      'id',
      'patientName',
      'serviceType',
      'date',
      'provider',
      'status',
      'duration',
      'notes'
    ];

    let csv = headers.join(',') + '\n';

    for (let i = 0; i < rows; i++) {
      const row = [
        faker.string.uuid(),
        `"${faker.person.fullName()}"`,
        faker.helpers.arrayElement(['consultation', 'procedure', 'therapy']),
        faker.date.recent().toISOString().split('T')[0],
        `"Dr. ${faker.person.lastName()}"`,
        faker.helpers.arrayElement(['completed', 'scheduled', 'cancelled']),
        faker.number.int({ min: 15, max: 120 }),
        `"${faker.lorem.sentence().replace(/"/g, '""')}"` // Escape quotes
      ];
      csv += row.join(',') + '\n';
    }

    return csv;
  }

  /**
   * Clean up performance measurements
   */
  static cleanup(): void {
    this.measurements.clear();
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * Get performance summary for all measurements
   */
  static getPerformanceSummary(): PerformanceBenchmark[] {
    return Array.from(this.measurements.entries()).map(([name, metrics]) => ({
      name,
      target: 0, // Will be set by individual tests
      actual: metrics.duration,
      passed: false, // Will be determined by individual tests
      details: {
        memoryUsage: metrics.memoryUsage,
      },
    }));
  }
}

/**
 * Performance test decorators and utilities
 */
export function performanceTest(targetMs: number, description?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const testName = `${target.constructor.name}.${propertyName}`;
      PerformanceTestUtils.startMeasurement(testName);

      try {
        const result = await method.apply(this, args);
        const benchmark = PerformanceTestUtils.assertPerformance(testName, targetMs, description);

        // Jest assertion
        expect(benchmark.passed).toBe(true);
        expect(benchmark.actual).toBeLessThanOrEqual(targetMs);

        return result;
      } catch (error) {
        PerformanceTestUtils.endMeasurement(testName);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Healthcare-specific test data patterns
 */
export const HealthcareTestData = {
  /**
   * Generate realistic patient demographics for performance testing
   */
  generatePatientDemographics(count: number) {
    return Array.from({ length: count }, () => ({
      ageGroup: faker.helpers.arrayElement(['0-17', '18-34', '35-54', '55-74', '75+']),
      gender: faker.helpers.arrayElement(['male', 'female', 'other']),
      insurance: faker.helpers.arrayElement(['private', 'medicare', 'medicaid', 'uninsured']),
      chronicConditions: faker.helpers.arrayElements([
        'diabetes', 'hypertension', 'asthma', 'arthritis', 'depression'
      ], { min: 0, max: 3 }),
      riskLevel: faker.helpers.arrayElement(['low', 'medium', 'high']),
    }));
  },

  /**
   * Generate complex medical forms for performance testing
   */
  generateComplexMedicalForms(count: number) {
    return Array.from({ length: count }, () => ({
      formId: faker.string.uuid(),
      sections: [
        {
          name: 'demographics',
          fields: this.generateDemographicFields(),
        },
        {
          name: 'medical_history',
          fields: this.generateMedicalHistoryFields(),
        },
        {
          name: 'current_symptoms',
          fields: this.generateSymptomsFields(),
        },
        {
          name: 'medications',
          fields: this.generateMedicationFields(),
        },
      ],
      metadata: {
        version: faker.system.semver(),
        lastModified: faker.date.recent().toISOString(),
        completionTime: faker.number.int({ min: 300, max: 1800 }), // 5-30 minutes
      },
    }));
  },

  private generateDemographicFields() {
    return [
      { name: 'firstName', type: 'text', required: true, value: faker.person.firstName() },
      { name: 'lastName', type: 'text', required: true, value: faker.person.lastName() },
      { name: 'dateOfBirth', type: 'date', required: true, value: faker.date.past({ years: 80 }).toISOString().split('T')[0] },
      { name: 'phone', type: 'tel', required: true, value: faker.phone.number() },
      { name: 'email', type: 'email', required: false, value: faker.internet.email() },
    ];
  },

  private generateMedicalHistoryFields() {
    return [
      { name: 'allergies', type: 'textarea', required: false, value: faker.lorem.sentences(2) },
      { name: 'chronicConditions', type: 'multiselect', required: false, value: faker.helpers.arrayElements(['diabetes', 'hypertension', 'asthma']) },
      { name: 'surgicalHistory', type: 'textarea', required: false, value: faker.lorem.sentences(3) },
      { name: 'familyHistory', type: 'textarea', required: false, value: faker.lorem.sentences(2) },
    ];
  },

  private generateSymptomsFields() {
    return [
      { name: 'primaryComplaint', type: 'textarea', required: true, value: faker.lorem.sentences(2) },
      { name: 'symptomDuration', type: 'select', required: true, value: faker.helpers.arrayElement(['< 1 day', '1-7 days', '1-4 weeks', '> 1 month']) },
      { name: 'painLevel', type: 'range', required: false, value: faker.number.int({ min: 0, max: 10 }) },
      { name: 'additionalSymptoms', type: 'checkbox', required: false, value: faker.helpers.arrayElements(['fever', 'nausea', 'fatigue', 'headache']) },
    ];
  },

  private generateMedicationFields() {
    return [
      { name: 'currentMedications', type: 'repeater', required: false, value: this.generateMedicationList() },
      { name: 'drugAllergies', type: 'textarea', required: false, value: faker.lorem.sentence() },
      { name: 'overTheCounter', type: 'textarea', required: false, value: faker.lorem.sentence() },
    ];
  },

  private generateMedicationList() {
    return Array.from({ length: faker.number.int({ min: 0, max: 5 }) }, () => ({
      name: faker.helpers.arrayElement(['Aspirin', 'Ibuprofen', 'Metformin', 'Lisinopril', 'Atorvastatin']),
      dosage: faker.helpers.arrayElement(['10mg', '20mg', '50mg', '100mg']),
      frequency: faker.helpers.arrayElement(['daily', 'twice daily', 'as needed']),
      startDate: faker.date.past().toISOString().split('T')[0],
    }));
  },
};