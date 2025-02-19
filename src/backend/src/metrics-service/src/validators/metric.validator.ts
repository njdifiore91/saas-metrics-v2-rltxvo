import { z } from 'zod'; // v3.22.0
import { ValidationError } from 'class-validator'; // v0.14.0
import { CacheManager } from 'cache-manager'; // v5.2.0
import { IMetricDefinition, IMetricValue, IMetricValidationRule } from '../../../shared/interfaces/metric.interface';
import { MetricType, MetricUnit, METRIC_VALIDATION_RANGES } from '../../../shared/types/metric-types';

// Cache TTL for validation schemas (15 minutes)
const SCHEMA_CACHE_TTL = 900;

// Initialize cache manager
const schemaCache = new CacheManager({
  ttl: SCHEMA_CACHE_TTL,
  max: 100
});

/**
 * RFC 7807 compliant error response interface
 */
interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  validationContext?: Record<string, any>;
}

/**
 * Validation result interface
 */
interface ValidationResult {
  isValid: boolean;
  errors?: ProblemDetails[];
  context?: Record<string, any>;
}

/**
 * Creates and caches a type-safe Zod validation schema for metric definitions
 * @param metricDefinition The metric definition containing validation rules
 * @returns Compiled Zod schema for the metric
 */
export const createMetricValidationSchema = async (
  metricDefinition: IMetricDefinition
): Promise<z.ZodSchema> => {
  const cacheKey = `schema_${metricDefinition.id}`;
  
  // Check cache first
  const cachedSchema = await schemaCache.get(cacheKey);
  if (cachedSchema) {
    return cachedSchema as z.ZodSchema;
  }

  // Base schema with required fields
  let schema = z.object({
    id: z.string().uuid(),
    metricId: z.string().uuid(),
    companyId: z.string().uuid(),
    value: z.number(),
    recordedAt: z.date()
  });

  // Add validation rules based on metric type
  metricDefinition.validationRules.forEach((rule: IMetricValidationRule) => {
    schema = schema.extend({
      value: z.number()
        .min(rule.minValue, rule.errorMessage)
        .max(rule.maxValue, rule.errorMessage)
    });

    // Add custom validation if specified
    if (rule.customValidation) {
      schema = schema.refine(
        (data) => {
          // Safely evaluate custom validation expression
          try {
            return new Function('value', `return ${rule.customValidation}`)(data.value);
          } catch (error) {
            return false;
          }
        },
        {
          message: rule.errorMessage
        }
      );
    }
  });

  // Add domain-specific validation
  switch (metricDefinition.type) {
    case MetricType.RETENTION:
      schema = schema.refine(
        (data) => data.value >= 0 && data.value <= 200,
        {
          message: "Retention metrics must be between 0% and 200%"
        }
      );
      break;
    case MetricType.FINANCIAL:
      // Apply standard ranges from METRIC_VALIDATION_RANGES if available
      const ranges = METRIC_VALIDATION_RANGES[metricDefinition.id];
      if (ranges) {
        schema = schema.refine(
          (data) => data.value >= ranges.min && data.value <= ranges.max,
          {
            message: `Value must be between ${ranges.min} and ${ranges.max} ${ranges.unit}`
          }
        );
      }
      break;
  }

  // Cache the compiled schema
  await schemaCache.set(cacheKey, schema);
  
  return schema;
};

/**
 * Validates metric input data against cached schema and business rules
 * @param metricValue The metric value to validate
 * @param metricDefinition The corresponding metric definition
 * @returns Validation result with detailed context or RFC 7807 error
 */
export const validateMetricInput = async (
  metricValue: IMetricValue,
  metricDefinition: IMetricDefinition
): Promise<ValidationResult> => {
  try {
    // Get or create validation schema
    const schema = await createMetricValidationSchema(metricDefinition);
    
    // Validate against schema
    const validationResult = await schema.safeParseAsync(metricValue);
    
    if (!validationResult.success) {
      const errors: ProblemDetails[] = validationResult.error.errors.map(error => ({
        type: 'https://api.startupmetrics.com/errors/validation',
        title: 'Metric Validation Error',
        status: 400,
        detail: error.message,
        instance: `/metrics/${metricValue.id}`,
        validationContext: {
          field: error.path.join('.'),
          code: error.code,
          received: error.received
        }
      }));

      return {
        isValid: false,
        errors,
        context: {
          metricId: metricDefinition.id,
          metricType: metricDefinition.type,
          validatedAt: new Date().toISOString()
        }
      };
    }

    // Additional business logic validation
    const businessValidation = validateBusinessRules(metricValue, metricDefinition);
    if (!businessValidation.isValid) {
      return businessValidation;
    }

    return {
      isValid: true,
      context: {
        metricId: metricDefinition.id,
        metricType: metricDefinition.type,
        validatedAt: new Date().toISOString()
      }
    };

  } catch (error) {
    throw new ValidationError({
      type: 'https://api.startupmetrics.com/errors/internal',
      title: 'Validation System Error',
      status: 500,
      detail: 'An internal error occurred during metric validation',
      instance: `/metrics/${metricValue.id}`
    });
  }
};

/**
 * Validates additional business rules for metrics
 * @param metricValue The metric value to validate
 * @param metricDefinition The corresponding metric definition
 * @returns Validation result with business rule context
 */
const validateBusinessRules = (
  metricValue: IMetricValue,
  metricDefinition: IMetricDefinition
): ValidationResult => {
  const errors: ProblemDetails[] = [];

  // Time-based validations
  if (metricValue.recordedAt > new Date()) {
    errors.push({
      type: 'https://api.startupmetrics.com/errors/validation',
      title: 'Invalid Metric Timestamp',
      status: 400,
      detail: 'Metric timestamp cannot be in the future',
      instance: `/metrics/${metricValue.id}`
    });
  }

  // Domain-specific business rules
  if (metricDefinition.type === MetricType.FINANCIAL) {
    // Additional financial metric validations
    if (metricValue.value < 0 && !metricDefinition.validationRules.some(rule => rule.minValue < 0)) {
      errors.push({
        type: 'https://api.startupmetrics.com/errors/validation',
        title: 'Invalid Financial Metric',
        status: 400,
        detail: 'Financial metric cannot be negative unless explicitly allowed',
        instance: `/metrics/${metricValue.id}`
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    context: {
      metricId: metricDefinition.id,
      metricType: metricDefinition.type,
      businessRulesValidatedAt: new Date().toISOString()
    }
  };
};