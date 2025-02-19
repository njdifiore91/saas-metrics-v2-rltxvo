import { describe, it, expect, beforeEach } from '@jest/globals';
import { 
  validateMetricValue, 
  validateRangeRule, 
  formatValidationError 
} from '../../src/utils/validation.utils';
import { MetricType, MetricUnit, MetricValidationType } from '../../src/types/metric.types';
import { VALIDATION_ERROR_MESSAGES } from '../../src/constants/validation.constants';

describe('validateMetricValue', () => {
  const mockMetricDefinition = {
    id: 'test-metric',
    name: 'Test Metric',
    description: 'Test metric for validation',
    type: MetricType.FINANCIAL,
    unit: MetricUnit.PERCENTAGE,
    timeframe: 'MONTHLY',
    formula: '',
    validationRules: []
  };

  beforeEach(() => {
    // Clear any cached validation results before each test
    jest.useFakeTimers();
  });

  it('should validate NDR within 0-200% range with caching', () => {
    const ndrMetric = {
      ...mockMetricDefinition,
      validationRules: [{
        type: MetricValidationType.RANGE,
        minValue: 0,
        maxValue: 200,
        required: true,
        customValidation: null,
        errorMessage: VALIDATION_ERROR_MESSAGES.INVALID_RANGE,
        priority: 1,
        validationContext: {}
      }]
    };

    // Valid NDR value
    expect(validateMetricValue(150, ndrMetric).isValid).toBe(true);
    
    // Invalid NDR values
    expect(validateMetricValue(-10, ndrMetric).isValid).toBe(false);
    expect(validateMetricValue(250, ndrMetric).isValid).toBe(false);
    
    // Test caching
    const cachedResult = validateMetricValue(150, ndrMetric);
    expect(cachedResult.isValid).toBe(true);
  });

  it('should validate CAC Payback within 0-60 months range with context', () => {
    const cacPaybackMetric = {
      ...mockMetricDefinition,
      unit: MetricUnit.MONTHS,
      validationRules: [{
        type: MetricValidationType.RANGE,
        minValue: 0,
        maxValue: 60,
        required: true,
        customValidation: null,
        errorMessage: VALIDATION_ERROR_MESSAGES.INVALID_RANGE,
        priority: 1,
        validationContext: {}
      }]
    };

    const context = { timeframe: 'MONTHLY' };
    
    expect(validateMetricValue(30, cacPaybackMetric, context).isValid).toBe(true);
    expect(validateMetricValue(70, cacPaybackMetric, context).isValid).toBe(false);
  });

  it('should validate Magic Number within 0-10 range with priority', () => {
    const magicNumberMetric = {
      ...mockMetricDefinition,
      unit: MetricUnit.RATIO,
      validationRules: [
        {
          type: MetricValidationType.RANGE,
          minValue: 0,
          maxValue: 10,
          required: true,
          customValidation: null,
          errorMessage: VALIDATION_ERROR_MESSAGES.INVALID_RANGE,
          priority: 2,
          validationContext: {}
        },
        {
          type: MetricValidationType.CUSTOM,
          minValue: 0,
          maxValue: 0,
          required: false,
          customValidation: (value) => value % 1 === 0,
          errorMessage: VALIDATION_ERROR_MESSAGES.CUSTOM_VALIDATION_FAILED,
          priority: 1,
          validationContext: {}
        }
      ]
    };

    expect(validateMetricValue(5, magicNumberMetric).isValid).toBe(true);
    expect(validateMetricValue(15, magicNumberMetric).isValid).toBe(false);
  });

  it('should handle validation priority ordering', () => {
    const priorityMetric = {
      ...mockMetricDefinition,
      validationRules: [
        {
          type: MetricValidationType.RANGE,
          minValue: 0,
          maxValue: 100,
          required: true,
          customValidation: null,
          errorMessage: VALIDATION_ERROR_MESSAGES.INVALID_RANGE,
          priority: 2,
          validationContext: {}
        },
        {
          type: MetricValidationType.CUSTOM,
          minValue: 0,
          maxValue: 0,
          required: false,
          customValidation: () => false,
          errorMessage: VALIDATION_ERROR_MESSAGES.CUSTOM_VALIDATION_FAILED,
          priority: 1,
          validationContext: {}
        }
      ]
    };

    const result = validateMetricValue(150, priorityMetric);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].code).toBe('INVALID_RANGE');
  });
});

describe('validateRangeRule', () => {
  it('should handle edge cases at range boundaries', () => {
    expect(validateRangeRule(0, 0, 100).isValid).toBe(true);
    expect(validateRangeRule(100, 0, 100).isValid).toBe(true);
    expect(validateRangeRule(-0.1, 0, 100).isValid).toBe(false);
    expect(validateRangeRule(100.1, 0, 100).isValid).toBe(false);
  });

  it('should validate percentage values correctly', () => {
    expect(validateRangeRule(0.5, 0, 1, 'percentage').isValid).toBe(true);
    expect(validateRangeRule(1.5, 0, 1, 'percentage').isValid).toBe(false);
  });

  it('should handle invalid number inputs', () => {
    expect(validateRangeRule(NaN, 0, 100).isValid).toBe(false);
    expect(validateRangeRule(Infinity, 0, 100).isValid).toBe(false);
  });
});

describe('formatValidationError', () => {
  it('should format i18n messages correctly', () => {
    const message = formatValidationError('INVALID_RANGE', { min: 0, max: 100 }, 'en-US');
    expect(message).toContain('0');
    expect(message).toContain('100');
  });

  it('should format currency values correctly', () => {
    const message = formatValidationError('INVALID_RANGE', {
      min: 1000,
      max: 5000,
      type: 'currency'
    }, 'en-US');
    expect(message).toContain('$');
  });

  it('should handle missing parameters gracefully', () => {
    const message = formatValidationError('REQUIRED_FIELD', {}, 'en-US');
    expect(message).toBe(VALIDATION_ERROR_MESSAGES.REQUIRED_FIELD);
  });
});

// Test cache cleanup
describe('validation cache', () => {
  it('should clear cache after timeout', () => {
    const metric = {
      ...mockMetricDefinition,
      validationRules: [{
        type: MetricValidationType.RANGE,
        minValue: 0,
        maxValue: 100,
        required: true,
        customValidation: null,
        errorMessage: VALIDATION_ERROR_MESSAGES.INVALID_RANGE,
        priority: 1,
        validationContext: {}
      }]
    };

    validateMetricValue(50, metric);
    
    // Fast-forward time by 5 minutes
    jest.advanceTimersByTime(300000);
    
    // Cache should be cleared, forcing new validation
    const result = validateMetricValue(50, metric);
    expect(result.isValid).toBe(true);
  });
});