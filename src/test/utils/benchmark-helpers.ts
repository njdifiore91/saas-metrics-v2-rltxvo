import { faker } from '@faker-js/faker';
import jStat from 'jstat';
import { 
  IBenchmarkDefinition,
  IBenchmarkData,
  IBenchmarkRevenueRange
} from '../../backend/src/shared/interfaces/benchmark.interface';
import { 
  MetricType,
  MetricUnit,
  METRIC_VALIDATION_RANGES
} from '../../backend/src/shared/types/metric-types';

/**
 * Data classification levels for benchmarks
 */
enum DataClassification {
  PUBLIC = 'PUBLIC',
  INTERNAL = 'INTERNAL',
  CONFIDENTIAL = 'CONFIDENTIAL',
  RESTRICTED = 'RESTRICTED'
}

/**
 * Generates a test benchmark definition with realistic data and proper classification
 * @param metricType - Type of metric for the benchmark
 * @param revenueRange - Revenue range for benchmark categorization
 * @param classification - Data security classification level
 * @returns Generated benchmark definition with complete metadata
 */
export const generateTestBenchmark = (
  metricType: MetricType,
  revenueRange: IBenchmarkRevenueRange,
  classification: DataClassification
): IBenchmarkDefinition => {
  return {
    id: faker.string.uuid(),
    metricType,
    revenueRange,
    timeframe: faker.helpers.arrayElement(['MONTHLY', 'QUARTERLY', 'ANNUAL']),
    source: faker.company.name(),
    collectedAt: faker.date.recent(),
    dataClassification: classification,
    lastUpdatedAt: faker.date.recent()
  };
};

/**
 * Generates statistically valid test benchmark data points
 * @param benchmarkId - ID of the parent benchmark definition
 * @param metricType - Type of metric for proper value ranges
 * @returns Generated benchmark data with valid statistical properties
 */
export const generateTestBenchmarkData = (
  benchmarkId: string,
  metricType: MetricType
): IBenchmarkData => {
  // Get validation range for the metric type
  const validationRange = getValidationRangeForMetric(metricType);
  
  // Generate statistically valid percentile values
  const distribution = generateStatisticalDistribution(
    validationRange.min,
    validationRange.max
  );

  return {
    id: faker.string.uuid(),
    benchmarkId,
    p10Value: distribution.p10,
    p25Value: distribution.p25,
    p50Value: distribution.p50,
    p75Value: distribution.p75,
    p90Value: distribution.p90,
    sampleSize: faker.number.int({ min: 30, max: 1000 }),
    confidenceLevel: faker.number.float({ min: 0.90, max: 0.99, precision: 0.01 })
  };
};

/**
 * Calculates percentile position with statistical accuracy
 * @param metricValue - Value to calculate percentile for
 * @param benchmarkData - Benchmark data containing percentile points
 * @param metricType - Type of metric for validation
 * @returns Calculated percentile with confidence level
 */
export const calculatePercentile = (
  metricValue: number,
  benchmarkData: IBenchmarkData,
  metricType: MetricType
): number => {
  // Validate metric value is within allowed range
  validateMetricValue(metricValue, metricType);

  // Create array of percentile points for interpolation
  const percentilePoints = [
    { percentile: 10, value: benchmarkData.p10Value },
    { percentile: 25, value: benchmarkData.p25Value },
    { percentile: 50, value: benchmarkData.p50Value },
    { percentile: 75, value: benchmarkData.p75Value },
    { percentile: 90, value: benchmarkData.p90Value }
  ];

  // Interpolate percentile using jStat
  return interpolatePercentile(metricValue, percentilePoints);
};

/**
 * Validates benchmark data structure and statistical properties
 * @param benchmarkData - Benchmark data to validate
 * @param metricType - Type of metric for validation rules
 * @returns Validation result with error details if invalid
 */
export const validateBenchmarkData = (
  benchmarkData: IBenchmarkData,
  metricType: MetricType
): boolean => {
  try {
    // Validate required fields exist
    validateRequiredFields(benchmarkData);

    // Validate statistical ordering
    validateStatisticalOrder(benchmarkData);

    // Validate value ranges
    validateValueRanges(benchmarkData, metricType);

    // Validate sample size and confidence level
    validateStatisticalProperties(benchmarkData);

    return true;
  } catch (error) {
    console.error('Benchmark data validation failed:', error);
    return false;
  }
};

