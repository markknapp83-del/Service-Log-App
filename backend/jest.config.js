/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.(js|jsx|ts|tsx)',
    '**/?(*.)+(spec|test).(js|jsx|ts|tsx)'
  ],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.(js|jsx|ts|tsx)',
    '!src/**/*.d.ts',
    '!src/app.ts',
    '!src/tests/**',
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
    './src/middleware/auth.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
  
  // Module name mapping for absolute imports
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@controllers/(.*)$': '<rootDir>/src/controllers/$1',
    '^@middleware/(.*)$': '<rootDir>/src/middleware/$1',
    '^@models/(.*)$': '<rootDir>/src/models/$1',
    '^@routes/(.*)$': '<rootDir>/src/routes/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1'
  },
  
  // Transform configuration
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        module: 'ESNext'
      }
    }]
  },
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Verbose output for better debugging
  verbose: true,
  
  // ESM support
  extensionsToTreatAsEsm: ['.ts']
};