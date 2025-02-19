import { MetricType, MetricValidationType } from '../types/metric.types';

/**
 * Interface for metric validation rules with comprehensive type checking
 */
interface IMetricValidationRule {
  type: MetricValidationType;
  min?: number;
  max?: number;
  errorMessage: string;
  metricType: MetricType;
  customValidator?: (value: number) => boolean;
}

/**
 * Immutable validation rules for startup metrics
 * Based on industry standard ranges and technical specifications
 */
export const METRIC_VALIDATION_RULES: Record<string, IMetricValidationRule[]> = {
  // Net Dollar Retention (NDR)
  // Range: 0-200% per technical specifications
  NDR: [
    {
      type: MetricValidationType.RANGE,
      min: 0,
      max: 200,
      errorMessage: 'NDR must be between 0% and 200%',
      metricType: MetricType.RETENTION
    }
  ],

  // CAC Payback Period
  // Range: 0-60 months per technical specifications
  CAC_PAYBACK: [
    {
      type: MetricValidationType.RANGE,
      min: 0,
      max: 60,
      errorMessage: 'CAC Payback Period must be between 0 and 60 months',
      metricType: MetricType.EFFICIENCY
    }
  ],

  // Magic Number
  // Range: 0-10 per technical specifications
  MAGIC_NUMBER: [
    {
      type: MetricValidationType.RANGE,
      min: 0,
      max: 10,
      errorMessage: 'Magic Number must be between 0 and 10',
      metricType: MetricType.SALES
    }
  ],

  // Pipeline Coverage
  // Range: 0-1000% per technical specifications
  PIPELINE_COVERAGE: [
    {
      type: MetricValidationType.RANGE,
      min: 0,
      max: 1000,
      errorMessage: 'Pipeline Coverage must be between 0% and 1000%',
      metricType: MetricType.SALES
    }
  ],

  // Gross Margins
  // Range: -100% to 100% per technical specifications
  GROSS_MARGINS: [
    {
      type: MetricValidationType.RANGE,
      min: -100,
      max: 100,
      errorMessage: 'Gross Margins must be between -100% and 100%',
      metricType: MetricType.FINANCIAL
    }
  ],

  // Annual Recurring Revenue (ARR)
  ARR: [
    {
      type: MetricValidationType.MIN,
      min: 0,
      errorMessage: 'ARR cannot be negative',
      metricType: MetricType.FINANCIAL
    }
  ],

  // Growth Rate
  GROWTH_RATE: [
    {
      type: MetricValidationType.MIN,
      min: -100,
      errorMessage: 'Growth Rate cannot be less than -100%',
      metricType: MetricType.FINANCIAL
    }
  ],

  // Customer Acquisition Cost (CAC)
  CAC: [
    {
      type: MetricValidationType.MIN,
      min: 0,
      errorMessage: 'CAC cannot be negative',
      metricType: MetricType.EFFICIENCY
    }
  ],

  // Logo Retention
  LOGO_RETENTION: [
    {
      type: MetricValidationType.RANGE,
      min: 0,
      max: 100,
      errorMessage: 'Logo Retention must be between 0% and 100%',
      metricType: MetricType.RETENTION
    }
  ]
};

/**
 * Standardized validation error messages with placeholder support
 * Used across the application for consistent error handling
 */
export const VALIDATION_ERROR_MESSAGES = {
  REQUIRED_FIELD: 'This field is required',
  INVALID_RANGE: 'Value must be between ${min} and ${max}',
  MIN_VALUE: 'Value must be greater than ${min}',
  MAX_VALUE: 'Value must be less than ${max}',
  INVALID_FORMAT: 'Invalid format. Please enter a valid number',
  NEGATIVE_VALUE: 'Value cannot be negative',
  PERCENTAGE_RANGE: 'Percentage must be between 0 and 100',
  CUSTOM_VALIDATION_FAILED: 'Value does not meet validation requirements'
} as const;

/**
 * Helper function to validate a metric value against its rules
 * @param metricKey - Key of the metric to validate
 * @param value - Value to validate
 * @returns ValidationResult containing isValid and error message
 */
export const validateMetricValue = (
  metricKey: keyof typeof METRIC_VALIDATION_RULES,
  value: number
): { isValid: boolean; errorMessage?: string } => {
  const rules = METRIC_VALIDATION_RULES[metricKey];
  
  if (!rules) {
    return { isValid: false, errorMessage: 'No validation rules found for metric' };
  }

  for (const rule of rules) {
    switch (rule.type) {
      case MetricValidationType.RANGE:
        if (rule.min !== undefined && rule.max !== undefined) {
          if (value < rule.min || value > rule.max) {
            return { isValid: false, errorMessage: rule.errorMessage };
          }
        }
        break;
      
      case MetricValidationType.MIN:
        if (rule.min !== undefined && value < rule.min) {
          return { isValid: false, errorMessage: rule.errorMessage };
        }
        break;
      
      case MetricValidationType.MAX:
        if (rule.max !== undefined && value > rule.max) {
          return { isValid: false, errorMessage: rule.errorMessage };
        }
        break;
      
      case MetricValidationType.CUSTOM:
        if (rule.customValidator && !rule.customValidator(value)) {
          return { isValid: false, errorMessage: rule.errorMessage };
        }
        break;
    }
  }

  return { isValid: true };
};