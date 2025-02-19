import { PrismaClient } from '@prisma/client'; // v4.9.0
import { prisma, validateDatabaseConfig } from '../../backend/src/admin-service/src/config/database.config';
import { generateTestDataSet } from './test-data-generator';
import { MetricType, MetricTimeframe } from '../../backend/src/shared/types/metric-types';

// Constants for test database configuration
const TEST_DB_PREFIX = 'test_';
const TEST_TIMEOUT = 30000; // 30 seconds
const MAX_BATCH_SIZE = 100;
const CLEANUP_TABLES = [
  'benchmark_data',
  'metric_values',
  'metric_definitions',
  'companies',
  'revenue_ranges'
];

/**
 * Initializes test database connection with enhanced security and validation
 */
export async function setupTestDatabase(): Promise<void> {
  try {
    // Validate database configuration
    validateDatabaseConfig();

    // Ensure we're connecting to test database
    const dbUrl = getTestDatabaseUrl();
    if (!dbUrl.includes(TEST_DB_PREFIX)) {
      throw new Error('Must use test database for testing');
    }

    // Initialize database connection
    await prisma.$connect();

    // Verify database connection
    await prisma.$queryRaw`SELECT 1`;

    // Run any pending migrations
    await prisma.$executeRaw`SET statement_timeout = ${TEST_TIMEOUT}`;

    console.log('Test database setup completed successfully');
  } catch (error) {
    console.error('Failed to setup test database:', error);
    throw error;
  }
}

/**
 * Performs comprehensive cleanup of test database with verification
 */
export async function teardownTestDatabase(): Promise<void> {
  try {
    // Start cleanup transaction
    await prisma.$transaction(async (tx) => {
      // Clear all test data
      for (const table of CLEANUP_TABLES) {
        await tx.$executeRaw`TRUNCATE TABLE ${table} CASCADE`;
      }

      // Reset sequences
      await tx.$executeRaw`
        DO $$
        DECLARE
          seq record;
        BEGIN
          FOR seq IN SELECT sequence_name FROM information_schema.sequences
          LOOP
            EXECUTE 'ALTER SEQUENCE ' || seq.sequence_name || ' RESTART WITH 1';
          END LOOP;
        END $$;
      `;
    });

    // Verify cleanup
    const verificationPromises = CLEANUP_TABLES.map(async (table) => {
      const count = await prisma.$queryRaw`SELECT COUNT(*) FROM ${table}`;
      if (count[0].count > 0) {
        throw new Error(`Table ${table} was not properly cleaned up`);
      }
    });
    await Promise.all(verificationPromises);

    // Close connection
    await prisma.$disconnect();

    console.log('Test database teardown completed successfully');
  } catch (error) {
    console.error('Failed to teardown test database:', error);
    throw error;
  }
}

/**
 * Seeds test database with statistically validated test data
 */
export async function seedTestData(
  companyCount: number = 10,
  metricsPerCompany: number = 5
): Promise<object> {
  try {
    // Input validation
    if (companyCount <= 0 || metricsPerCompany <= 0) {
      throw new Error('Company count and metrics per company must be positive');
    }
    if (companyCount * metricsPerCompany > MAX_BATCH_SIZE) {
      throw new Error(`Maximum batch size of ${MAX_BATCH_SIZE} exceeded`);
    }

    // Generate test data
    const testData = generateTestDataSet({
      userCount: companyCount,
      metricsPerUser: metricsPerCompany,
      includeHistorical: true
    });

    // Seed data in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Insert companies
      const companies = await tx.company.createMany({
        data: testData.users.map(user => ({
          id: user.id,
          name: user.name,
          createdAt: user.createdAt
        }))
      });

      // Insert metric definitions
      const metrics = await tx.metricDefinition.createMany({
        data: testData.metrics.map(metric => ({
          id: metric.id,
          name: metric.name,
          description: metric.description,
          type: metric.type as MetricType,
          timeframe: metric.timeframe as MetricTimeframe,
          formula: metric.formula,
          createdAt: new Date(),
          updatedAt: new Date()
        }))
      });

      // Insert benchmark data
      const benchmarks = await tx.benchmarkData.createMany({
        data: testData.benchmarks.map(benchmark => ({
          id: benchmark.id,
          benchmarkId: benchmark.benchmarkId,
          p10Value: benchmark.p10Value,
          p25Value: benchmark.p25Value,
          p50Value: benchmark.p50Value,
          p75Value: benchmark.p75Value,
          p90Value: benchmark.p90Value,
          sampleSize: benchmark.sampleSize,
          confidenceLevel: benchmark.confidenceLevel
        }))
      });

      return {
        companies: companies.count,
        metrics: metrics.count,
        benchmarks: benchmarks.count
      };
    });

    console.log('Test data seeding completed successfully:', result);
    return result;
  } catch (error) {
    console.error('Failed to seed test data:', error);
    throw error;
  }
}

/**
 * Securely clears all test data with comprehensive verification
 */
export async function clearTestData(): Promise<void> {
  try {
    console.log('Starting test data cleanup...');

    // Clear data in transaction
    await prisma.$transaction(async (tx) => {
      for (const table of CLEANUP_TABLES) {
        await tx.$executeRaw`DELETE FROM ${table}`;
        
        // Verify deletion
        const count = await tx.$queryRaw`SELECT COUNT(*) FROM ${table}`;
        if (count[0].count > 0) {
          throw new Error(`Failed to clear data from ${table}`);
        }
      }

      // Reset sequences
      await tx.$executeRaw`
        DO $$
        DECLARE
          seq record;
        BEGIN
          FOR seq IN SELECT sequence_name FROM information_schema.sequences
          LOOP
            EXECUTE 'ALTER SEQUENCE ' || seq.sequence_name || ' RESTART WITH 1';
          END LOOP;
        END $$;
      `;
    });

    console.log('Test data cleanup completed successfully');
  } catch (error) {
    console.error('Failed to clear test data:', error);
    throw error;
  }
}

/**
 * Returns validated test database connection URL with security checks
 */
export function getTestDatabaseUrl(): string {
  const dbUrl = process.env.TEST_DATABASE_URL;
  if (!dbUrl) {
    throw new Error('TEST_DATABASE_URL environment variable is required');
  }

  // Validate URL format
  try {
    new URL(dbUrl);
  } catch {
    throw new Error('Invalid database URL format');
  }

  // Ensure test database prefix
  if (!dbUrl.includes(TEST_DB_PREFIX)) {
    throw new Error('Test database URL must include test_ prefix');
  }

  // Add security parameters
  const urlWithParams = new URL(dbUrl);
  urlWithParams.searchParams.append('sslmode', 'require');
  urlWithParams.searchParams.append('statement_timeout', TEST_TIMEOUT.toString());

  return urlWithParams.toString();
}