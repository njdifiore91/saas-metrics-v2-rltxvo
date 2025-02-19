/**
 * Mock benchmark data for testing the Startup Metrics Benchmarking Platform
 * Provides statistically valid sample data with comprehensive coverage of all metric types
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid'; // v9.0.0
import { 
  IBenchmarkDefinition, 
  IBenchmarkData, 
  IBenchmarkRevenueRange 
} from '../../backend/src/shared/interfaces/benchmark.interface';
import { 
  MetricType, 
  MetricUnit, 
  MetricTimeframe,
  METRIC_VALIDATION_RANGES 
} from '../../backend/src/shared/types/metric-types';

/**
 * Mock revenue ranges covering all specified business sizes
 */
export const MOCK_REVENUE_RANGES: IBenchmarkRevenueRange[] = [
  {
    id: uuidv4(),
    minRevenue: 0,
    maxRevenue: 1000000,
    label: '<$1M',
    active: true
  },
  {
    id: uuidv4(),
    minRevenue: 1000000,
    maxRevenue: 5000000,
    label: '$1M-$5M',
    active: true
  },
  {
    id: uuidv4(),
    minRevenue: 5000000,
    maxRevenue: 20000000,
    label: '$5M-$20M',
    active: true
  },
  {
    id: uuidv4(),
    minRevenue: 20000000,
    maxRevenue: 50000000,
    label: '$20M-$50M',
    active: true
  }
];

/**
 * Statistical distribution configurations for different metric types
 */
const STATISTICAL_DISTRIBUTIONS: Record<MetricType, {
  mean: number;
  stdDev: number;
  skewness: number;
}> = {
  [MetricType.FINANCIAL]: {
    mean: 0.6,
    stdDev: 0.15,
    skewness: 0.2
  },
  [MetricType.RETENTION]: {
    mean: 0.85,
    stdDev: 0.1,
    skewness: -0.3
  },
  [MetricType.EFFICIENCY]: {
    mean: 0.7,
    stdDev: 0.12,
    skewness: 0
  },
  [MetricType.SALES]: {
    mean: 0.65,
    stdDev: 0.18,
    skewness: 0.1
  }
};

/**
 * Generates statistically valid distribution for a given metric type
 */
export const generateStatisticalDistribution = (
  metricType: MetricType,
  validationRange: { min: number; max: number }
): number[] => {
  const distribution = STATISTICAL_DISTRIBUTIONS[metricType];
  const values: number[] = [];
  
  for (let i = 0; i < 1000; i++) {
    // Box-Muller transform for normal distribution
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    
    // Apply distribution parameters
    let value = z * distribution.stdDev + distribution.mean;
    
    // Apply skewness
    value += distribution.skewness * Math.pow(z, 2);
    
    // Scale to validation range
    value = value * (validationRange.max - validationRange.min) + validationRange.min;
    
    // Clamp to validation range
    value = Math.max(validationRange.min, Math.min(validationRange.max, value));
    
    values.push(value);
  }
  
  return values.sort((a, b) => a - b);
};

/**
 * Generates mock benchmark definition with comprehensive metadata
 */
export const generateMockBenchmarkDefinition = (
  metricType: MetricType,
  revenueRange: IBenchmarkRevenueRange,
  dataClassification: string
): IBenchmarkDefinition => {
  return {
    id: uuidv4(),
    metricType,
    revenueRange,
    timeframe: metricType === MetricType.FINANCIAL ? MetricTimeframe.ANNUAL : MetricTimeframe.QUARTERLY,
    source: 'MOCK_DATA',
    collectedAt: new Date(),
    dataClassification,
    lastUpdatedAt: new Date()
  };
};

/**
 * Generates statistically valid mock benchmark data points
 */
export const generateMockBenchmarkData = (
  benchmarkId: string,
  metricType: MetricType
): IBenchmarkData => {
  const validationRange = METRIC_VALIDATION_RANGES[metricType] || { min: 0, max: 100 };
  const distribution = generateStatisticalDistribution(metricType, validationRange);
  
  return {
    id: uuidv4(),
    benchmarkId,
    p10Value: distribution[Math.floor(distribution.length * 0.1)],
    p25Value: distribution[Math.floor(distribution.length * 0.25)],
    p50Value: distribution[Math.floor(distribution.length * 0.5)],
    p75Value: distribution[Math.floor(distribution.length * 0.75)],
    p90Value: distribution[Math.floor(distribution.length * 0.9)],
    sampleSize: distribution.length,
    confidenceLevel: 0.95
  };
};

/**
 * Mock benchmark definitions with comprehensive coverage
 */
export const MOCK_BENCHMARK_DEFINITIONS: IBenchmarkDefinition[] = MOCK_REVENUE_RANGES.flatMap(
  (revenueRange) => Object.values(MetricType).map((metricType) =>
    generateMockBenchmarkDefinition(
      metricType,
      revenueRange,
      metricType === MetricType.FINANCIAL ? 'CONFIDENTIAL' : 'INTERNAL'
    )
  )
);

/**
 * Mock benchmark data with statistical validity
 */
export const MOCK_BENCHMARK_DATA: IBenchmarkData[] = MOCK_BENCHMARK_DEFINITIONS.map(
  (definition) => generateMockBenchmarkData(definition.id, definition.metricType)
);