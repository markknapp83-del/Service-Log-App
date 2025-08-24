// Test setup following Jest documentation patterns
import { jest } from '@jest/globals';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing';
process.env.DB_PATH = ':memory:';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
} as Console;

// Global test utilities following documentation patterns
global.testUtils = {
  createMockUser: (overrides = {}) => ({
    id: 'user-123',
    username: 'testuser',
    email: 'test@healthcare.local',
    passwordHash: '$2a$12$mockhashedpassword',
    role: 'admin' as const,
    firstName: 'Test',
    lastName: 'User',
    isActive: true,
    createdAt: '2023-12-01T10:00:00Z',
    updatedAt: '2023-12-01T10:00:00Z',
    ...overrides,
  }),
  
  createMockCandidate: (overrides = {}) => ({
    id: 'candidate-123',
    username: 'testcandidate',
    email: 'candidate@healthcare.local',
    passwordHash: '$2a$12$mockhashedpassword',
    role: 'candidate' as const,
    firstName: 'Test',
    lastName: 'Candidate',
    isActive: true,
    createdAt: '2023-12-01T10:00:00Z',
    updatedAt: '2023-12-01T10:00:00Z',
    ...overrides,
  }),
};

// Extend global types for test utilities
declare global {
  var testUtils: {
    createMockUser: (overrides?: Record<string, any>) => any;
    createMockCandidate: (overrides?: Record<string, any>) => any;
  };
}