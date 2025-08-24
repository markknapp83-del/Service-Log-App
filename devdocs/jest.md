# Jest Documentation for Healthcare Service Log Portal

## Overview
Jest is a comprehensive JavaScript testing framework that provides everything needed for testing healthcare applications, including unit tests, integration tests, mocking, and coverage reporting.

## Installation and Setup

### Installation
```bash
# For new projects
npm init -y
npm install --save-dev jest @jest/globals

# For TypeScript projects
npm install --save-dev jest @jest/globals @types/jest ts-jest typescript

# For React projects
npm install --save-dev jest @jest/globals @testing-library/react @testing-library/jest-dom
```

### Basic Configuration
```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest', // For TypeScript projects
  testEnvironment: 'node', // Use 'jsdom' for React components
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.(js|jsx|ts|tsx)',
    '**/?(*.)+(spec|test).(js|jsx|ts|tsx)'
  ],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.(js|jsx|ts|tsx)',
    '!src/**/*.d.ts',
    '!src/index.tsx',
    '!src/serviceWorker.ts',
  ],
  
  // Coverage thresholds for healthcare applications
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    // Critical modules require higher coverage
    './src/services/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './src/utils/validation.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
  
  // Module name mapping for absolute imports
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@api/(.*)$': '<rootDir>/src/api/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
  },
  
  // Transform configuration
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Verbose output for better debugging
  verbose: true,
};
```

### Setup Files
```typescript
// src/setupTests.ts
import '@testing-library/jest-dom';
import { jest } from '@jest/globals';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.DB_PATH = ':memory:';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
} as Console;

// Mock crypto for password hashing in tests
Object.defineProperty(global, 'crypto', {
  value: {
    randomBytes: jest.fn().mockReturnValue(Buffer.from('test-bytes')),
    createHash: jest.fn().mockReturnValue({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('mocked-hash'),
    }),
  },
});

// Mock Date for consistent test results
const mockDate = new Date('2023-12-01T10:00:00Z');
jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

// Global test utilities
global.testUtils = {
  createMockPatient: (overrides = {}) => ({
    id: 'patient-123',
    firstName: 'John',
    lastName: 'Doe',
    dateOfBirth: '1985-01-15',
    phone: '5551234567',
    email: 'john@example.com',
    emergencyContact: {
      name: 'Jane Doe',
      phone: '5551234568',
      relationship: 'spouse',
    },
    createdAt: '2023-12-01T10:00:00Z',
    updatedAt: '2023-12-01T10:00:00Z',
    ...overrides,
  }),
  
  createMockService: (patientId = 'patient-123', overrides = {}) => ({
    id: 'service-456',
    patientId,
    serviceType: 'consultation',
    providerId: 'provider-789',
    scheduledDate: '2023-12-02T09:00:00Z',
    duration: 30,
    status: 'scheduled',
    priority: 'routine',
    location: {
      facility: 'main-hospital',
      room: '101',
    },
    createdAt: '2023-12-01T10:00:00Z',
    updatedAt: '2023-12-01T10:00:00Z',
    ...overrides,
  }),
};
```

## Unit Testing Patterns

