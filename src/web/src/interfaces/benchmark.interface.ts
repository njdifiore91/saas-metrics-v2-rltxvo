import { MetricType } from '../types/metric.types';
import { IMetricDefinition } from './metric.interface';

/**
 * Interface defining revenue range boundaries for benchmark categorization
 * Used for segmenting companies and their metrics into comparable groups
 */
export interface IBenchmarkRevenueRange {
  id: string;
  name: string;
  minRevenue: number;
  maxRevenue: number;
}

/**
 * Interface defining comprehensive benchmark data structure
 * Includes percentile values and metadata for industry comparisons
 */
export interface IBenchmarkData {
  id: string;
  metricId: string;
  revenueRangeId: string;
  p10Value: number;  // 10th percentile value
  p25Value: number;  // 25th percentile value
  p50Value: number;  // Median value
  p75Value: number;  // 75th percentile value
  p90Value: number;  // 90th percentile value
  source: string;    // Data source identifier
  collectedAt: Date; // Timestamp of data collection
}

/**
 * Interface for comparing company metrics against benchmark data
 * Provides complete context for metric comparison including percentile positioning
 */
export interface IBenchmarkComparison {
  metric: IMetricDefinition;
  benchmarkData: IBenchmarkData;
  companyValue: number;
  percentile: number;
  revenueRange: IBenchmarkRevenueRange;
}

/**
 * Interface for structured benchmark visualization data
 * Used for rendering charts and dashboards with benchmark comparisons
 */
export interface IBenchmarkChartData {
  metricName: string;
  percentileValues: {
    [key: string]: number;  // Maps percentile labels to values (e.g., "p10", "p25", etc.)
  };
  companyValue: number;
  companyPercentile: number;
}