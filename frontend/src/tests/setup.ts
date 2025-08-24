// Test setup file following documented testing patterns
import '@testing-library/jest-dom';
import 'jest-axe/extend-expect';

// Mock matchMedia for components that use responsive design
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver for components that use it
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock ResizeObserver for components that use it
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Suppress console logs during tests unless explicitly needed
const originalConsole = { ...console };
beforeEach(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
  console.log = jest.fn();
});

afterEach(() => {
  Object.assign(console, originalConsole);
});

// Setup for accessibility testing
export const setupAxe = () => {
  // Configure axe-core for healthcare application testing
  const axeConfig = {
    rules: {
      // Ensure color contrast meets WCAG AA standards
      'color-contrast': { enabled: true },
      // Ensure focus indicators are present
      'focus-order-semantics': { enabled: true },
      // Ensure proper heading hierarchy
      'heading-order': { enabled: true },
      // Ensure form labels are associated
      'label': { enabled: true },
      // Ensure buttons have accessible names
      'button-name': { enabled: true },
      // Ensure links have accessible names
      'link-name': { enabled: true },
    },
  };

  return axeConfig;
};

// Mock performance API for older browsers
if (!global.performance) {
  global.performance = {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
  } as any;
}

// Setup fake timers globally
jest.useFakeTimers();

// Global test cleanup
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
  jest.runOnlyPendingTimers();
});

afterAll(() => {
  jest.useRealTimers();
});

// Healthcare-specific test utilities
export const createMockFormData = (overrides = {}) => ({
  clientId: '550e8400-e29b-41d4-a716-446655440000',
  activityId: '550e8400-e29b-41d4-a716-446655440001',
  patientCount: 5,
  patientEntries: [
    {
      newPatients: 3,
      followupPatients: 2,
      dnaCount: 0,
      outcomeId: '550e8400-e29b-41d4-a716-446655440002',
    },
  ],
  ...overrides,
});

export const createMockApiResponse = (success = true, data = {}) => ({
  success,
  data: success ? data : undefined,
  error: success ? undefined : { message: 'API Error', code: 'SERVER_ERROR' },
  timestamp: new Date().toISOString(),
});

// Mock healthcare entities
export const mockEntities = {
  client: {
    id: 'client-1',
    name: 'Main Hospital',
    description: 'Primary healthcare facility',
    isActive: true,
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
  },
  activity: {
    id: 'activity-1',
    name: 'General Consultation',
    description: 'Standard patient consultation',
    isActive: true,
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
  },
  outcome: {
    id: 'outcome-1',
    name: 'Treatment Completed',
    description: 'Patient treatment successfully completed',
    isActive: true,
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
  },
};