### Service Layer Testing
```typescript
// __tests__/services/PatientService.test.ts
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { PatientService } from '@/services/PatientService';
import { PatientRepository } from '@/repositories/PatientRepository';
import { ValidationError } from '@/utils/errors';

// Mock the repository
jest.mock('@/repositories/PatientRepository');

const mockPatientRepository = PatientRepository as jest.MockedClass<typeof PatientRepository>;

describe('PatientService', () => {
  let patientService: PatientService;
  let mockRepository: jest.Mocked<PatientRepository>;

  beforeEach(() => {
    mockRepository = new mockPatientRepository() as jest.Mocked<PatientRepository>;
    patientService = new PatientService(mockRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPatient', () => {
    test('creates patient with valid data', async () => {
      const patientData = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1985-01-15',
        phone: '5551234567',
        email: 'john@example.com',
        emergencyContact: {
          name: 'Jane Doe',
          phone: '5551234568',
          relationship: 'spouse' as const,
        },
      };

      const expectedPatient = {
        id: 'generated-id',
        ...patientData,
        createdAt: '2023-12-01T10:00:00Z',
        updatedAt: '2023-12-01T10:00:00Z',
      };

      mockRepository.create.mockResolvedValue(expectedPatient);
      mockRepository.findByPhone.mockResolvedValue(null);

      const result = await patientService.createPatient(patientData, 'user-123');

      expect(mockRepository.findByPhone).toHaveBeenCalledWith('5551234567');
      expect(mockRepository.create).toHaveBeenCalledWith(patientData, 'user-123');
      expect(result).toEqual(expectedPatient);
    });

    test('throws error when patient with phone already exists', async () => {
      const patientData = global.testUtils.createMockPatient();
      const existingPatient = global.testUtils.createMockPatient({ id: 'existing-id' });

      mockRepository.findByPhone.mockResolvedValue(existingPatient);

      await expect(
        patientService.createPatient(patientData, 'user-123')
      ).rejects.toThrow('Patient with this phone number already exists');

      expect(mockRepository.findByPhone).toHaveBeenCalledWith(patientData.phone);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    test('validates required fields', async () => {
      const invalidPatientData = {
        firstName: '', // Invalid: empty string
        lastName: 'Doe',
        dateOfBirth: '1985-01-15',
        phone: '5551234567',
      };

      mockRepository.findByPhone.mockResolvedValue(null);

      await expect(
        patientService.createPatient(invalidPatientData as any, 'user-123')
      ).rejects.toThrow(ValidationError);
    });

    test('handles database errors gracefully', async () => {
      const patientData = global.testUtils.createMockPatient();
      const dbError = new Error('Database connection failed');

      mockRepository.findByPhone.mockResolvedValue(null);
      mockRepository.create.mockRejectedValue(dbError);

      await expect(
        patientService.createPatient(patientData, 'user-123')
      ).rejects.toThrow('Failed to create patient: Database connection failed');
    });
  });

  describe('updatePatient', () => {
    test('updates patient successfully', async () => {
      const patientId = 'patient-123';
      const updateData = { firstName: 'Jane' };
      const existingPatient = global.testUtils.createMockPatient({ id: patientId });
      const updatedPatient = { ...existingPatient, ...updateData };

      mockRepository.findById.mockResolvedValue(existingPatient);
      mockRepository.update.mockResolvedValue(updatedPatient);

      const result = await patientService.updatePatient(patientId, updateData, 'user-123');

      expect(mockRepository.findById).toHaveBeenCalledWith(patientId);
      expect(mockRepository.update).toHaveBeenCalledWith(patientId, updateData, 'user-123');
      expect(result).toEqual(updatedPatient);
    });

    test('throws error when patient not found', async () => {
      const patientId = 'nonexistent-id';
      const updateData = { firstName: 'Jane' };

      mockRepository.findById.mockResolvedValue(null);

      await expect(
        patientService.updatePatient(patientId, updateData, 'user-123')
      ).rejects.toThrow('Patient not found');

      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('searchPatients', () => {
    test('returns paginated search results', async () => {
      const searchTerm = 'John';
      const searchOptions = { page: 1, limit: 10 };
      const mockResults = {
        items: [global.testUtils.createMockPatient()],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      };

      mockRepository.searchPatients.mockResolvedValue(mockResults);

      const result = await patientService.searchPatients(searchTerm, searchOptions);

      expect(mockRepository.searchPatients).toHaveBeenCalledWith(searchTerm, searchOptions);
      expect(result).toEqual(mockResults);
    });

    test('validates minimum search length', async () => {
      const shortSearchTerm = 'J'; // Too short

      await expect(
        patientService.searchPatients(shortSearchTerm)
      ).rejects.toThrow('Search term must be at least 2 characters');

      expect(mockRepository.searchPatients).not.toHaveBeenCalled();
    });
  });
});
```

