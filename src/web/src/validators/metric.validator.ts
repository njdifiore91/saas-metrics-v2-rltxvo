import { 
  IMetricDefinition, 
  IMetricValidationRule 
} from '../interfaces/metric.interface';
import { MetricValidationType } from '../types/metric.types';
import { 
  METRIC_VALIDATION_RULES, 
  VALIDATION_ERROR_MESSAGES 
} from '../constants/validation.constants';

/**
 * Interface for validation context containing dependent metric values
 */
interface IValidationContext {
  dependentMetrics?: Record<string, number>;
  timeframe?: string;
  revenueRange?: string;
}

/**
 * Interface for validation result with detailed feedback
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  context: IValidationContext;
}

/**
 * Validates a metric value against defined validation rules with context awareness
 * @param value - The metric value to validate
 * @param metricDefinition - The metric definition containing validation rules
 * @param context - Optional validation context for dependent metrics
 * @returns ValidationResult containing validation status and messages
 */
export const validateMetricValue = (
  value: number,
  metricDefinition: IMetricDefinition,
  context?: IValidationContext
): ValidationResult => {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    context: context || {}
  };

  // Check if value is provided
  if (value === undefined || value === null) {
    result.isValid = false;
    result.errors.push(VALIDATION_ERROR_MESSAGES.REQUIRED_FIELD);
    return result;
  }

  // Sort validation rules by priority
  const sortedRules = [...metricDefinition.validationRules]
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));

  // Apply validation rules in priority order
  for (const rule of sortedRules) {
    const ruleResult = validateWithContext(value, rule, result.context);
    
    if (!ruleResult.isValid) {
      result.isValid = false;
      result.errors.push(...ruleResult.errors);
      result.warnings.push(...ruleResult.warnings);
      result.context = { ...result.context, ...ruleResult.context };
    }
  }

  // Add warnings for edge cases
  if (result.isValid) {
    addWarningsForEdgeCases(value, metricDefinition, result);
  }

  return result;
};

/**
 * Performs context-aware validation for a single rule
 * @param value - The value to validate
 * @param rule - The validation rule to apply
 * @param context - Current validation context
 * @returns ValidationResult for the specific rule
 */
const validateWithContext = (
  value: number,
  rule: IMetricValidationRule,
  context: IValidationContext
): ValidationResult => {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    context
  };

  switch (rule.type) {
    case MetricValidationType.RANGE:
      if (value < rule.minValue || value > rule.maxValue) {
        result.isValid = false;
        result.errors.push(formatValidationMessage(
          VALIDATION_ERROR_MESSAGES.INVALID_RANGE,
          { min: rule.minValue, max: rule.maxValue }
        ));
      }
      break;

    case MetricValidationType.MIN:
      if (value < rule.minValue) {
        result.isValid = false;
        result.errors.push(formatValidationMessage(
          VALIDATION_ERROR_MESSAGES.MIN_VALUE,
          { min: rule.minValue }
        ));
      }
      break;

    case MetricValidationType.MAX:
      if (value > rule.maxValue) {
        result.isValid = false;
        result.errors.push(formatValidationMessage(
          VALIDATION_ERROR_MESSAGES.MAX_VALUE,
          { max: rule.maxValue }
        ));
      }
      break;

    case MetricValidationType.CUSTOM:
      if (rule.customValidation && !rule.customValidation(value, context)) {
        result.isValid = false;
        result.errors.push(VALIDATION_ERROR_MESSAGES.CUSTOM_VALIDATION_FAILED);
      }
      break;
  }

  return result;
};

/**
 * Formats validation messages with dynamic values
 * @param messageTemplate - The message template with placeholders
 * @param params - Parameters to inject into the message
 * @returns Formatted message string
 */
const formatValidationMessage = (
  messageTemplate: string,
  params: Record<string, any>
): string => {
  let message = messageTemplate;
  for (const [key, value] of Object.entries(params)) {
    message = message.replace(`\${${key}}`, value.toString());
  }
  return message;
};

/**
 * Adds warnings for edge case scenarios
 * @param value - The metric value
 * @param metricDefinition - The metric definition
 * @param result - The current validation result
 */
const addWarningsForEdgeCases = (
  value: number,
  metricDefinition: IMetricDefinition,
  result: ValidationResult
): void => {
  // Check for extreme values within valid range
  const rules = METRIC_VALIDATION_RULES[metricDefinition.id];
  if (rules) {
    for (const rule of rules) {
      if (rule.type === MetricValidationType.RANGE) {
        const range = rule.max - rule.min;
        const warningThreshold = range * 0.1; // 10% from bounds

        if (value <= rule.min + warningThreshold) {
          result.warnings.push(`Value is close to minimum threshold of ${rule.min}`);
        } else if (value >= rule.max - warningThreshold) {
          result.warnings.push(`Value is close to maximum threshold of ${rule.max}`);
        }
      }
    }
  }

  // Add metric-specific warnings
  switch (metricDefinition.id) {
    case 'NDR':
      if (value < 100) {
        result.warnings.push('NDR below 100% indicates customer contraction');
      }
      break;
    case 'CAC_PAYBACK':
      if (value > 12) {
        result.warnings.push('CAC Payback period exceeds 12 months');
      }
      break;
    case 'GROSS_MARGINS':
      if (value < 0) {
        result.warnings.push('Negative gross margins indicate unprofitable operations');
      }
      break;
  }
};