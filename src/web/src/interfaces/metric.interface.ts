import {
  MetricType,
  MetricUnit,
  MetricTimeframe,
  MetricValidationType
} from '../types/metric.types';

/**
 * Interface defining a metric's core properties and calculation rules
 */
export interface IMetricDefinition {
  id: string;
  name: string;
  description: string;
  type: MetricType;
  unit: MetricUnit;
  timeframe: MetricTimeframe;
  formula: string;
  validationRules: IMetricValidationRule[];
}

/**
 * Interface for metric validation rules with enhanced error handling
 * and contextual validation support
 */
export interface IMetricValidationRule {
  type: MetricValidationType;
  minValue: number;
  maxValue: number;
  required: boolean;
  customValidation: ((value: number) => boolean) | null;
  errorMessage: string;
  priority: number;
  validationContext: Record<string, any>;
}

/**
 * Interface for metric calculation parameters with support for
 * comparison periods and advanced aggregation methods
 */
export interface IMetricCalculationParams {
  metricId: string;
  startDate: Date;
  endDate: Date;
  timeframe: MetricTimeframe;
  comparisonPeriod: {
    start: Date;
    end: Date;
  };
  aggregationMethod: 'sum' | 'average' | 'weighted' | 'custom';
  filterCriteria: Record<string, any>;
}

/**
 * Interface for benchmark data across different percentiles
 * and revenue ranges
 */
export interface IMetricBenchmark {
  metricId: string;
  percentiles: Record<number, number>;
  industryAverage: number;
  revenueRange: string;
  timeframe: MetricTimeframe;
}

/**
 * Interface for tracking metric trends and growth patterns
 * over time with seasonality analysis
 */
export interface IMetricTrend {
  metricId: string;
  values: Array<{ date: Date; value: number }>;
  growthRate: number;
  seasonality: Record<string, number>;
}

/**
 * Interface for complex metric aggregations and derived calculations
 * with dependency tracking and validation
 */
export interface IMetricAggregation {
  metricIds: string[];
  formula: string;
  dependencies: Record<string, string[]>;
  validationRules: IMetricValidationRule[];
}