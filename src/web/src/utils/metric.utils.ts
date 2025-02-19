import { format } from 'date-fns';
import { 
  IMetricDefinition, 
  IMetricValidationRule 
} from '../interfaces/metric.interface';
import { 
  MetricType, 
  MetricUnit, 
  MetricTimeframe 
} from '../types/metric.types';
import { 
  METRIC_VALIDATION_RULES, 
  METRIC_DISPLAY_OPTIONS,
  METRIC_CALCULATION_DEFAULTS 
} from '../constants/metric.constants';

/**
 * Interface for metric calculation result
 */
interface IMetricResult {
  value: number;
  isValid: boolean;
  formattedValue: string;
  messages: string[];
}

/**
 * Interface for validation result
 */
interface IValidationResult {
  isValid: boolean;
  messages: string[];
  warnings: string[];
}

/**
 * Calculates Net Dollar Retention (NDR) with comprehensive validation
 * @param startingARR - Starting Annual Recurring Revenue
 * @param expansions - Revenue from expansions
 * @param contractions - Revenue lost from contractions
 * @param churn - Revenue lost from churned customers
 * @param timeframe - Calculation timeframe (default: ANNUAL)
 * @returns IMetricResult containing calculated NDR with validation status
 */
export const calculateNDR = (
  startingARR: number,
  expansions: number,
  contractions: number,
  churn: number,
  timeframe: MetricTimeframe = MetricTimeframe.ANNUAL
): IMetricResult => {
  const messages: string[] = [];

  // Input validation
  if (startingARR <= 0) {
    messages.push('Starting ARR must be greater than 0');
  }
  if (expansions < 0 || contractions < 0 || churn < 0) {
    messages.push('Expansions, contractions, and churn must be non-negative');
  }

  // Normalize values based on timeframe
  const timeframeMultiplier = timeframe === MetricTimeframe.MONTHLY ? 12 : 
                             timeframe === MetricTimeframe.QUARTERLY ? 4 : 1;
  
  // Calculate NDR with precision handling
  const ndrValue = startingARR > 0 ? 
    ((startingARR + expansions - contractions - churn) / startingARR) * 100 : 0;

  // Validate result against rules
  const { min, max } = METRIC_VALIDATION_RULES.NDR;
  const isValid = ndrValue >= min && ndrValue <= max && messages.length === 0;

  // Format result
  const formattedValue = formatMetricValue(
    ndrValue,
    MetricType.RETENTION,
    MetricUnit.PERCENTAGE
  );

  return {
    value: ndrValue,
    isValid,
    formattedValue,
    messages
  };
};

/**
 * Calculates CAC Payback Period with currency support
 * @param cac - Customer Acquisition Cost
 * @param arr - Annual Recurring Revenue
 * @param grossMargin - Gross Margin percentage
 * @param timeframe - Calculation timeframe (default: MONTHLY)
 * @returns IMetricResult containing calculated payback period
 */
export const calculateCACPayback = (
  cac: number,
  arr: number,
  grossMargin: number,
  timeframe: MetricTimeframe = MetricTimeframe.MONTHLY
): IMetricResult => {
  const messages: string[] = [];

  // Input validation
  if (cac <= 0 || arr <= 0) {
    messages.push('CAC and ARR must be greater than 0');
  }
  if (grossMargin <= 0 || grossMargin > 100) {
    messages.push('Gross margin must be between 0 and 100');
  }

  // Calculate payback period
  const monthlyRevenue = arr / 12;
  const monthlyGrossMargin = monthlyRevenue * (grossMargin / 100);
  const paybackPeriod = monthlyGrossMargin > 0 ? cac / monthlyGrossMargin : 0;

  // Validate against rules
  const { min, max } = METRIC_VALIDATION_RULES.CAC_PAYBACK;
  const isValid = paybackPeriod >= min && paybackPeriod <= max && messages.length === 0;

  // Format result
  const formattedValue = formatMetricValue(
    paybackPeriod,
    MetricType.EFFICIENCY,
    MetricUnit.MONTHS
  );

  return {
    value: paybackPeriod,
    isValid,
    formattedValue,
    messages
  };
};

