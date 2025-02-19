/**
 * Benchmark interfaces for the Startup Metrics Benchmarking Platform
 * Defines core data structures for benchmark definitions, data points, and comparisons
 * @version 1.0.0
 */

import { MetricType, MetricTimeframe } from '../types/metric-types';

/**
 * Interface defining benchmark revenue ranges for categorization
 */
export interface IBenchmarkRevenueRange {
  /** Unique identifier for the revenue range */
  id: string;
  /** Minimum revenue threshold in USD */
  minRevenue: number;
  /** Maximum revenue threshold in USD */
  maxRevenue: number;
  /** Human-readable label for the range (e.g., "$1M-$5M") */
  label: string;
  /** Flag indicating if this range is currently active */
  active: boolean;
}

/**
 * Interface for core benchmark definitions including metadata
 */
export interface IBenchmarkDefinition {
  /** Unique identifier for the benchmark */
  id: string;
  /** Category of metric being benchmarked */
  metricType: MetricType;
  /** Associated revenue range for this benchmark */
  revenueRange: IBenchmarkRevenueRange;
  /** Time period for the benchmark data */
  timeframe: MetricTimeframe;
  /** Data source identifier */
  source: string;
  /** Timestamp of data collection */
  collectedAt: Date;
  /** Security classification of the data */
  dataClassification: string;
  /** Last update timestamp */
  lastUpdatedAt: Date;
}

/**
 * Interface for benchmark data points with statistical measures
 */
export interface IBenchmarkData {
  /** Unique identifier for the data point */
  id: string;
  /** Reference to parent benchmark definition */
  benchmarkId: string;
  /** 10th percentile value */
  p10Value: number;
  /** 25th percentile value */
  p25Value: number;
  /** Median (50th percentile) value */
  p50Value: number;
  /** 75th percentile value */
  p75Value: number;
  /** 90th percentile value */
  p90Value: number;
  /** Number of companies in the sample */
  sampleSize: number;
  /** Statistical confidence level (0-1) */
  confidenceLevel: number;
}

/**
 * Interface for company metric comparisons against benchmarks
 */
export interface IBenchmarkComparison {
  /** Company identifier */
  companyId: string;
  /** Reference to benchmark being compared against */
  benchmarkId: string;
  /** Company's metric value */
  metricValue: number;
  /** Company's percentile ranking */
  percentile: number;
  /** Timestamp of comparison */
  comparedAt: Date;
  /** Percentage deviation from median */
  deviationFromMedian: number;
  /** Trend indicator (e.g., "increasing", "stable", "decreasing") */
  trendDirection: string;
}