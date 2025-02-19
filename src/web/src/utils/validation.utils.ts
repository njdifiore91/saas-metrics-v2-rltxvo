import { IMetricDefinition, IMetricValidationRule } from '../interfaces/metric.interface';
import { MetricValidationType, MetricUnit } from '../types/metric.types';
import { METRIC_VALIDATION_RULES, VALIDATION_ERROR_MESSAGES } from '../constants/validation.constants';

// Cache for validation results to improve performance
const validationCache = new Map<string, ValidationResult>();

interface ValidationResult {
  isValid: boolean;
  errors: Array<{
    code: string;
    message: string;
    params?: Record<string, any>;
  }>;
}

interface IValidationContext {
  timeframe?: string;
  revenueRange?: string;
  comparisonPeriod?: {
    start: Date;
    end: Date;
  };
  [key: string]: any;
}

type ValueType = 'percentage' | 'currency' | 'ratio' | 'months';

/**
 * Enhanced metric value validator with support for validation context, rule priorities, and caching
 * @param value - Numeric value to validate
 * @param metricDefinition - Metric definition containing validation rules
 * @param context - Optional validation context for complex validations
 * @returns ValidationResult with detailed error information
 */
export const validateMetricValue = (
  value: number,
  metricDefinition: IMetricDefinition,
  context?: IValidationContext
): ValidationResult => {
  // Generate cache key based on inputs
  const cacheKey = `${metricDefinition.id}_${value}_${JSON.stringify(context)}`;
  
  // Check cache first
  const cachedResult = validationCache.get(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  const result: ValidationResult = {
    isValid: true,
    errors: []
  };

  // Sort validation rules by priority
  const sortedRules = [...metricDefinition.validationRules]
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));

  // Check if value is required and present
  const requiredRule = sortedRules.find(rule => rule.required);
  if (requiredRule && (value === null || value === undefined)) {
    result.isValid = false;
    result.errors.push({
      code: 'REQUIRED_FIELD',
      message: VALIDATION_ERROR_MESSAGES.REQUIRED_FIELD
    });
    validationCache.set(cacheKey, result);
    return result;
  }

  // Apply validation rules in priority order
  for (const rule of sortedRules) {
    switch (rule.type) {
      case MetricValidationType.RANGE:
        const rangeResult = validateRangeRule(value, rule.minValue, rule.maxValue);
        if (!rangeResult.isValid) {
          result.isValid = false;
          result.errors.push({
            code: 'INVALID_RANGE',
            message: formatValidationError('INVALID_RANGE', {
              min: rule.minValue,
              max: rule.maxValue
            }),
            params: { min: rule.minValue, max: rule.maxValue }
          });
        }
        break;

      case MetricValidationType.CUSTOM:
        if (rule.customValidation && !rule.customValidation(value, context)) {
          result.isValid = false;
          result.errors.push({
            code: 'CUSTOM_VALIDATION_FAILED',
            message: VALIDATION_ERROR_MESSAGES.CUSTOM_VALIDATION_FAILED
          });
        }
        break;
    }

    // Stop processing if validation fails and rule is critical
    if (!result.isValid && rule.priority > 0) {
      break;
    }
  }

  // Cache the validation result
  validationCache.set(cacheKey, result);
  return result;
};

/**
 * Enhanced range validation with support for percentage and currency values
 * @param value - Value to validate
 * @param minValue - Minimum allowed value
 * @param maxValue - Maximum allowed value
 * @param valueType - Optional type of value for specialized validation
 * @returns ValidationResult for the range check
 */
export const validateRangeRule = (
  value: number,
  minValue: number,
  maxValue: number,
  valueType?: ValueType
): ValidationResult => {
  const result: ValidationResult = {
    isValid: true,
    errors: []
  };

  // Handle NaN and invalid numbers
  if (isNaN(value) || !isFinite(value)) {
    result.isValid = false;
    result.errors.push({
      code: 'INVALID_FORMAT',
      message: VALIDATION_ERROR_MESSAGES.INVALID_FORMAT
    });
    return result;
  }

  // Normalize value based on type
  let normalizedValue = value;
  if (valueType === 'percentage') {
    normalizedValue = value * 100;
  }

  // Perform range validation
  if (normalizedValue < minValue || normalizedValue > maxValue) {
    result.isValid = false;
    result.errors.push({
      code: 'INVALID_RANGE',
      message: formatValidationError('INVALID_RANGE', {
        min: minValue,
        max: maxValue,
        type: valueType
      }),
      params: { min: minValue, max: maxValue, type: valueType }
    });
  }

  return result;
};

/**
 * Advanced error message formatter with i18n support
 * @param errorKey - Key of the error message template
 * @param params - Parameters to inject into the message
 * @param locale - Optional locale for message formatting
 * @returns Formatted error message
 */
export const formatValidationError = (
  errorKey: keyof typeof VALIDATION_ERROR_MESSAGES,
  params: Record<string, any>,
  locale: string = 'en-US'
): string => {
  let message = VALIDATION_ERROR_MESSAGES[errorKey];

  // Replace placeholders with parameter values
  Object.entries(params).forEach(([key, value]) => {
    const placeholder = `\${${key}}`;
    if (typeof value === 'number') {
      // Format numbers based on locale and type
      const formatter = new Intl.NumberFormat(locale, {
        style: params.type === 'currency' ? 'currency' : 'decimal',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      });
      message = message.replace(placeholder, formatter.format(value));
    } else {
      message = message.replace(placeholder, String(value));
    }
  });

  return message;
};

// Clear validation cache periodically to prevent memory leaks
setInterval(() => {
  validationCache.clear();
}, 300000); // Clear every 5 minutes