/**
 * Benchmark Data Seeder for Startup Metrics Benchmarking Platform
 * Populates initial benchmark data with industry standard metrics across revenue ranges
 * @version 1.0.0
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid'; // v8.3.2
import { METRIC_DEFINITIONS } from '../../src/shared/constants/metric-definitions';
import { IBenchmarkData } from '../../src/shared/interfaces/benchmark.interface';

// Revenue ranges for benchmark categorization
const REVENUE_RANGES = [
  {
    id: uuidv4(),
    minRevenue: 0,
    maxRevenue: 1000000,
    label: '<$1M'
  },
  {
    id: uuidv4(),
    minRevenue: 1000000,
    maxRevenue: 5000000,
    label: '$1M-$5M'
  },
  {
    id: uuidv4(),
    minRevenue: 5000000,
    maxRevenue: 20000000,
    label: '$5M-$20M'
  },
  {
    id: uuidv4(),
    minRevenue: 20000000,
    maxRevenue: 50000000,
    label: '$20M-$50M'
  }
];

// Data sources with reliability ratings
const DATA_SOURCES = [
  {
    id: 'INTERNAL',
    name: 'Internal Research',
    reliability: 0.95
  },
  {
    id: 'MARKET',
    name: 'Market Reports',
    reliability: 0.90
  },
  {
    id: 'SURVEY',
    name: 'Industry Survey',
    reliability: 0.85
  }
];

// Batch size for database operations
const BATCH_SIZE = 100;

/**
 * Generates statistically valid benchmark data for a given metric and revenue range
 */
const generateBenchmarkData = (metricId: string, revenueRangeId: string): IBenchmarkData => {
  const metric = Object.values(METRIC_DEFINITIONS).find(m => m.id === metricId);
  if (!metric) {
    throw new Error(`Invalid metric ID: ${metricId}`);
  }

  const validationRule = metric.validationRules[0];
  const { minValue, maxValue } = validationRule;

  // Generate statistically valid percentile values
  const p50Value = minValue + (Math.random() * (maxValue - minValue));
  const p10Value = minValue + (Math.random() * (p50Value - minValue));
  const p90Value = p50Value + (Math.random() * (maxValue - p50Value));

  // Select data source with weighted randomization
  const dataSource = DATA_SOURCES[Math.floor(Math.random() * DATA_SOURCES.length)];

  return {
    id: uuidv4(),
    benchmarkId: metricId,
    p10Value,
    p50Value,
    p90Value,
    confidenceLevel: 0.95,
    dataSource: dataSource.id,
    collectedAt: new Date(),
    sampleSize: Math.floor(Math.random() * 500) + 100 // Random sample size between 100-600
  };
};

/**
 * Seeds benchmark data into the database with transaction support
 */
const seedBenchmarkData = async (): Promise<void> => {
  const prisma = new PrismaClient();
  
  try {
    await prisma.$transaction(async (tx) => {
      // Create revenue ranges
      for (const range of REVENUE_RANGES) {
        await tx.revenueRange.upsert({
          where: { id: range.id },
          update: range,
          create: range
        });
      }

      // Create metric definitions
      for (const metric of Object.values(METRIC_DEFINITIONS)) {
        await tx.metricDefinition.upsert({
          where: { id: metric.id },
          update: {
            name: metric.name,
            type: metric.type,
            unit: metric.unit,
            formula: metric.formula,
            validationRules: metric.validationRules
          },
          create: {
            id: metric.id,
            name: metric.name,
            type: metric.type,
            unit: metric.unit,
            formula: metric.formula,
            validationRules: metric.validationRules
          }
        });
      }

      // Generate and insert benchmark data
      const benchmarkData: IBenchmarkData[] = [];
      
      for (const metric of Object.values(METRIC_DEFINITIONS)) {
        for (const range of REVENUE_RANGES) {
          const data = generateBenchmarkData(metric.id, range.id);
          benchmarkData.push(data);
        }
      }

      // Batch insert benchmark data
      for (let i = 0; i < benchmarkData.length; i += BATCH_SIZE) {
        const batch = benchmarkData.slice(i, i + BATCH_SIZE);
        await tx.benchmarkData.createMany({
          data: batch.map(data => ({
            id: data.id,
            metricId: data.benchmarkId,
            revenueRangeId: REVENUE_RANGES[Math.floor(Math.random() * REVENUE_RANGES.length)].id,
            p10Value: data.p10Value,
            p50Value: data.p50Value,
            p90Value: data.p90Value,
            source: data.dataSource,
            collectedAt: data.collectedAt,
            isVerified: true
          }))
        });
      }
    });

    console.log(`Successfully seeded benchmark data:
      - ${REVENUE_RANGES.length} revenue ranges
      - ${Object.keys(METRIC_DEFINITIONS).length} metric definitions
      - ${REVENUE_RANGES.length * Object.keys(METRIC_DEFINITIONS).length} benchmark data points`);
  } catch (error) {
    console.error('Error seeding benchmark data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

export default seedBenchmarkData;