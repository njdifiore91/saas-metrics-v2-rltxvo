import { faker } from '@faker-js/faker'; // ^8.0.0
import { v4 as uuidv4 } from 'uuid'; // ^9.0.0
import gaussian from 'gaussian'; // ^1.2.0

import { 
  IMetricDefinition, 
  IMetricValidationRule, 
  IMetricValue 
} from '../../backend/src/shared/interfaces/metric.interface';
import { 
  IBenchmarkDefinition,
  IBenchmarkData,
  IBenchmarkComparison 
} from '../../backend/src/shared/interfaces/benchmark.interface';
import { 
  User, 
  UserRole, 
  UserPermissions,
  UserSession 
} from '../../backend/src/shared/interfaces/user.interface';
import { 
  MetricType, 
  MetricUnit, 
  MetricTimeframe,
  MetricValidationType,
  METRIC_VALIDATION_RANGES 
} from '../../backend/src/shared/types/metric-types';

// Statistical configuration constants
const DEFAULT_METRIC_RANGES = {
  FINANCIAL: { min: 0, max: 1000000, distribution: 'log-normal' },
  RETENTION: { min: 0, max: 100, distribution: 'normal' },
  EFFICIENCY: { min: 0, max: 1000, distribution: 'exponential' }
};

const DEFAULT_BENCHMARK_PERCENTILES = [10, 25, 50, 75, 90];
const STATISTICAL_CONFIDENCE_LEVELS = [0.90, 0.95, 0.99];
const DATA_GENERATION_CONFIGS = {
  sampleSize: 1000,
  temporalRange: '5Y',
  validationLevel: 'strict'
};

/**
 * Generates statistically valid mock metric data
 * @param metricType Type of metric to generate
 * @param options Additional generation options
 */
export function generateMetricData(
  metricType: MetricType,
  options: {
    timeframe?: MetricTimeframe;
    customValidation?: boolean;
  } = {}
): IMetricDefinition {
  const id = uuidv4();
  const validationRange = METRIC_VALIDATION_RANGES[metricType] || DEFAULT_METRIC_RANGES[metricType];
  
  const validationRules: IMetricValidationRule[] = [{
    type: MetricValidationType.RANGE,
    minValue: validationRange.min,
    maxValue: validationRange.max,
    description: `Valid range for ${metricType}`,
    errorMessage: `Value must be between ${validationRange.min} and ${validationRange.max}`
  }];

  if (options.customValidation) {
    validationRules.push({
      type: MetricValidationType.CUSTOM,
      minValue: 0,
      maxValue: 0,
      description: 'Custom business logic validation',
      customValidation: 'value => value != null && !isNaN(value)',
      errorMessage: 'Invalid metric value'
    });
  }

  return {
    id,
    name: faker.company.catchPhrase(),
    description: faker.lorem.sentence(),
    type: metricType,
    unit: determineMetricUnit(metricType),
    timeframe: options.timeframe || MetricTimeframe.MONTHLY,
    formula: generateMetricFormula(metricType),
    validationRules,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

/**
 * Generates statistically valid benchmark data with proper distributions
 * @param definition Benchmark definition to generate data for
 */
export function generateBenchmarkData(definition: IBenchmarkDefinition): IBenchmarkData {
  const distribution = gaussian(0, 1);
  const confidenceLevel = STATISTICAL_CONFIDENCE_LEVELS[1]; // 0.95 confidence level
  
  const generatePercentileValue = (percentile: number): number => {
    const zScore = distribution.ppf(percentile / 100);
    return Math.max(
      definition.revenueRange.minRevenue,
      Math.min(
        definition.revenueRange.maxRevenue,
        zScore * (definition.revenueRange.maxRevenue - definition.revenueRange.minRevenue) / 4 + 
        (definition.revenueRange.maxRevenue + definition.revenueRange.minRevenue) / 2
      )
    );
  };

  return {
    id: uuidv4(),
    benchmarkId: definition.id,
    p10Value: generatePercentileValue(10),
    p25Value: generatePercentileValue(25),
    p50Value: generatePercentileValue(50),
    p75Value: generatePercentileValue(75),
    p90Value: generatePercentileValue(90),
    sampleSize: DATA_GENERATION_CONFIGS.sampleSize,
    confidenceLevel
  };
}

/**
 * Generates comprehensive mock user data with proper permissions
 * @param role User role to generate data for
 * @param options Additional generation options
 */
export function generateUserData(
  role: UserRole,
  options: {
    isActive?: boolean;
    sessionCount?: number;
  } = {}
): User {
  const user: User = {
    id: uuidv4(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    role,
    createdAt: faker.date.past(),
    lastLoginAt: faker.date.recent(),
    isActive: options.isActive ?? true
  };

  return user;
}

/**
 * Generates a complete set of related test data
 * @param options Configuration options for data generation
 */
export function generateTestDataSet(options: {
  userCount?: number;
  metricsPerUser?: number;
  includeHistorical?: boolean;
} = {}): {
  users: User[];
  metrics: IMetricDefinition[];
  benchmarks: IBenchmarkData[];
} {
  const userCount = options.userCount || 10;
  const metricsPerUser = options.metricsPerUser || 5;
  
  const users = Array.from({ length: userCount }, () => 
    generateUserData(faker.helpers.arrayElement(Object.values(UserRole)))
  );

  const metrics = users.flatMap(user => 
    Array.from({ length: metricsPerUser }, () =>
      generateMetricData(
        faker.helpers.arrayElement(Object.values(MetricType)),
        { timeframe: faker.helpers.arrayElement(Object.values(MetricTimeframe)) }
      )
    )
  );

  const benchmarks = metrics.map(metric => {
    const benchmarkDef: IBenchmarkDefinition = {
      id: uuidv4(),
      metricType: metric.type,
      revenueRange: {
        id: uuidv4(),
        minRevenue: 1000000,
        maxRevenue: 5000000,
        label: '$1M-$5M',
        active: true
      },
      timeframe: metric.timeframe,
      source: 'Generated Test Data',
      collectedAt: new Date(),
      dataClassification: 'Test Data',
      lastUpdatedAt: new Date()
    };
    return generateBenchmarkData(benchmarkDef);
  });

  return {
    users,
    metrics,
    benchmarks
  };
}

// Helper functions
function determineMetricUnit(metricType: MetricType): MetricUnit {
  switch (metricType) {
    case MetricType.RETENTION:
      return MetricUnit.PERCENTAGE;
    case MetricType.FINANCIAL:
      return MetricUnit.CURRENCY;
    case MetricType.EFFICIENCY:
      return MetricUnit.RATIO;
    default:
      return MetricUnit.PERCENTAGE;
  }
}

function generateMetricFormula(metricType: MetricType): string {
  switch (metricType) {
    case MetricType.RETENTION:
      return '(Retained Customers / Total Customers) * 100';
    case MetricType.FINANCIAL:
      return 'Revenue - Costs';
    case MetricType.EFFICIENCY:
      return 'Output / Input';
    default:
      return 'Custom Formula';
  }
}