### Repository Testing with Database
```typescript
// __tests__/repositories/PatientRepository.test.ts
import { describe, test, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import Database from 'better-sqlite3';
import { PatientRepository } from '@/repositories/PatientRepository';

describe('PatientRepository', () => {
  let db: Database.Database;
  let repository: PatientRepository;

  beforeAll(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    
    // Create tables
    db.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        role TEXT
      );
      
      CREATE TABLE patients (
        id TEXT PRIMARY KEY,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        date_of_birth TEXT NOT NULL,
        phone TEXT UNIQUE NOT NULL,
        email TEXT,
        emergency_contact TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        created_by TEXT NOT NULL,
        FOREIGN KEY (created_by) REFERENCES users (id)
      );
    `);

    // Insert test user
    db.prepare(`
      INSERT INTO users (id, username, first_name, last_name, role)
      VALUES ('user-123', 'testuser', 'Test', 'User', 'admin')
    `).run();

    repository = new PatientRepository();
    // Override the repository's database connection for testing
    repository.db = db;
  });

  beforeEach(() => {
    // Clean up patients table before each test
    db.exec('DELETE FROM patients');
  });

  afterAll(() => {
    db.close();
  });

  describe('create', () => {
    test('creates patient with valid data', () => {
      const patientData = {
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '1985-01-15',
        phone: '5551234567',
        email: 'john@example.com',
        emergency_contact: JSON.stringify({
          name: 'Jane Doe',
          phone: '5551234568',
          relationship: 'spouse',
        }),
      };

      const patient = repository.create(patientData, 'user-123');

      expect(patient.id).toBeDefined();
      expect(patient.first_name).toBe('John');
      expect(patient.phone).toBe('5551234567');
      expect(patient.created_by).toBe('user-123');
      expect(patient.created_at).toBeDefined();
    });

    test('throws error for duplicate phone number', () => {
      const patientData = {
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '1985-01-15',
        phone: '5551234567',
        emergency_contact: JSON.stringify({
          name: 'Jane Doe',
          phone: '5551234568',
          relationship: 'spouse',
        }),
      };

      // Create first patient
      repository.create(patientData, 'user-123');

      // Try to create second patient with same phone
      expect(() => {
        repository.create(patientData, 'user-123');
      }).toThrow(/UNIQUE constraint failed/);
    });
  });

  describe('findById', () => {
    test('returns patient by id', () => {
      const patientData = {
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '1985-01-15',
        phone: '5551234567',
        emergency_contact: JSON.stringify({
          name: 'Jane Doe',
          phone: '5551234568',
          relationship: 'spouse',
        }),
      };

      const created = repository.create(patientData, 'user-123');
      const found = repository.findById(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.first_name).toBe('John');
    });

    test('returns null for non-existent id', () => {
      const found = repository.findById('non-existent-id');
      expect(found).toBeNull();
    });

    test('does not return soft-deleted patients', () => {
      const patientData = {
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '1985-01-15',
        phone: '5551234567',
        emergency_contact: JSON.stringify({
          name: 'Jane Doe',
          phone: '5551234568',
          relationship: 'spouse',
        }),
      };

      const created = repository.create(patientData, 'user-123');
      
      // Soft delete the patient
      repository.softDelete(created.id, 'user-123');
      
      const found = repository.findById(created.id);
      expect(found).toBeNull();
    });
  });

  describe('searchPatients', () => {
    beforeEach(() => {
      // Insert test patients
      const patients = [
        {
          first_name: 'John',
          last_name: 'Doe',
          phone: '5551234567',
          emergency_contact: JSON.stringify({ name: 'Jane', phone: '555', relationship: 'spouse' }),
        },
        {
          first_name: 'Jane',
          last_name: 'Smith',
          phone: '5559876543',
          emergency_contact: JSON.stringify({ name: 'John', phone: '555', relationship: 'spouse' }),
        },
        {
          first_name: 'Bob',
          last_name: 'Johnson',
          phone: '5555551234',
          emergency_contact: JSON.stringify({ name: 'Alice', phone: '555', relationship: 'spouse' }),
        },
      ];

      patients.forEach(patient => {
        repository.create({
          ...patient,
          date_of_birth: '1985-01-15',
        }, 'user-123');
      });
    });

    test('searches by first name', () => {
      const results = repository.searchPatients('John', { page: 1, limit: 10 });

      expect(results.total).toBe(1);
      expect(results.items).toHaveLength(1);
      expect(results.items[0].first_name).toBe('John');
    });

    test('searches by last name', () => {
      const results = repository.searchPatients('Smith', { page: 1, limit: 10 });

      expect(results.total).toBe(1);
      expect(results.items).toHaveLength(1);
      expect(results.items[0].last_name).toBe('Smith');
    });

    test('searches by phone number', () => {
      const results = repository.searchPatients('5559876543', { page: 1, limit: 10 });

      expect(results.total).toBe(1);
      expect(results.items).toHaveLength(1);
      expect(results.items[0].phone).toBe('5559876543');
    });

    test('returns empty results for no matches', () => {
      const results = repository.searchPatients('NonExistent', { page: 1, limit: 10 });

      expect(results.total).toBe(0);
      expect(results.items).toHaveLength(0);
    });

    test('handles pagination correctly', () => {
      const page1 = repository.searchPatients('o', { page: 1, limit: 2 }); // Matches John and Bob
      const page2 = repository.searchPatients('o', { page: 2, limit: 2 });

      expect(page1.total).toBe(2);
      expect(page1.items).toHaveLength(2);
      expect(page1.totalPages).toBe(1); // Only 2 results, so 1 page with limit 2
      
      expect(page2.total).toBe(2);
      expect(page2.items).toHaveLength(0); // No results on page 2
    });
  });
});
```

### API Endpoint Testing
```typescript
// __tests__/api/patients.test.ts
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import app from '@/app';
import { generateTestToken } from '@/utils/testHelpers';

