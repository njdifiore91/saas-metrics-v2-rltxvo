/**
 * Metric Test Helpers
 * Comprehensive test utility library for validating metric calculations
 * with high precision and extensive error handling
 * @version 1.0.0
 */

import { expect } from '@jest/globals'; // v29.0.0
import { IMetricDefinition } from '../../backend/src/shared/interfaces/metric.interface';
import { calculateNDR } from '../../backend/src/metrics-service/src/utils/metric-calculations';
import { mockMetricDefinitions } from '../mocks/metric-data.mock';

// Default tolerance for floating-point comparisons
export const DEFAULT_TOLERANCE = 0.001;

// Standard test ranges for metrics based on technical specifications
export const METRIC_TEST_RANGES = {
  NDR: { min: 0, max: 200 },
  CAC_PAYBACK: { min: 0, max: 60 },
  MAGIC_NUMBER: { min: 0, max: 10 },
  PIPELINE_COVERAGE: { min: 0, max: 1000 },
  GROSS_MARGINS: { min: -100, max: 100 }
};

/**
 * Interface for validation result details
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  context: {
    metricName: string;
    value: number;
    validationRules: any[];
    timestamp: Date;
  };
}

/**
 * Interface for test data generation options
 */
interface GenerationOptions {
  includeEdgeCases?: boolean;
  timeSeries?: boolean;
  timeSeriesLength?: number;
  customValues?: number[];
}

/**
 * Interface for assertion options
 */
interface AssertionOptions {
  tolerance?: number;
  description?: string;
  includeContext?: boolean;
}

/**
 * Validates a metric calculation result against defined rules
 * @param calculatedValue - The calculated metric value to validate
 * @param metricDefinition - The metric definition containing validation rules
 * @param options - Optional validation configuration
 * @returns Validation result with detailed error information
 */
export function validateMetricCalculation(
  calculatedValue: number,
  metricDefinition: IMetricDefinition,
  options: { tolerance?: number } = {}
): ValidationResult {
  const tolerance = options.tolerance || DEFAULT_TOLERANCE;
  const errors: string[] = [];
  
  // Validate input parameters
  if (calculatedValue === undefined || calculatedValue === null) {
    errors.push('Calculated value cannot be undefined or null');
  }
  
  if (!metricDefinition) {
    errors.push('Metric definition is required');
    return {
      isValid: false,
      errors,
      context: {
        metricName: 'Unknown',
        value: calculatedValue,
        validationRules: [],
        timestamp: new Date()
      }
    };
  }

  // Apply validation rules
  metricDefinition.validationRules.forEach(rule => {
    const value = Number(calculatedValue);
    
    if (isNaN(value)) {
      errors.push('Calculated value must be a valid number');
      return;
    }

    // Range validation
    if (rule.type === 'RANGE') {
      if (value < rule.minValue - tolerance || value > rule.maxValue + tolerance) {
        errors.push(rule.errorMessage || 
          `Value ${value} is outside allowed range [${rule.minValue}, ${rule.maxValue}]`);
      }
    }

    // Custom validation if present
    if (rule.customValidation) {
      try {
        const isValid = new Function('value', `return ${rule.customValidation}`)(value);
        if (!isValid) {
          errors.push(rule.errorMessage || 'Custom validation failed');
        }
      } catch (error) {
        errors.push(`Custom validation error: ${error.message}`);
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    context: {
      metricName: metricDefinition.name,
      value: calculatedValue,
      validationRules: metricDefinition.validationRules,
      timestamp: new Date()
    }
  };
}

/**
 * Generates test data sets for metric calculations
 * @param metricDefinition - The metric definition to generate test data for
 * @param options - Configuration options for test data generation
 * @returns Test data set with expected results
 */
export function generateTestMetricData(
  metricDefinition: IMetricDefinition,
  options: GenerationOptions = {}
): { inputs: number[]; expected: number[] } {
  const range = METRIC_TEST_RANGES[metricDefinition.id] || 
    { min: metricDefinition.validationRules[0]?.minValue || 0,
      max: metricDefinition.validationRules[0]?.maxValue || 100 };

  const testData = {
    inputs: [] as number[],
    expected: [] as number[]
  };

  // Add standard test cases
  const standardCases = [
    range.min,
    range.min + (range.max - range.min) * 0.25,
    (range.min + range.max) / 2,
    range.max - (range.max - range.min) * 0.25,
    range.max
  ];
  testData.inputs.push(...standardCases);

  // Add edge cases if requested
  if (options.includeEdgeCases) {
    const edgeCases = [
      range.min - 0.1,  // Just below minimum
      range.min + 0.1,  // Just above minimum
      range.max - 0.1,  // Just below maximum
      range.max + 0.1   // Just above maximum
    ];
    testData.inputs.push(...edgeCases);
  }

  // Add custom values if provided
  if (options.customValues) {
    testData.inputs.push(...options.customValues);
  }

  // Generate expected results
  testData.expected = testData.inputs.map(input => {
    try {
      return Number(input.toFixed(3));
    } catch (error) {
      return NaN;
    }
  });

  return testData;
}

/**
 * Enhanced assertion helper for metric calculations
 * @param actual - Actual calculated value
 * @param expected - Expected value
 * @param options - Assertion configuration options
 */
export function assertMetricCalculation(
  actual: number,
  expected: number,
  options: AssertionOptions = {}
): void {
  const tolerance = options.tolerance || DEFAULT_TOLERANCE;
  const description = options.description || 'Metric calculation';

  // Handle special cases
  if (isNaN(actual) || isNaN(expected)) {
    expect(isNaN(actual)).toBe(isNaN(expected));
    return;
  }

  if (!isFinite(actual) || !isFinite(expected)) {
    expect(isFinite(actual)).toBe(isFinite(expected));
    return;
  }

  // Calculate absolute and relative differences
  const absoluteDiff = Math.abs(actual - expected);
  const relativeDiff = Math.abs(absoluteDiff / expected);

  // Determine appropriate tolerance based on value magnitude
  const effectiveTolerance = Math.max(
    tolerance,
    Math.abs(expected) * tolerance
  );

  // Perform assertion with detailed error message
  const message = options.includeContext ?
    `${description}: Expected ${expected} but got ${actual} ` +
    `(absolute diff: ${absoluteDiff}, relative diff: ${relativeDiff})` :
    `${description}: Values differ by more than tolerance ${effectiveTolerance}`;

  expect(absoluteDiff).toBeLessThanOrEqual(
    effectiveTolerance,
    message
  );
}

// Export namespace with utility constants and helpers
export namespace MetricTestUtils {
  export const DEFAULT_TOLERANCE = 0.001;
  export const METRIC_TEST_RANGES = METRIC_TEST_RANGES;
  
  /**
   * Helper to create test cases for a specific metric
   */
  export function createTestCases(metricId: string): number[] {
    const range = METRIC_TEST_RANGES[metricId];
    return [
      range.min,
      (range.min + range.max) / 2,
      range.max
    ];
  }
}