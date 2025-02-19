import { 
  IMetricDefinition, 
  IMetricValue, 
  IMetricValidationRule 
} from '../../backend/src/shared/interfaces/metric.interface';
import { MetricType } from '../../backend/src/shared/types/metric-types';

// Mock metric IDs for consistent reference
export const MOCK_METRIC_IDS = {
  NDR: 'mock-ndr-id',
  CAC: 'mock-cac-id',
  MAGIC: 'mock-magic-id',
  PIPELINE: 'mock-pipeline-id',
  MARGIN: 'mock-margin-id'
};

// Mock validation ranges matching technical specifications
export const MOCK_VALIDATION_RANGES = {
  NDR: { min: 0, max: 200 },
  CAC: { min: 0, max: 60 },
  MAGIC: { min: 0, max: 10 },
  PIPELINE: { min: 0, max: 1000 },
  MARGIN: { min: -100, max: 100 }
};

/**
 * Generates a mock metric value within valid constraints
 * @param metricId - ID of the metric to generate value for
 * @param baseValue - Optional base value to vary from
 * @param timestamp - Timestamp for the metric value
 */
export const generateMockMetricValue = (
  metricId: string,
  baseValue?: number,
  timestamp: Date = new Date()
): IMetricValue => {
  const range = MOCK_VALIDATION_RANGES[metricId.split('-')[1].toUpperCase()];
  const value = baseValue ?? 
    range.min + (Math.random() * (range.max - range.min));

  return {
    id: `mock-value-${Date.now()}`,
    metricId,
    companyId: 'mock-company-id',
    value: Number(value.toFixed(2)),
    timestamp
  };
};

/**
 * Creates a mock metric definition with validation rules
 */
export const createMockMetricDefinition = (
  type: MetricType,
  name: string,
  validationRules: IMetricValidationRule[]
): IMetricDefinition => {
  return {
    id: `mock-${name.toLowerCase().replace(/\s+/g, '-')}-id`,
    name,
    type,
    validationRules,
    description: `Mock ${name} metric for testing`,
    createdAt: new Date(),
    updatedAt: new Date()
  };
};

/**
 * Generates time series data for testing trends
 */
export const generateMockTimeSeriesData = (
  metricId: string,
  startDate: Date,
  endDate: Date
): IMetricValue[] => {
  const values: IMetricValue[] = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const baseValue = 
      MOCK_VALIDATION_RANGES[metricId.split('-')[1].toUpperCase()].min +
      (Math.random() * 
        (MOCK_VALIDATION_RANGES[metricId.split('-')[1].toUpperCase()].max -
         MOCK_VALIDATION_RANGES[metricId.split('-')[1].toUpperCase()].min));
    
    values.push(generateMockMetricValue(metricId, baseValue, new Date(currentDate)));
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  
  return values;
};

// Mock metric definitions matching technical specifications
export const mockMetricDefinitions: Record<string, IMetricDefinition> = {
  NET_DOLLAR_RETENTION: createMockMetricDefinition(
    MetricType.RETENTION,
    'Net Dollar Retention',
    [{
      type: 'RANGE',
      minValue: MOCK_VALIDATION_RANGES.NDR.min,
      maxValue: MOCK_VALIDATION_RANGES.NDR.max,
      description: 'NDR must be between 0% and 200%',
      errorMessage: 'NDR value out of valid range'
    }]
  ),
  
  CAC_PAYBACK: createMockMetricDefinition(
    MetricType.FINANCIAL,
    'CAC Payback Period',
    [{
      type: 'RANGE',
      minValue: MOCK_VALIDATION_RANGES.CAC.min,
      maxValue: MOCK_VALIDATION_RANGES.CAC.max,
      description: 'CAC Payback must be between 0 and 60 months',
      errorMessage: 'CAC Payback value out of valid range'
    }]
  ),
  
  MAGIC_NUMBER: createMockMetricDefinition(
    MetricType.FINANCIAL,
    'Magic Number',
    [{
      type: 'RANGE',
      minValue: MOCK_VALIDATION_RANGES.MAGIC.min,
      maxValue: MOCK_VALIDATION_RANGES.MAGIC.max,
      description: 'Magic Number must be between 0 and 10',
      errorMessage: 'Magic Number value out of valid range'
    }]
  ),
  
  PIPELINE_COVERAGE: createMockMetricDefinition(
    MetricType.GROWTH,
    'Pipeline Coverage',
    [{
      type: 'RANGE',
      minValue: MOCK_VALIDATION_RANGES.PIPELINE.min,
      maxValue: MOCK_VALIDATION_RANGES.PIPELINE.max,
      description: 'Pipeline Coverage must be between 0% and 1000%',
      errorMessage: 'Pipeline Coverage value out of valid range'
    }]
  ),
  
  GROSS_MARGIN: createMockMetricDefinition(
    MetricType.FINANCIAL,
    'Gross Margin',
    [{
      type: 'RANGE',
      minValue: MOCK_VALIDATION_RANGES.MARGIN.min,
      maxValue: MOCK_VALIDATION_RANGES.MARGIN.max,
      description: 'Gross Margin must be between -100% and 100%',
      errorMessage: 'Gross Margin value out of valid range'
    }]
  )
};

// Generate mock metric values for testing
export const mockMetricValues = Object.keys(mockMetricDefinitions).reduce((acc, key) => {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 12);
  
  return {
    ...acc,
    [key]: generateMockTimeSeriesData(
      mockMetricDefinitions[key].id,
      startDate,
      new Date()
    )
  };
}, {});

// Export validation rules for testing
export const mockValidationRules = Object.values(mockMetricDefinitions)
  .reduce((acc, definition) => [...acc, ...definition.validationRules], []);