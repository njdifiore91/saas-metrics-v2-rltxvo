/**
 * Metric Definitions for the Startup Metrics Benchmarking Platform
 * Defines standardized formulas, validation rules and calculation parameters for all startup metrics
 * @version 1.0.0
 */

import { 
  IMetricDefinition,
  IMetricValidationRule 
} from '../interfaces/metric.interface';
import { 
  MetricType, 
  MetricUnit 
} from '../types/metric-types';

/**
 * Validation rules for each metric with defined ranges and error messages
 */
export const METRIC_VALIDATION_RULES: Record<string, IMetricValidationRule> = {
  NET_DOLLAR_RETENTION: {
    type: 'RANGE',
    minValue: 0,
    maxValue: 200,
    unit: MetricUnit.PERCENTAGE,
    description: 'Net Dollar Retention must be between 0% and 200%',
    errorMessage: 'Net Dollar Retention value must be between 0% and 200%'
  },
  CAC_PAYBACK: {
    type: 'RANGE',
    minValue: 0,
    maxValue: 60,
    unit: MetricUnit.MONTHS,
    description: 'CAC Payback must be between 0 and 60 months',
    errorMessage: 'CAC Payback period must be between 0 and 60 months'
  },
  MAGIC_NUMBER: {
    type: 'RANGE',
    minValue: 0,
    maxValue: 10,
    unit: MetricUnit.RATIO,
    description: 'Magic Number must be between 0 and 10',
    errorMessage: 'Magic Number must be between 0 and 10'
  },
  PIPELINE_COVERAGE: {
    type: 'RANGE',
    minValue: 0,
    maxValue: 1000,
    unit: MetricUnit.PERCENTAGE,
    description: 'Pipeline Coverage must be between 0% and 1000%',
    errorMessage: 'Pipeline Coverage must be between 0% and 1000%'
  },
  GROSS_MARGINS: {
    type: 'RANGE',
    minValue: -100,
    maxValue: 100,
    unit: MetricUnit.PERCENTAGE,
    description: 'Gross Margins must be between -100% and 100%',
    errorMessage: 'Gross Margins must be between -100% and 100%'
  }
};

/**
 * Comprehensive metric definitions including formulas, validation rules and metadata
 */
export const METRIC_DEFINITIONS: Record<string, IMetricDefinition> = {
  NET_DOLLAR_RETENTION: {
    id: 'NDR_001',
    name: 'Net Dollar Retention',
    description: 'Measures revenue retention from existing customers including expansions and contractions',
    type: MetricType.RETENTION,
    unit: MetricUnit.PERCENTAGE,
    timeframe: 'ANNUAL',
    formula: '(Starting ARR + Expansions - Contractions - Churn) / Starting ARR × 100',
    validationRules: [METRIC_VALIDATION_RULES.NET_DOLLAR_RETENTION],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  CAC_PAYBACK: {
    id: 'CAC_001',
    name: 'CAC Payback Period',
    description: 'Time required to recover customer acquisition cost through gross margin',
    type: MetricType.EFFICIENCY,
    unit: MetricUnit.MONTHS,
    timeframe: 'MONTHLY',
    formula: 'CAC / (ARR × Gross Margin) × 12',
    validationRules: [METRIC_VALIDATION_RULES.CAC_PAYBACK],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  MAGIC_NUMBER: {
    id: 'MGC_001',
    name: 'Magic Number',
    description: 'Measures sales efficiency by comparing new ARR to sales and marketing spend',
    type: MetricType.SALES,
    unit: MetricUnit.RATIO,
    timeframe: 'QUARTERLY',
    formula: 'Net New ARR / Previous Quarter S&M Spend',
    validationRules: [METRIC_VALIDATION_RULES.MAGIC_NUMBER],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  PIPELINE_COVERAGE: {
    id: 'PIP_001',
    name: 'Pipeline Coverage',
    description: 'Ratio of total pipeline value to revenue target',
    type: MetricType.SALES,
    unit: MetricUnit.PERCENTAGE,
    timeframe: 'QUARTERLY',
    formula: 'Total Pipeline Value / Revenue Target × 100',
    validationRules: [METRIC_VALIDATION_RULES.PIPELINE_COVERAGE],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  },
  GROSS_MARGINS: {
    id: 'GRM_001',
    name: 'Gross Margins',
    description: 'Percentage of revenue remaining after cost of goods sold',
    type: MetricType.FINANCIAL,
    unit: MetricUnit.PERCENTAGE,
    timeframe: 'QUARTERLY',
    formula: '(Revenue - COGS) / Revenue × 100',
    validationRules: [METRIC_VALIDATION_RULES.GROSS_MARGINS],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  }
};