describe('Patients API', () => {
  let authToken: string;

  beforeAll(() => {
    authToken = generateTestToken({ 
      userId: 'user-123', 
      role: 'admin' 
    });
  });

  describe('POST /api/patients', () => {
    test('creates patient with valid data', async () => {
      const patientData = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1985-01-15',
        phone: '5551234567',
        email: 'john@example.com',
        emergencyContact: {
          name: 'Jane Doe',
          phone: '5551234568',
          relationship: 'spouse',
        },
      };

      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(patientData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.firstName).toBe('John');
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.createdAt).toBeDefined();
    });

    test('returns 400 for invalid data', async () => {
      const invalidData = {
        firstName: '', // Invalid: empty
        lastName: 'Doe',
        phone: '123', // Invalid: too short
      };

      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toBeDefined();
    });

    test('returns 401 without authentication', async () => {
      const patientData = global.testUtils.createMockPatient();

      const response = await request(app)
        .post('/api/patients')
        .send(patientData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    test('returns 403 for insufficient permissions', async () => {
      const readOnlyToken = generateTestToken({ 
        userId: 'user-456', 
        role: 'staff',
        permissions: [{ resource: 'patients', actions: ['read'] }]
      });

      const patientData = global.testUtils.createMockPatient();

      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${readOnlyToken}`)
        .send(patientData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /api/patients', () => {
    beforeEach(async () => {
      // Create test patients
      const patients = [
        { firstName: 'John', lastName: 'Doe', phone: '5551234567' },
        { firstName: 'Jane', lastName: 'Smith', phone: '5559876543' },
        { firstName: 'Bob', lastName: 'Johnson', phone: '5555551234' },
      ];

      for (const patient of patients) {
        await request(app)
          .post('/api/patients')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ...patient,
            dateOfBirth: '1985-01-15',
            emergencyContact: {
              name: 'Emergency Contact',
              phone: '5550000000',
              relationship: 'spouse',
            },
          });
      }
    });

    test('returns paginated patient list', async () => {
      const response = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 2 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.patients).toHaveLength(2);
      expect(response.body.data.total).toBe(3);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.totalPages).toBe(2);
    });

    test('filters patients by search term', async () => {
      const response = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ search: 'John' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.patients).toHaveLength(2); // John Doe and Bob Johnson
      expect(response.body.data.patients.every(p => 
        p.firstName.includes('John') || p.lastName.includes('Johnson')
      )).toBe(true);
    });

    test('validates query parameters', async () => {
      const response = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: -1, limit: 1000 }) // Invalid values
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('QUERY_VALIDATION_ERROR');
    });
  });

  describe('GET /api/patients/:id', () => {
    let patientId: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1985-01-15',
          phone: '5551234567',
          emergencyContact: {
            name: 'Jane Doe',
            phone: '5551234568',
            relationship: 'spouse',
          },
        });

      patientId = response.body.data.id;
    });

    test('returns patient by id', async () => {
      const response = await request(app)
        .get(`/api/patients/${patientId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(patientId);
      expect(response.body.data.firstName).toBe('John');
    });

    test('returns 404 for non-existent patient', async () => {
      const response = await request(app)
        .get('/api/patients/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    test('validates UUID format', async () => {
      const response = await request(app)
        .get('/api/patients/invalid-uuid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
```

## Mocking Strategies

### Database Mocking
```typescript
// __mocks__/better-sqlite3.ts
const mockDatabase = {
  prepare: jest.fn().mockReturnValue({
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn(),
  }),
  exec: jest.fn(),
  pragma: jest.fn(),
  close: jest.fn(),
  transaction: jest.fn().mockImplementation((fn) => fn),
};

const Database = jest.fn().mockImplementation(() => mockDatabase);

export default Database;
```

### External API Mocking
```typescript
// __tests__/services/EmailService.test.ts
import { EmailService } from '@/services/EmailService';
import { jest } from '@jest/globals';

// Mock external email service
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({
      messageId: 'test-message-id',
      response: '250 OK',
    }),
  }),
}));

describe('EmailService', () => {
  let emailService: EmailService;

  beforeEach(() => {
    emailService = new EmailService();
  });

  test('sends appointment confirmation email', async () => {
    const appointment = {
      patientName: 'John Doe',
      patientEmail: 'john@example.com',
      serviceType: 'consultation',
      scheduledDate: '2023-12-02T09:00:00Z',
      providerName: 'Dr. Smith',
    };

    const result = await emailService.sendAppointmentConfirmation(appointment);

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('test-message-id');
  });
});
```

### HTTP Request Mocking
```typescript
// __tests__/services/InsuranceVerificationService.test.ts
import { InsuranceVerificationService } from '@/services/InsuranceVerificationService';
import { jest } from '@jest/globals';

// Mock fetch globally
global.fetch = jest.fn();

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('InsuranceVerificationService', () => {
  let service: InsuranceVerificationService;

  beforeEach(() => {
    service = new InsuranceVerificationService();
    mockFetch.mockClear();
  });

  test('verifies insurance coverage successfully', async () => {
    const mockResponse = {
      eligible: true,
      copayAmount: 25,
      deductible: 500,
      deductibleMet: 200,
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const insuranceInfo = {
      provider: 'Blue Cross',
      policyNumber: 'BC123456',
      memberId: 'M789',
    };

    const result = await service.verifyInsurance(insuranceInfo);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/verify-insurance'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(insuranceInfo),
      })
    );

    expect(result).toEqual(mockResponse);
  });

  test('handles insurance verification errors', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const insuranceInfo = {
      provider: 'Blue Cross',
      policyNumber: 'BC123456',
      memberId: 'M789',
    };

    await expect(
      service.verifyInsurance(insuranceInfo)
    ).rejects.toThrow('Insurance verification failed: Network error');
  });
});
```

## Testing Utilities

### Custom Matchers
```typescript
// src/testUtils/customMatchers.ts
import { expect } from '@jest/globals';

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidPatientId(): R;
      toBeValidPhoneNumber(): R;
      toHaveBeenCalledWithValidPatient(): R;
    }
  }
}

