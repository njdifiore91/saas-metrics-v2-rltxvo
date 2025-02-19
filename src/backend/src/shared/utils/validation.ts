/**
 * Validation Utility Module for Startup Metrics Benchmarking Platform
 * Provides comprehensive validation functions for metric data with RFC 7807 compliant error handling
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.22.0
import NodeCache from 'node-cache'; // v5.1.2
import { IMetricDefinition, IMetricValidationRule } from '../interfaces/metric.interface';
import { MetricValidationType } from '../types/metric-types';
import { DATA_ERRORS } from '../constants/error-codes';

/**
 * Cache instance for storing compiled validation schemas
 * TTL: 1 hour, Check period: 2 minutes
 */
const schemaCache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

/**
 * Custom error class for validation errors following RFC 7807
 */
class ValidationError extends Error {
  constructor(
    public type: string,
    public status: number,
    public code: string,
    public message: string,
    public details: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validates a metric value against its defined validation rules
 * @param value - The metric value to validate
 * @param metricDefinition - The metric definition containing validation rules
 * @returns Promise<boolean> - Returns true if validation passes, throws ValidationError if fails
 */
export async function validateMetricValue(
  value: number,
  metricDefinition: IMetricDefinition
): Promise<boolean> {
  try {
    if (!metricDefinition || !metricDefinition.validationRules) {
      throw new ValidationError(
        'https://api.startupmetrics.com/problems/validation',
        422,
        DATA_ERRORS.DATA002,
        'Missing metric definition or validation rules',
        { metricId: metricDefinition?.id }
      );
    }

    const schema = await createMetricSchema(metricDefinition);
    const validationResult = schema.safeParse(value);

    if (!validationResult.success) {
      throw new ValidationError(
        'https://api.startupmetrics.com/problems/validation',
        422,
        DATA_ERRORS.DATA001,
        'Metric value validation failed',
        {
          metricId: metricDefinition.id,
          value,
          errors: validationResult.error.errors
        }
      );
    }

    return true;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(
      'https://api.startupmetrics.com/problems/validation',
      500,
      DATA_ERRORS.DATA003,
      'Validation system error',
      { originalError: error.message }
    );
  }
}

/**
 * Validates if a metric value falls within the specified range
 * @param value - The value to validate
 * @param rule - The validation rule containing range constraints
 * @returns boolean - True if value is within range
 */
export function validateMetricRange(
  value: number,
  rule: IMetricValidationRule
): boolean {
  if (value < rule.minValue) {
    throw new ValidationError(
      'https://api.startupmetrics.com/problems/validation',
      422,
      DATA_ERRORS.DATA001,
      `Value ${value} is below minimum allowed value of ${rule.minValue}`,
      { rule, value }
    );
  }

  if (value > rule.maxValue) {
    throw new ValidationError(
      'https://api.startupmetrics.com/problems/validation',
      422,
      DATA_ERRORS.DATA001,
      `Value ${value} exceeds maximum allowed value of ${rule.maxValue}`,
      { rule, value }
    );
  }

  return true;
}

/**
 * Creates and caches a Zod schema for metric validation
 * @param metricDefinition - The metric definition containing validation rules
 * @returns z.ZodSchema - The compiled validation schema
 */
export function createMetricSchema(
  metricDefinition: IMetricDefinition
): z.ZodSchema {
  const cacheKey = `schema_${metricDefinition.id}`;
  const cachedSchema = schemaCache.get<z.ZodSchema>(cacheKey);

  if (cachedSchema) {
    return cachedSchema;
  }

  let schema = z.number();

  for (const rule of metricDefinition.validationRules) {
    if (rule.type === MetricValidationType.RANGE) {
      schema = schema.min(rule.minValue, {
        message: `Value must be greater than or equal to ${rule.minValue}`
      }).max(rule.maxValue, {
        message: `Value must be less than or equal to ${rule.maxValue}`
      });
    }

    if (rule.type === MetricValidationType.CUSTOM && rule.customValidation) {
      schema = schema.refine(
        (value) => {
          try {
            // Safe evaluation of custom validation expression
            return new Function('value', `return ${rule.customValidation}`)(value);
          } catch (error) {
            return false;
          }
        },
        {
          message: rule.errorMessage
        }
      );
    }
  }

  schemaCache.set(cacheKey, schema);
  return schema;
}

/**
 * Type guard to check if an error is a ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Formats a validation error into an RFC 7807 compliant response
 */
export function formatValidationError(error: ValidationError): Record<string, unknown> {
  return {
    type: error.type,
    status: error.status,
    code: error.code,
    message: error.message,
    details: error.details,
    instance: `urn:startupmetrics:validation:${Date.now()}`
  };
}