/**
 * Helper function to generate statistically valid distribution
 */
const generateStatisticalDistribution = (min: number, max: number) => {
  // Generate normal distribution and scale to min/max range
  const mean = (max + min) / 2;
  const std = (max - min) / 6; // 99.7% of values within range
  
  const values = Array.from({ length: 1000 }, () => 
    jStat.normal.sample(mean, std)
  ).map(v => Math.max(min, Math.min(max, v))).sort((a, b) => a - b);

  return {
    p10: values[Math.floor(values.length * 0.1)],
    p25: values[Math.floor(values.length * 0.25)],
    p50: values[Math.floor(values.length * 0.5)],
    p75: values[Math.floor(values.length * 0.75)],
    p90: values[Math.floor(values.length * 0.9)]
  };
};

/**
 * Helper function to get validation range for metric type
 */
const getValidationRangeForMetric = (metricType: MetricType) => {
  switch (metricType) {
    case MetricType.FINANCIAL:
      return METRIC_VALIDATION_RANGES.GROSS_MARGINS;
    case MetricType.RETENTION:
      return METRIC_VALIDATION_RANGES.NET_DOLLAR_RETENTION;
    case MetricType.EFFICIENCY:
      return METRIC_VALIDATION_RANGES.CAC_PAYBACK;
    case MetricType.SALES:
      return METRIC_VALIDATION_RANGES.PIPELINE_COVERAGE;
    default:
      throw new Error(`Invalid metric type: ${metricType}`);
  }
};

/**
 * Helper function to validate required benchmark data fields
 */
const validateRequiredFields = (benchmarkData: IBenchmarkData): void => {
  const requiredFields = [
    'id', 'benchmarkId', 'p10Value', 'p25Value', 'p50Value',
    'p75Value', 'p90Value', 'sampleSize', 'confidenceLevel'
  ];
  
  for (const field of requiredFields) {
    if (!(field in benchmarkData)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
};

/**
 * Helper function to validate statistical ordering of percentiles
 */
const validateStatisticalOrder = (benchmarkData: IBenchmarkData): void => {
  if (!(
    benchmarkData.p10Value <= benchmarkData.p25Value &&
    benchmarkData.p25Value <= benchmarkData.p50Value &&
    benchmarkData.p50Value <= benchmarkData.p75Value &&
    benchmarkData.p75Value <= benchmarkData.p90Value
  )) {
    throw new Error('Invalid percentile ordering');
  }
};

/**
 * Helper function to validate metric value ranges
 */
const validateMetricValue = (value: number, metricType: MetricType): void => {
  const range = getValidationRangeForMetric(metricType);
  if (value < range.min || value > range.max) {
    throw new Error(
      `Value ${value} outside valid range [${range.min}, ${range.max}]`
    );
  }
};

/**
 * Helper function to validate statistical properties
 */
const validateStatisticalProperties = (benchmarkData: IBenchmarkData): void => {
  if (benchmarkData.sampleSize < 30) {
    throw new Error('Sample size too small for statistical significance');
  }
  
  if (benchmarkData.confidenceLevel < 0.9 || benchmarkData.confidenceLevel > 1) {
    throw new Error('Invalid confidence level');
  }
};

/**
 * Helper function to interpolate percentile values
 */
const interpolatePercentile = (
  value: number,
  percentilePoints: Array<{ percentile: number; value: number }>
): number => {
  // Find surrounding percentile points
  const lowerPoint = percentilePoints.find(p => p.value >= value);
  const upperPoint = percentilePoints.find(p => p.value <= value);

  if (!lowerPoint || !upperPoint) {
    return lowerPoint ? 100 : 0;
  }

  // Linear interpolation
  const range = upperPoint.value - lowerPoint.value;
  const position = value - lowerPoint.value;
  return lowerPoint.percentile + 
    (position / range) * (upperPoint.percentile - lowerPoint.percentile);
};