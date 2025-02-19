import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { 
  IMetricDefinition,
  IMetricValidationRule 
} from '../../src/shared/interfaces/metric.interface';
import { 
  MetricType,
  MetricUnit,
  MetricTimeframe,
  MetricValidationType,
  METRIC_VALIDATION_RANGES
} from '../../src/shared/types/metric-types';

/**
 * Predefined metric definitions for seeding the database
 * Based on industry standard startup metrics from technical specifications
 */
export const metricDefinitions: IMetricDefinition[] = [
  {
    id: uuidv4(),
    name: 'Net Dollar Retention',
    description: 'Measures revenue retention and expansion from existing customers over time',
    type: MetricType.RETENTION,
    unit: MetricUnit.PERCENTAGE,
    timeframe: MetricTimeframe.ANNUAL,
    formula: '(Starting ARR + Expansions - Contractions - Churn) / Starting ARR × 100',
    validationRules: [{
      type: MetricValidationType.RANGE,
      minValue: METRIC_VALIDATION_RANGES.NET_DOLLAR_RETENTION.min,
      maxValue: METRIC_VALIDATION_RANGES.NET_DOLLAR_RETENTION.max,
      description: 'NDR must be between 0% and 200%',
      errorMessage: 'Net Dollar Retention must be between 0% and 200%'
    }],
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true
  },
  {
    id: uuidv4(),
    name: 'CAC Payback Period',
    description: 'Time required to recover customer acquisition cost through gross margin',
    type: MetricType.EFFICIENCY,
    unit: MetricUnit.MONTHS,
    timeframe: MetricTimeframe.MONTHLY,
    formula: 'CAC / (ARR × Gross Margin) × 12',
    validationRules: [{
      type: MetricValidationType.RANGE,
      minValue: METRIC_VALIDATION_RANGES.CAC_PAYBACK.min,
      maxValue: METRIC_VALIDATION_RANGES.CAC_PAYBACK.max,
      description: 'CAC Payback must be between 0 and 60 months',
      errorMessage: 'CAC Payback Period must be between 0 and 60 months'
    }],
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true
  },
  {
    id: uuidv4(),
    name: 'Magic Number',
    description: 'Measures sales efficiency by comparing new ARR to sales and marketing spend',
    type: MetricType.SALES,
    unit: MetricUnit.RATIO,
    timeframe: MetricTimeframe.QUARTERLY,
    formula: 'Net New ARR / Previous Quarter S&M Spend',
    validationRules: [{
      type: MetricValidationType.RANGE,
      minValue: METRIC_VALIDATION_RANGES.MAGIC_NUMBER.min,
      maxValue: METRIC_VALIDATION_RANGES.MAGIC_NUMBER.max,
      description: 'Magic Number must be between 0 and 10',
      errorMessage: 'Magic Number must be between 0 and 10'
    }],
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true
  },
  {
    id: uuidv4(),
    name: 'Pipeline Coverage',
    description: 'Ratio of total pipeline value to revenue target',
    type: MetricType.SALES,
    unit: MetricUnit.PERCENTAGE,
    timeframe: MetricTimeframe.QUARTERLY,
    formula: 'Total Pipeline Value / Revenue Target × 100',
    validationRules: [{
      type: MetricValidationType.RANGE,
      minValue: METRIC_VALIDATION_RANGES.PIPELINE_COVERAGE.min,
      maxValue: METRIC_VALIDATION_RANGES.PIPELINE_COVERAGE.max,
      description: 'Pipeline Coverage must be between 0% and 1000%',
      errorMessage: 'Pipeline Coverage must be between 0% and 1000%'
    }],
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true
  },
  {
    id: uuidv4(),
    name: 'Gross Margins',
    description: 'Percentage of revenue remaining after cost of goods sold',
    type: MetricType.FINANCIAL,
    unit: MetricUnit.PERCENTAGE,
    timeframe: MetricTimeframe.QUARTERLY,
    formula: '(Revenue - COGS) / Revenue × 100',
    validationRules: [{
      type: MetricValidationType.RANGE,
      minValue: METRIC_VALIDATION_RANGES.GROSS_MARGINS.min,
      maxValue: METRIC_VALIDATION_RANGES.GROSS_MARGINS.max,
      description: 'Gross Margins must be between -100% and 100%',
      errorMessage: 'Gross Margins must be between -100% and 100%'
    }],
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true
  }
];

/**
 * Seeds the database with predefined metric definitions
 * Uses transaction for data integrity during seeding process
 * @param prisma PrismaClient instance
 */
export default async function seedMetricDefinitions(prisma: PrismaClient): Promise<void> {
  try {
    // Use transaction to ensure all metrics are created or none
    await prisma.$transaction(async (tx) => {
      // Delete existing metric definitions if any
      await tx.metricDefinition.deleteMany();

      // Create all metric definitions
      for (const definition of metricDefinitions) {
        await tx.metricDefinition.create({
          data: definition
        });
      }
    });

    console.log('Successfully seeded metric definitions');
  } catch (error) {
    console.error('Error seeding metric definitions:', error);
    throw error;
  }
}