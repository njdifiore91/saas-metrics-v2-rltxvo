import { describe, it, expect, jest } from 'jest';
import {
  validateMetricValue,
  validateMetricRange,
  createMetricSchema,
  isValidationError,
  formatValidationError
} from '../../../backend/src/shared/utils/validation';
import { IMetricDefinition, IMetricValidationRule } from '../../../backend/src/shared/interfaces/metric.interface';
import { MetricValidationType, MetricUnit, METRIC_VALIDATION_RANGES } from '../../../backend/src/shared/types/metric-types';
import { DATA_ERRORS } from '../../../backend/src/shared/constants/error-codes';

describe('Validation Utility Tests', () => {
  // Test data setup
  const validMetricDefinition: IMetricDefinition = {
    id: 'test-metric-001',
    name: 'Net Dollar Retention',
    description: 'NDR calculation',
    type: 'RETENTION',
    unit: MetricUnit.PERCENTAGE,
    timeframe: 'ANNUAL',
    formula: '(endingARR / startingARR) * 100',
    validationRules: [
      {
        type: MetricValidationType.RANGE,
        minValue: 0,
        maxValue: 200,
        description: 'NDR must be between 0% and 200%',
        errorMessage: 'NDR value out of valid range'
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  describe('validateMetricValue', () => {
    it('should validate NDR within allowed range', async () => {
      const result = await validateMetricValue(150, validMetricDefinition);
      expect(result).toBe(true);
    });

    it('should reject NDR above maximum allowed value', async () => {
      await expect(validateMetricValue(250, validMetricDefinition))
        .rejects
        .toThrow('Metric value validation failed');
    });

    it('should handle missing metric definition', async () => {
      await expect(validateMetricValue(100, null))
        .rejects
        .toMatchObject({
          code: DATA_ERRORS.DATA002,
          status: 422
        });
    });

    it('should validate all standard metric types', async () => {
      const testCases = [
        { value: 80, range: METRIC_VALIDATION_RANGES.NET_DOLLAR_RETENTION },
        { value: 12, range: METRIC_VALIDATION_RANGES.CAC_PAYBACK },
        { value: 2.5, range: METRIC_VALIDATION_RANGES.MAGIC_NUMBER },
        { value: 300, range: METRIC_VALIDATION_RANGES.PIPELINE_COVERAGE },
        { value: 75, range: METRIC_VALIDATION_RANGES.GROSS_MARGINS }
      ];

      for (const testCase of testCases) {
        const def = {
          ...validMetricDefinition,
          validationRules: [{
            type: MetricValidationType.RANGE,
            minValue: testCase.range.min,
            maxValue: testCase.range.max,
            description: 'Standard range validation',
            errorMessage: 'Value out of range'
          }]
        };
        const result = await validateMetricValue(testCase.value, def);
        expect(result).toBe(true);
      }
    });

    it('should handle concurrent validation requests', async () => {
      const values = Array.from({ length: 100 }, (_, i) => i);
      const results = await Promise.all(
        values.map(v => validateMetricValue(v % 200, validMetricDefinition))
      );
      expect(results.every(r => r === true)).toBe(true);
    });
  });

  describe('validateMetricRange', () => {
    const rangeRule: IMetricValidationRule = {
      type: MetricValidationType.RANGE,
      minValue: 0,
      maxValue: 100,
      description: 'Percentage range validation',
      errorMessage: 'Value must be between 0 and 100'
    };

    it('should validate values within range', () => {
      expect(validateMetricRange(50, rangeRule)).toBe(true);
    });

    it('should validate boundary values', () => {
      expect(validateMetricRange(0, rangeRule)).toBe(true);
      expect(validateMetricRange(100, rangeRule)).toBe(true);
    });

    it('should reject values below minimum', () => {
      expect(() => validateMetricRange(-1, rangeRule))
        .toThrow('Value -1 is below minimum allowed value of 0');
    });

    it('should reject values above maximum', () => {
      expect(() => validateMetricRange(101, rangeRule))
        .toThrow('Value 101 exceeds maximum allowed value of 100');
    });
  });

  describe('createMetricSchema', () => {
    it('should create valid schema with range validation', () => {
      const schema = createMetricSchema(validMetricDefinition);
      expect(schema.safeParse(150).success).toBe(true);
      expect(schema.safeParse(250).success).toBe(false);
    });

    it('should support custom validation rules', () => {
      const defWithCustomRule: IMetricDefinition = {
        ...validMetricDefinition,
        validationRules: [
          ...validMetricDefinition.validationRules,
          {
            type: MetricValidationType.CUSTOM,
            minValue: 0,
            maxValue: 200,
            description: 'Must be even number',
            customValidation: 'value % 2 === 0',
            errorMessage: 'Value must be even'
          }
        ]
      };

      const schema = createMetricSchema(defWithCustomRule);
      expect(schema.safeParse(150).success).toBe(true);
      expect(schema.safeParse(151).success).toBe(false);
    });

    it('should cache and reuse schemas', () => {
      const firstSchema = createMetricSchema(validMetricDefinition);
      const secondSchema = createMetricSchema(validMetricDefinition);
      expect(firstSchema).toBe(secondSchema);
    });
  });

  describe('Error Handling', () => {
    it('should return RFC 7807 compliant errors', async () => {
      try {
        await validateMetricValue(250, validMetricDefinition);
      } catch (error) {
        expect(isValidationError(error)).toBe(true);
        const formatted = formatValidationError(error);
        expect(formatted).toMatchObject({
          type: 'https://api.startupmetrics.com/problems/validation',
          status: 422,
          code: DATA_ERRORS.DATA001,
          message: expect.any(String),
          details: expect.any(Object),
          instance: expect.stringMatching(/^urn:startupmetrics:validation:\d+$/)
        });
      }
    });

    it('should handle system-level validation errors', async () => {
      const defWithInvalidCustomRule: IMetricDefinition = {
        ...validMetricDefinition,
        validationRules: [{
          type: MetricValidationType.CUSTOM,
          minValue: 0,
          maxValue: 100,
          description: 'Invalid rule',
          customValidation: 'invalid.syntax',
          errorMessage: 'Invalid rule'
        }]
      };

      await expect(validateMetricValue(50, defWithInvalidCustomRule))
        .rejects
        .toMatchObject({
          status: 422,
          code: DATA_ERRORS.DATA001
        });
    });
  });

  describe('Performance', () => {
    it('should maintain validation performance under load', async () => {
      const start = Date.now();
      const iterations = 1000;
      const values = Array.from({ length: iterations }, (_, i) => i % 200);
      
      await Promise.all(
        values.map(v => validateMetricValue(v, validMetricDefinition))
      );

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle schema cache efficiently', () => {
      const iterations = 1000;
      const start = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        createMetricSchema(validMetricDefinition);
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100); // Should complete within 100ms
    });
  });
});