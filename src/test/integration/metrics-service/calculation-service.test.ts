/**
 * Integration Tests for CalculationService
 * Validates metric calculations, caching, and data validation with real dependencies
 * @version 1.0.0
 */

import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect } from '@jest/globals'; // v29.0.0
import Redis from 'ioredis'; // v5.0.0
import { performance } from 'perf_hooks';
import { CalculationService } from '../../../backend/src/metrics-service/src/services/calculation.service';
import { 
  validateMetricCalculation,
  generateTestMetricData,
  assertMetricCalculation,
  DEFAULT_TOLERANCE
} from '../../utils/metric-helpers';
import { mockMetricDefinitions } from '../../mocks/metric-data.mock';

// Test configuration constants
const TEST_TIMEOUT = 10000;
const CALCULATION_TOLERANCE = 0.001;
const CACHE_TTL = 3600;
const PERFORMANCE_THRESHOLD = 2000; // 2 seconds max response time

// Test environment setup
let calculationService: CalculationService;
let redisClient: Redis;
let testMetrics: Map<string, any>;

/**
 * Sets up test environment with Redis and required dependencies
 */
const setupTestEnvironment = async (): Promise<void> => {
  // Initialize Redis client for testing
  redisClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    db: 1 // Use separate database for testing
  });

  // Initialize calculation service
  calculationService = new CalculationService(redisClient);

  // Initialize test metrics
  testMetrics = new Map(Object.entries(mockMetricDefinitions));

  // Clear Redis test database
  await redisClient.flushdb();
};

/**
 * Cleans up test environment
 */
const cleanupTestEnvironment = async (): Promise<void> => {
  await redisClient.flushdb();
  await redisClient.quit();
};

/**
 * Measures execution time of an async operation
 */
const measurePerformance = async (operation: () => Promise<any>): Promise<number> => {
  const start = performance.now();
  await operation();
  return performance.now() - start;
};

describe('CalculationService Integration Tests', () => {
  beforeAll(async () => {
    await setupTestEnvironment();
  }, TEST_TIMEOUT);

  afterAll(async () => {
    await cleanupTestEnvironment();
  });

  beforeEach(async () => {
    await redisClient.flushdb();
  });

  describe('Net Dollar Retention Calculations', () => {
    it('should calculate NDR within valid range (0-200%)', async () => {
      const params = {
        metricId: mockMetricDefinitions.NET_DOLLAR_RETENTION.id,
        startingARR: 1000000,
        expansions: 200000,
        contractions: 50000,
        churn: 100000
      };

      const result = await calculationService.calculateMetric(params);
      
      const validationResult = validateMetricCalculation(
        result,
        mockMetricDefinitions.NET_DOLLAR_RETENTION,
        { tolerance: CALCULATION_TOLERANCE }
      );

      expect(validationResult.isValid).toBe(true);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(200);
    });

    it('should cache NDR calculations', async () => {
      const params = {
        metricId: mockMetricDefinitions.NET_DOLLAR_RETENTION.id,
        startingARR: 1000000,
        expansions: 200000,
        contractions: 50000,
        churn: 100000
      };

      // First calculation (cache miss)
      const cacheMissTime = await measurePerformance(async () => {
        await calculationService.calculateMetric(params);
      });

      // Second calculation (cache hit)
      const cacheHitTime = await measurePerformance(async () => {
        await calculationService.calculateMetric(params);
      });

      expect(cacheMissTime).toBeLessThan(PERFORMANCE_THRESHOLD);
      expect(cacheHitTime).toBeLessThan(cacheMissTime);
    });
  });

  describe('CAC Payback Period Calculations', () => {
    it('should calculate CAC Payback within valid range (0-60 months)', async () => {
      const params = {
        metricId: mockMetricDefinitions.CAC_PAYBACK.id,
        cac: 10000,
        arr: 120000,
        grossMargin: 80
      };

      const result = await calculationService.calculateMetric(params);
      
      const validationResult = validateMetricCalculation(
        result,
        mockMetricDefinitions.CAC_PAYBACK,
        { tolerance: CALCULATION_TOLERANCE }
      );

      expect(validationResult.isValid).toBe(true);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(60);
    });
  });

  describe('Magic Number Calculations', () => {
    it('should calculate Magic Number within valid range (0-10)', async () => {
      const params = {
        metricId: mockMetricDefinitions.MAGIC_NUMBER.id,
        netNewARR: 500000,
        previousQuarterSMSpend: 250000
      };

      const result = await calculationService.calculateMetric(params);
      
      const validationResult = validateMetricCalculation(
        result,
        mockMetricDefinitions.MAGIC_NUMBER,
        { tolerance: CALCULATION_TOLERANCE }
      );

      expect(validationResult.isValid).toBe(true);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(10);
    });
  });

  describe('Gross Margins Calculations', () => {
    it('should calculate Gross Margins within valid range (-100% to 100%)', async () => {
      const params = {
        metricId: mockMetricDefinitions.GROSS_MARGIN.id,
        revenue: 1000000,
        cogs: 600000
      };

      const result = await calculationService.calculateMetric(params);
      
      const validationResult = validateMetricCalculation(
        result,
        mockMetricDefinitions.GROSS_MARGIN,
        { tolerance: CALCULATION_TOLERANCE }
      );

      expect(validationResult.isValid).toBe(true);
      expect(result).toBeGreaterThanOrEqual(-100);
      expect(result).toBeLessThanOrEqual(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid input parameters', async () => {
      const params = {
        metricId: mockMetricDefinitions.NET_DOLLAR_RETENTION.id,
        startingARR: -1000000, // Invalid negative value
        expansions: 200000,
        contractions: 50000,
        churn: 100000
      };

      await expect(calculationService.calculateMetric(params))
        .rejects.toThrow('Invalid calculation parameters');
    });

    it('should handle cache connection errors gracefully', async () => {
      // Force Redis connection error
      await redisClient.quit();

      const params = {
        metricId: mockMetricDefinitions.NET_DOLLAR_RETENTION.id,
        startingARR: 1000000,
        expansions: 200000,
        contractions: 50000,
        churn: 100000
      };

      // Should still calculate without cache
      const result = await calculationService.calculateMetric(params);
      expect(result).toBeDefined();

      // Restore Redis connection for other tests
      redisClient = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        db: 1
      });
    });
  });

  describe('Performance Requirements', () => {
    it('should meet performance requirements for calculations', async () => {
      const params = {
        metricId: mockMetricDefinitions.NET_DOLLAR_RETENTION.id,
        startingARR: 1000000,
        expansions: 200000,
        contractions: 50000,
        churn: 100000
      };

      const executionTime = await measurePerformance(async () => {
        await calculationService.calculateMetric(params);
      });

      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLD);
    });

    it('should handle concurrent calculations efficiently', async () => {
      const calculations = Array(10).fill(null).map(() => ({
        metricId: mockMetricDefinitions.NET_DOLLAR_RETENTION.id,
        startingARR: 1000000 + Math.random() * 1000000,
        expansions: 200000,
        contractions: 50000,
        churn: 100000
      }));

      const startTime = performance.now();
      await Promise.all(calculations.map(params => 
        calculationService.calculateMetric(params)
      ));
      const totalTime = performance.now() - startTime;

      expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLD * 2);
    });
  });
});