/**
 * Validates metric value against defined rules
 * @param value - Numeric value to validate
 * @param rules - Array of validation rules
 * @param type - Type of metric
 * @returns IValidationResult with validation status and messages
 */
export const validateMetricValue = (
  value: number,
  rules: IMetricValidationRule[],
  type: MetricType
): IValidationResult => {
  const messages: string[] = [];
  const warnings: string[] = [];

  // Apply validation rules in priority order
  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

  for (const rule of sortedRules) {
    // Required value check
    if (rule.required && (value === null || value === undefined)) {
      messages.push('Value is required');
      continue;
    }

    // Range validation
    if (rule.minValue !== undefined && value < rule.minValue) {
      messages.push(`Value must be greater than ${rule.minValue}`);
    }
    if (rule.maxValue !== undefined && value > rule.maxValue) {
      messages.push(`Value must be less than ${rule.maxValue}`);
    }

    // Custom validation
    if (rule.customValidation && !rule.customValidation(value)) {
      messages.push(rule.errorMessage);
    }
  }

  // Check warning thresholds
  const metricRules = METRIC_VALIDATION_RULES[type];
  if (metricRules?.warningThreshold) {
    const { low, high } = metricRules.warningThreshold;
    if (value < low) {
      warnings.push(`Value is below recommended minimum of ${low}`);
    }
    if (value > high) {
      warnings.push(`Value is above recommended maximum of ${high}`);
    }
  }

  return {
    isValid: messages.length === 0,
    messages,
    warnings
  };
};

/**
 * Formats metric value with appropriate unit and localization
 * @param value - Numeric value to format
 * @param type - Type of metric
 * @param unit - Unit of measurement
 * @returns Formatted string representation of the value
 */
export const formatMetricValue = (
  value: number,
  type: MetricType,
  unit: MetricUnit
): string => {
  const formatOptions = METRIC_DISPLAY_OPTIONS.formatOptions[unit];
  
  if (!formatOptions) {
    return value.toString();
  }

  try {
    // Apply unit-specific formatting
    switch (unit) {
      case MetricUnit.PERCENTAGE:
        return new Intl.NumberFormat('en-US', {
          ...formatOptions,
          style: 'percent'
        }).format(value / 100);

      case MetricUnit.CURRENCY:
        return new Intl.NumberFormat('en-US', {
          ...formatOptions,
          style: 'currency',
          currency: 'USD'
        }).format(value);

      case MetricUnit.RATIO:
        return new Intl.NumberFormat('en-US', {
          ...formatOptions
        }).format(value);

      case MetricUnit.MONTHS:
        return `${new Intl.NumberFormat('en-US', {
          ...formatOptions
        }).format(value)}${formatOptions.suffix}`;

      default:
        return value.toString();
    }
  } catch (error) {
    console.error('Error formatting metric value:', error);
    return value.toString();
  }
};

/**
 * Normalizes metric value based on timeframe
 * @param value - Value to normalize
 * @param currentTimeframe - Current timeframe
 * @param targetTimeframe - Target timeframe
 * @returns Normalized value
 */
export const normalizeTimeframe = (
  value: number,
  currentTimeframe: MetricTimeframe,
  targetTimeframe: MetricTimeframe
): number => {
  const timeframeMultipliers = {
    [MetricTimeframe.MONTHLY]: 1,
    [MetricTimeframe.QUARTERLY]: 3,
    [MetricTimeframe.ANNUAL]: 12
  };

  const currentMultiplier = timeframeMultipliers[currentTimeframe];
  const targetMultiplier = timeframeMultipliers[targetTimeframe];

  return (value * targetMultiplier) / currentMultiplier;
};