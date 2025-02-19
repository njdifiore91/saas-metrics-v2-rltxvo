/**
 * Enum defining categories of startup metrics
 */
export enum MetricType {
  RETENTION = 'RETENTION',     // Metrics related to customer retention
  EFFICIENCY = 'EFFICIENCY',   // Metrics measuring operational efficiency
  SALES = 'SALES',            // Sales and revenue related metrics
  FINANCIAL = 'FINANCIAL'      // Financial performance metrics
}

/**
 * Enum defining units of measurement for metrics
 */
export enum MetricUnit {
  PERCENTAGE = 'PERCENTAGE',   // Values measured as percentages (0-100%)
  CURRENCY = 'CURRENCY',      // Monetary values
  RATIO = 'RATIO',           // Ratio/multiplier values
  MONTHS = 'MONTHS'          // Time duration in months
}

/**
 * Enum defining time periods for metric calculations
 */
export enum MetricTimeframe {
  MONTHLY = 'MONTHLY',       // Monthly calculations
  QUARTERLY = 'QUARTERLY',   // Quarterly calculations
  ANNUAL = 'ANNUAL'         // Annual calculations
}

/**
 * Enum defining types of metric validation rules
 */
export enum MetricValidationType {
  RANGE = 'RANGE',          // Value must fall within min-max range
  MIN = 'MIN',             // Value must be above minimum
  MAX = 'MAX',             // Value must be below maximum
  CUSTOM = 'CUSTOM'        // Custom validation function
}

/**
 * Type for metric value records with unit and timestamp
 */
export type MetricValue = {
  value: number;            // Numeric value of the metric
  unit: MetricUnit;         // Unit of measurement
  timestamp: Date;          // When the metric value was recorded
}

/**
 * Type for metric validation rules including range and custom validations
 */
export type MetricValidationRule = {
  type: MetricValidationType;                    // Type of validation to apply
  min: number | null;                           // Minimum allowed value (if applicable)
  max: number | null;                           // Maximum allowed value (if applicable)
  customValidator: ((value: number) => boolean) | null;  // Custom validation function (if applicable)
}

/**
 * Type for metric calculation parameters including date ranges
 */
export type MetricCalculationParams = {
  startDate: Date;          // Start date for metric calculation
  endDate: Date;            // End date for metric calculation
  timeframe: MetricTimeframe; // Time period for calculation
}