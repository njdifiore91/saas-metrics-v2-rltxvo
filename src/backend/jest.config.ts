import type { Config } from '@jest/types';
import { defaults as tsjPreset } from 'ts-jest/presets';
import { compilerOptions } from './tsconfig.json';

/**
 * Generates the complete Jest configuration for backend testing environment
 * Supports microservices architecture with TypeScript integration
 * @returns {Config.InitialOptions} Complete Jest configuration object
 */
const getJestConfig = (): Config.InitialOptions => {
  return {
    // Use ts-jest as the test environment preset
    preset: 'ts-jest',
    testEnvironment: 'node',

    // Root directories for test discovery
    roots: ['<rootDir>/src'],

    // Test file patterns
    testMatch: [
      '**/?(*.)+(spec|test).ts?(x)'
    ],

    // Module path mapping for microservices
    moduleNameMapper: {
      '@shared/(.*)': '<rootDir>/src/shared/$1',
      '@admin/(.*)': '<rootDir>/src/admin-service/src/$1',
      '@auth/(.*)': '<rootDir>/src/auth-service/src/$1',
      '@metrics/(.*)': '<rootDir>/src/metrics-service/src/$1',
      '@report/(.*)': '<rootDir>/src/report-service/src/$1',
      '@gateway/(.*)': '<rootDir>/src/api-gateway/src/$1'
    },

    // Code coverage configuration
    collectCoverage: true,
    coverageDirectory: '<rootDir>/coverage',
    coverageReporters: [
      'text',
      'lcov',
      'json-summary'
    ],
    coverageThreshold: {
      global: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      }
    },

    // Test setup and environment configuration
    setupFilesAfterEnv: [
      '<rootDir>/src/test/utils/test-server.ts'
    ],

    // File extensions to consider
    moduleFileExtensions: [
      'ts',
      'tsx',
      'js',
      'jsx',
      'json'
    ],

    // TypeScript transformation configuration
    transform: {
      '^.+\\.tsx?$': 'ts-jest'
    },

    // Paths to ignore during testing
    testPathIgnorePatterns: [
      '/node_modules/',
      '/dist/'
    ],

    // TypeScript configuration
    globals: {
      'ts-jest': {
        tsconfig: '<rootDir>/tsconfig.json'
      }
    },

    // Test execution configuration
    verbose: true,
    testTimeout: 30000,
    maxWorkers: '50%'
  };
};

// Export the configuration
const config = getJestConfig();
export default config;