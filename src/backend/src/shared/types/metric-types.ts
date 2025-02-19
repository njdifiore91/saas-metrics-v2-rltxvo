/**
 * Core TypeScript type definitions for the Startup Metrics Benchmarking Platform
 * Defines enums and types for metric categorization, units, timeframes and validation
 * @version 1.0.0
 */

/**
 * Categories of startup metrics for organization and filtering
 */
export enum MetricType {
  /** Metrics related to customer retention and churn */
  RETENTION = 'RETENTION',
  /** Metrics measuring operational efficiency */
  EFFICIENCY = 'EFFICIENCY',
  /** Metrics tracking sales performance and pipeline */
  SALES = 'SALES',
  /** Metrics indicating financial health and performance */
  FINANCIAL = 'FINANCIAL'
}

/**
 * Units of measurement for different types of metrics
 */
export enum MetricUnit {
  /** Percentage-based metrics (0-100% or custom range) */
  PERCENTAGE = 'PERCENTAGE',
  /** Monetary value metrics in standard currency */
  CURRENCY = 'CURRENCY',
  /** Ratio-based metrics like Magic Number */
  RATIO = 'RATIO',
  /** Time-based metrics measured in months */
  MONTHS = 'MONTHS'
}

/**
 * Calculation periods for metric computations
 */
export enum MetricTimeframe {
  /** Monthly calculation period */
  MONTHLY = 'MONTHLY',
  /** Quarterly calculation period */
  QUARTERLY = 'QUARTERLY',
  /** Annual calculation period */
  ANNUAL = 'ANNUAL'
}

/**
 * Types of validation rules for metric values
 */
export enum MetricValidationType {
  /** Numeric range validation with min/max bounds */
  RANGE = 'RANGE',
  /** Custom validation rules for complex metrics */
  CUSTOM = 'CUSTOM'
}

/**
 * Type for representing metric values with their corresponding units
 */
export type MetricValue = {
  /** Numeric value of the metric */
  value: number;
  /** Unit of measurement for the value */
  unit: MetricUnit;
};

/**
 * Type for defining valid ranges for metric values with validation boundaries
 */
export type MetricRange = {
  /** Minimum allowed value */
  min: number;
  /** Maximum allowed value */
  max: number;
  /** Unit of measurement for the range */
  unit: MetricUnit;
};

/**
 * Standard validation ranges for common metrics
 * Based on industry standards defined in technical specifications
 */
export const METRIC_VALIDATION_RANGES: Record<string, MetricRange> = {
  NET_DOLLAR_RETENTION: {
    min: 0,
    max: 200,
    unit: MetricUnit.PERCENTAGE
  },
  CAC_PAYBACK: {
    min: 0,
    max: 60,
    unit: MetricUnit.MONTHS
  },
  MAGIC_NUMBER: {
    min: 0,
    max: 10,
    unit: MetricUnit.RATIO
  },
  PIPELINE_COVERAGE: {
    min: 0,
    max: 1000,
    unit: MetricUnit.PERCENTAGE
  },
  GROSS_MARGINS: {
    min: -100,
    max: 100,
    unit: MetricUnit.PERCENTAGE
  }
};