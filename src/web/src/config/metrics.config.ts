import { 
  IMetricDefinition, 
  IMetricValidationRule,
  IMetricCalculationParams 
} from '../interfaces/metric.interface';
import { 
  MetricType, 
  MetricUnit, 
  MetricTimeframe,
  MetricValidationType 
} from '../types/metric.types';

// Global constants for metric configuration
const DEFAULT_TIMEFRAME = MetricTimeframe.MONTHLY;
const DEFAULT_CURRENCY = 'USD';
const VALIDATION_PRIORITY = {
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3
};

// Validation ranges for key metrics based on industry standards
export const METRIC_VALIDATION_RANGES = {
  NDR: {
    min: 0,
    max: 200,
    warning: { min: 80, max: 120 },
    critical: { min: 70, max: 130 }
  },
  CAC_PAYBACK: {
    min: 0,
    max: 60,
    warning: { min: 6, max: 18 },
    critical: { min: 12, max: 24 }
  },
  MAGIC_NUMBER: {
    min: 0,
    max: 10,
    warning: { min: 0.5, max: 1.5 },
    critical: { min: 0.75, max: 2 }
  },
  PIPELINE_COVERAGE: {
    min: 0,
    max: 1000,
    warning: { min: 300, max: 500 },
    critical: { min: 200, max: 600 }
  },
  GROSS_MARGINS: {
    min: -100,
    max: 100,
    warning: { min: 60, max: 80 },
    critical: { min: 50, max: 85 }
  }
};

// Metric calculation functions
const calculationFunctions = {
  calculateNDR: (params: IMetricCalculationParams): number => {
    const { startingARR, expansions, contractions, churn } = params.filterCriteria;
    return ((startingARR + expansions - contractions - churn) / startingARR) * 100;
  },
  
  calculateCACPayback: (params: IMetricCalculationParams): number => {
    const { cac, arr, grossMargin } = params.filterCriteria;
    return (cac / (arr * grossMargin)) * 12;
  },
  
  calculateMagicNumber: (params: IMetricCalculationParams): number => {
    const { newARR, previousQuarterSAndM } = params.filterCriteria;
    return newARR / previousQuarterSAndM;
  },
  
  calculatePipelineCoverage: (params: IMetricCalculationParams): number => {
    const { pipelineValue, revenueTarget } = params.filterCriteria;
    return (pipelineValue / revenueTarget) * 100;
  },
  
  calculateGrossMargins: (params: IMetricCalculationParams): number => {
    const { revenue, cogs } = params.filterCriteria;
    return ((revenue - cogs) / revenue) * 100;
  }
};

// Display configuration for metrics visualization
export const METRIC_DISPLAY_CONFIG = {
  formatOptions: {
    percentage: {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      suffix: '%'
    },
    currency: {
      style: 'currency',
      currency: DEFAULT_CURRENCY,
      minimumFractionDigits: 0
    },
    ratio: {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    },
    months: {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      suffix: ' months'
    }
  },
  chartOptions: {
    lineChart: {
      aspectRatio: 16/9,
      showGrid: true,
      showLegend: true,
      animations: true
    },
    barChart: {
      aspectRatio: 4/3,
      showGrid: true,
      showLegend: true,
      animations: true
    }
  },
  thresholdIndicators: {
    positive: '#168947', // Forest Green
    warning: '#FFA500', // Orange
    critical: '#FF0000', // Red
    neutral: '#46608C'  // Ocean Blue
  }
};

// Main metric configuration object
export const metricConfig: Record<string, IMetricDefinition> = {
  ndr: {
    id: 'ndr',
    name: 'Net Dollar Retention',
    description: 'Measures revenue retention and expansion from existing customers',
    type: MetricType.RETENTION,
    unit: MetricUnit.PERCENTAGE,
    timeframe: DEFAULT_TIMEFRAME,
    formula: '(Starting ARR + Expansions - Contractions - Churn) / Starting ARR × 100',
    validationRules: [
      {
        type: MetricValidationType.RANGE,
        minValue: METRIC_VALIDATION_RANGES.NDR.min,
        maxValue: METRIC_VALIDATION_RANGES.NDR.max,
        required: true,
        customValidation: null,
        errorMessage: 'NDR must be between 0% and 200%',
        priority: VALIDATION_PRIORITY.HIGH,
        validationContext: METRIC_VALIDATION_RANGES.NDR
      }
    ]
  },
  
  cacPayback: {
    id: 'cacPayback',
    name: 'CAC Payback Period',
    description: 'Time required to recover customer acquisition cost',
    type: MetricType.EFFICIENCY,
    unit: MetricUnit.MONTHS,
    timeframe: DEFAULT_TIMEFRAME,
    formula: 'CAC / (ARR × Gross Margin) × 12',
    validationRules: [
      {
        type: MetricValidationType.RANGE,
        minValue: METRIC_VALIDATION_RANGES.CAC_PAYBACK.min,
        maxValue: METRIC_VALIDATION_RANGES.CAC_PAYBACK.max,
        required: true,
        customValidation: null,
        errorMessage: 'CAC Payback must be between 0 and 60 months',
        priority: VALIDATION_PRIORITY.HIGH,
        validationContext: METRIC_VALIDATION_RANGES.CAC_PAYBACK
      }
    ]
  },
  
  magicNumber: {
    id: 'magicNumber',
    name: 'Magic Number',
    description: 'Sales efficiency metric measuring new ARR generated per dollar of sales and marketing spend',
    type: MetricType.SALES,
    unit: MetricUnit.RATIO,
    timeframe: DEFAULT_TIMEFRAME,
    formula: 'Net New ARR / Previous Quarter S&M Spend',
    validationRules: [
      {
        type: MetricValidationType.RANGE,
        minValue: METRIC_VALIDATION_RANGES.MAGIC_NUMBER.min,
        maxValue: METRIC_VALIDATION_RANGES.MAGIC_NUMBER.max,
        required: true,
        customValidation: null,
        errorMessage: 'Magic Number must be between 0 and 10',
        priority: VALIDATION_PRIORITY.MEDIUM,
        validationContext: METRIC_VALIDATION_RANGES.MAGIC_NUMBER
      }
    ]
  },
  
  grossMargins: {
    id: 'grossMargins',
    name: 'Gross Margins',
    description: 'Percentage of revenue remaining after accounting for cost of goods sold',
    type: MetricType.FINANCIAL,
    unit: MetricUnit.PERCENTAGE,
    timeframe: DEFAULT_TIMEFRAME,
    formula: '(Revenue - COGS) / Revenue × 100',
    validationRules: [
      {
        type: MetricValidationType.RANGE,
        minValue: METRIC_VALIDATION_RANGES.GROSS_MARGINS.min,
        maxValue: METRIC_VALIDATION_RANGES.GROSS_MARGINS.max,
        required: true,
        customValidation: null,
        errorMessage: 'Gross Margins must be between -100% and 100%',
        priority: VALIDATION_PRIORITY.HIGH,
        validationContext: METRIC_VALIDATION_RANGES.GROSS_MARGINS
      }
    ]
  }
};

export default {
  metrics: metricConfig,
  validationRanges: METRIC_VALIDATION_RANGES,
  displayConfig: METRIC_DISPLAY_CONFIG,
  calculationFunctions
};