/**
 * Metric Interfaces for the Startup Metrics Benchmarking Platform
 * Defines core interfaces for metric definitions, values, validation rules and calculations
 * @version 1.0.0
 */

import {
  MetricType,
  MetricUnit,
  MetricTimeframe,
  MetricValidationType
} from '../types/metric-types';

/**
 * Interface defining the structure of a metric definition
 * Contains core metadata, formula and validation rules for a metric
 */
export interface IMetricDefinition {
  /** Unique identifier for the metric */
  readonly id: string;
  /** Display name of the metric */
  name: string;
  /** Detailed description of what the metric measures */
  description: string;
  /** Category classification of the metric */
  type: MetricType;
  /** Unit of measurement for the metric */
  unit: MetricUnit;
  /** Time period over which the metric is calculated */
  timeframe: MetricTimeframe;
  /** Mathematical formula used to calculate the metric */
  formula: string;
  /** Array of validation rules applied to metric values */
  validationRules: IMetricValidationRule[];
  /** Timestamp of metric definition creation */
  readonly createdAt: Date;
  /** Timestamp of last metric definition update */
  readonly updatedAt: Date;
}

/**
 * Interface for storing individual metric values
 * Records a specific metric measurement for a company at a point in time
 */
export interface IMetricValue {
  /** Unique identifier for the metric value record */
  readonly id: string;
  /** Reference to the metric definition */
  readonly metricId: string;
  /** Reference to the company the metric belongs to */
  readonly companyId: string;
  /** Numerical value of the metric measurement */
  value: number;
  /** Time period this measurement represents */
  timeframe: MetricTimeframe;
  /** Timestamp when the metric value was recorded */
  readonly recordedAt: Date;
}

/**
 * Interface defining validation rules for metric values
 * Supports both range-based and custom validation logic
 */
export interface IMetricValidationRule {
  /** Type of validation to be applied */
  type: MetricValidationType;
  /** Minimum allowed value for range validation */
  minValue: number;
  /** Maximum allowed value for range validation */
  maxValue: number;
  /** Human-readable description of the validation rule */
  description: string;
  /** Optional custom validation logic as a string expression */
  customValidation?: string;
  /** Error message to display when validation fails */
  errorMessage: string;
}

/**
 * Interface for metric calculation parameters
 * Used to specify the context for metric calculations
 */
export interface IMetricCalculationParams {
  /** Reference to the metric being calculated */
  readonly metricId: string;
  /** Reference to the company for which calculation is performed */
  readonly companyId: string;
  /** Start date of the calculation period */
  startDate: Date;
  /** End date of the calculation period */
  endDate: Date;
  /** Time period granularity for the calculation */
  timeframe: MetricTimeframe;
}