expect.extend({
  toBeValidPatientId(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    
    return {
      message: () =>
        `expected ${received} ${pass ? 'not ' : ''}to be a valid patient ID (UUID)`,
      pass,
    };
  },

  toBeValidPhoneNumber(received: string) {
    const phoneRegex = /^\d{10}$|^\d{3}-\d{3}-\d{4}$/;
    const pass = phoneRegex.test(received);
    
    return {
      message: () =>
        `expected ${received} ${pass ? 'not ' : ''}to be a valid phone number`,
      pass,
    };
  },

  toHaveBeenCalledWithValidPatient(received: jest.Mock) {
    const calls = received.mock.calls;
    const validCall = calls.some(call => {
      const patient = call[0];
      return patient && 
             typeof patient.firstName === 'string' &&
             typeof patient.lastName === 'string' &&
             typeof patient.phone === 'string';
    });

    return {
      message: () =>
        `expected ${received} ${validCall ? 'not ' : ''}to have been called with a valid patient object`,
      pass: validCall,
    };
  },
});
```

### Test Data Factories
```typescript
// src/testUtils/factories.ts
import { faker } from '@faker-js/faker';

export class PatientFactory {
  static create(overrides: Partial<Patient> = {}): Patient {
    return {
      id: faker.string.uuid(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      dateOfBirth: faker.date.past({ years: 50 }).toISOString().split('T')[0],
      phone: faker.phone.number('##########'),
      email: faker.internet.email(),
      emergencyContact: {
        name: faker.person.fullName(),
        phone: faker.phone.number('##########'),
        relationship: faker.helpers.arrayElement(['spouse', 'parent', 'child', 'sibling']),
      },
      createdAt: faker.date.recent().toISOString(),
      updatedAt: faker.date.recent().toISOString(),
      ...overrides,
    };
  }

  static createMany(count: number, overrides: Partial<Patient> = {}): Patient[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  static createWithServices(serviceCount: number = 3): Patient & { services: ServiceEntry[] } {
    const patient = this.create();
    const services = ServiceFactory.createMany(serviceCount, { patientId: patient.id });
    
    return { ...patient, services };
  }
}

export class ServiceFactory {
  static create(overrides: Partial<ServiceEntry> = {}): ServiceEntry {
    return {
      id: faker.string.uuid(),
      patientId: faker.string.uuid(),
      serviceType: faker.helpers.arrayElement(['consultation', 'procedure', 'therapy', 'diagnostic']),
      providerId: faker.string.uuid(),
      scheduledDate: faker.date.future().toISOString(),
      duration: faker.helpers.arrayElement([15, 30, 45, 60, 90]),
      status: faker.helpers.arrayElement(['scheduled', 'in-progress', 'completed', 'cancelled']),
      priority: faker.helpers.arrayElement(['routine', 'urgent', 'emergency']),
      location: {
        facility: faker.helpers.arrayElement(['main-hospital', 'outpatient-clinic']),
        room: faker.location.buildingNumber(),
      },
      notes: faker.lorem.paragraph(),
      createdAt: faker.date.recent().toISOString(),
      updatedAt: faker.date.recent().toISOString(),
      ...overrides,
    };
  }

  static createMany(count: number, overrides: Partial<ServiceEntry> = {}): ServiceEntry[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }
}

// Usage in tests
describe('Patient Management', () => {
  test('processes multiple patients', () => {
    const patients = PatientFactory.createMany(5);
    
    expect(patients).toHaveLength(5);
    patients.forEach(patient => {
      expect(patient.firstName).toBeTruthy();
      expect(patient.phone).toBeValidPhoneNumber();
    });
  });
});
```

## Performance and Coverage

### Coverage Configuration
```javascript
// jest.config.js (coverage section)
module.exports = {
  // ... other config
  
  // Collect coverage from these files
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.tsx',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/__tests__/**',
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    // Critical healthcare modules
    './src/services/PatientService.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    './src/utils/validation.ts': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
  
  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  
  // Coverage directory
  coverageDirectory: 'coverage',
};
```

### Performance Testing
```typescript
// __tests__/performance/database.test.ts
import { describe, test, expect } from '@jest/globals';
import { PatientRepository } from '@/repositories/PatientRepository';
import { PatientFactory } from '@/testUtils/factories';

describe('Database Performance', () => {
  let repository: PatientRepository;

  beforeAll(() => {
    repository = new PatientRepository();
    // Use real database connection for performance tests
  });

  test('bulk patient insertion performance', async () => {
    const patientCount = 1000;
    const patients = PatientFactory.createMany(patientCount);
    
    const startTime = process.hrtime.bigint();
    
    // Use transaction for bulk operations
    await repository.bulkCreate(patients);
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
    
    // Should complete within 5 seconds
    expect(duration).toBeLessThan(5000);
    
    // Verify all patients were created
    const totalPatients = await repository.count();
    expect(totalPatients).toBe(patientCount);
  });

  test('patient search performance', async () => {
    // Pre-populate with test data
    const patients = PatientFactory.createMany(5000);
    await repository.bulkCreate(patients);
    
    const searchTerms = ['John', 'Smith', '555', 'jane@'];
    
    for (const term of searchTerms) {
      const startTime = process.hrtime.bigint();
      
      const results = await repository.searchPatients(term, { page: 1, limit: 20 });
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000;
      
      // Search should complete within 500ms
      expect(duration).toBeLessThan(500);
      
      // Results should be reasonable
      expect(results.items.length).toBeLessThanOrEqual(20);
    }
  });
});
```

## Continuous Integration

### GitHub Actions Configuration
```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linting
      run: npm run lint
    
    - name: Run type checking
      run: npm run type-check
    
    - name: Run unit tests
      run: npm test -- --coverage --watchAll=false
    
    - name: Run integration tests
      run: npm run test:integration
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v4
      with:
        file: ./coverage/lcov.info
        flags: unittests
        name: codecov-umbrella
    
    - name: Generate test report
      if: always()
      run: npm run test:report
    
    - name: Upload test results
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: test-results-${{ matrix.node-version }}
        path: |
          coverage/
          test-results/
```

## Best Practices

### 1. Test Organization
- Group related tests with `describe` blocks
- Use descriptive test names that explain the scenario
- Follow AAA pattern (Arrange, Act, Assert)
- Keep tests focused and independent

### 2. Healthcare-Specific Testing
- Test data validation rigorously
- Verify audit trail functionality
- Test error handling for critical operations
- Ensure HIPAA compliance in test data

### 3. Mock Strategy
- Mock external dependencies consistently
- Use real implementations for unit logic
- Test integration points with contract tests
- Keep mocks simple and focused

### 4. Coverage Goals
- Aim for high coverage on critical paths
- Focus on business logic over boilerplate
- Use coverage to identify untested scenarios
- Don't chase 100% coverage blindly

### 5. Performance Testing
- Test database operations under load
- Verify API response times
- Monitor memory usage in tests
- Use performance budgets

## Resources
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library Best Practices](https://testing-library.com/docs/guiding-principles)
- [Node.js Testing Best Practices](https://github.com/goldbergyoni/nodebestpractices#-6-testing-and-overall-quality-practices)
- [Healthcare Software Testing Guidelines](https://www.fda.gov/medical-devices/software-medical-device-samd/software-medical-device-samd-clinical-evaluation)