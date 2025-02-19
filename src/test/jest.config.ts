import type { Config } from '@jest/types';
// @ts-jest version: ^29.0.0
// @jest/types version: ^29.0.0

const jestConfig: Config.InitialOptions = {
  // Use ts-jest as the TypeScript preprocessor
  preset: 'ts-jest',

  // Set Node.js as the test environment
  testEnvironment: 'node',

  // Supported file extensions
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'node'
  ],

  // Test root directories for different test types
  roots: [
    '<rootDir>/unit',
    '<rootDir>/integration', 
    '<rootDir>/e2e',
    '<rootDir>/security'
  ],

  // Test file patterns
  testMatch: [
    '**/?(*.)+(spec|test).ts?(x)'
  ],

  // TypeScript transformation configuration
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },

  // Test server setup file
  setupFilesAfterEnv: [
    '<rootDir>/utils/test-server.ts'
  ],

  // Coverage configuration
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: [
    'text',
    'lcov',
    'json-summary'
  ],
  collectCoverageFrom: [
    '../backend/src/**/*.ts',
    '!../backend/src/**/index.ts',
    '!../backend/src/**/*.d.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Test execution configuration
  testTimeout: 30000,
  maxWorkers: '50%',
  clearMocks: true,
  verbose: true,

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/'
  ],

  // Module path aliases
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../backend/src/$1'
  },

  // TypeScript configuration
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.json'
    }
  }
};

export default jestConfig;