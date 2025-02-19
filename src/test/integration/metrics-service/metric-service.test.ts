import { jest } from '@jest/globals'; // v29.0.0
import { PrismaClient } from '@prisma/client'; // v4.0.0
import Redis from 'ioredis'; // v5.0.0
import { TestUtils } from '@testing-library/utils'; // v1.0.0
import { MetricsService } from '../../../backend/src/metrics-service/src/services/metrics.service';
import { mockMetricDefinitions } from '../../mocks/metric-data.mock';
import { MetricTimeframe, MetricUnit } from '../../../backend/src/shared/types/metric-types';
import { IMetricCalculationParams } from '../../../backend/src/shared/interfaces/metric.interface';

// Test configuration constants
const PERFORMANCE_THRESHOLD_MS = 2000; // 2 second SLA requirement
const ACCURACY_THRESHOLD = 99.9; // 99.9% accuracy requirement
const TEST_COMPANY_ID = 'test-company-123';
const TEST_TIMEFRAME = MetricTimeframe.MONTHLY;

describe('MetricsService Integration Tests', () => {
  let metricsService: MetricsService;
  let prisma: PrismaClient;
  let redis: Redis;
  let testUtils: TestUtils;

  beforeAll(async () => {
    // Initialize test dependencies
    prisma = new PrismaClient({
      datasources: { db: { url: process.env.TEST_DATABASE_URL } }
    });

    redis = new Redis({
      host: process.env.TEST_REDIS_HOST,
      port: parseInt(process.env.TEST_REDIS_PORT || '6379'),
      password: process.env.TEST_REDIS_PASSWORD
    });

    testUtils = new TestUtils({
      performanceThreshold: PERFORMANCE_THRESHOLD_MS,
      accuracyThreshold: ACCURACY_THRESHOLD
    });

    metricsService = new MetricsService(prisma, redis, console);

    // Verify connections
    await prisma.$connect();
    await redis.ping();

    // Clean test data
    await prisma.metricValue.deleteMany({ where: { companyId: TEST_COMPANY_ID } });
    await redis.flushall();
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.metricValue.deleteMany({ where: { companyId: TEST_COMPANY_ID } });
    await redis.flushall();

    // Close connections
    await prisma.$disconnect();
    await redis.quit();
  });

  describe('Metric Calculation Accuracy Tests', () => {
    test('should calculate Net Dollar Retention with 99.9% accuracy', async () => {
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-12-31');
      
      const params: IMetricCalculationParams = {
        metricId: mockMetricDefinitions.NET_DOLLAR_RETENTION.id,
        companyId: TEST_COMPANY_ID,
        startDate,
        endDate,
        timeframe: TEST_TIMEFRAME
      };

      // Record test data
      await metricsService.recordMetricValue({
        metricId: params.metricId,
        companyId: params.companyId,
        value: 100000, // Starting ARR
        timestamp: startDate
      });

      await metricsService.recordMetricValue({
        metricId: params.metricId,
        companyId: params.companyId,
        value: 125000, // Ending ARR
        timestamp: endDate
      });

      const result = await metricsService.calculateMetric(params);
      const expectedNDR = 125; // 125% NDR

      expect(Math.abs(result - expectedNDR)).toBeLessThan(0.1); // 99.9% accuracy
    });

    test('should calculate CAC Payback with 99.9% accuracy', async () => {
      const params: IMetricCalculationParams = {
        metricId: mockMetricDefinitions.CAC_PAYBACK.id,
        companyId: TEST_COMPANY_ID,
        startDate: new Date(),
        endDate: new Date(),
        timeframe: TEST_TIMEFRAME
      };

      await metricsService.recordMetricValue({
        metricId: params.metricId,
        companyId: params.companyId,
        value: 12000, // CAC
        timestamp: params.startDate
      });

      const result = await metricsService.calculateMetric(params);
      const expectedCACPayback = 12; // 12 months

      expect(Math.abs(result - expectedCACPayback)).toBeLessThan(0.1);
    });
  });

  describe('Performance Tests', () => {
    test('should complete batch calculations within 2 second SLA', async () => {
      const startTime = Date.now();
      const batchRequest = {
        companyId: TEST_COMPANY_ID,
        metricIds: [
          mockMetricDefinitions.NET_DOLLAR_RETENTION.id,
          mockMetricDefinitions.CAC_PAYBACK.id,
          mockMetricDefinitions.MAGIC_NUMBER.id
        ],
        timeframe: TEST_TIMEFRAME,
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31')
      };

      const result = await metricsService.calculateMetricBatch(batchRequest);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
      expect(result.results.length).toBe(batchRequest.metricIds.length);
      expect(result.auditTrail.duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    });
  });

  describe('Caching Tests', () => {
    test('should properly cache and retrieve metric calculations', async () => {
      const params: IMetricCalculationParams = {
        metricId: mockMetricDefinitions.GROSS_MARGINS.id,
        companyId: TEST_COMPANY_ID,
        startDate: new Date(),
        endDate: new Date(),
        timeframe: TEST_TIMEFRAME
      };

      // First calculation - should cache
      const firstResult = await metricsService.calculateMetric(params);
      
      // Get from cache
      const cachedResult = await metricsService.getCachedMetric(
        params.companyId,
        params.metricId,
        params.timeframe
      );

      expect(cachedResult).toBeDefined();
      expect(cachedResult?.value).toBe(firstResult);
    });

    test('should invalidate cache on new metric values', async () => {
      const params: IMetricCalculationParams = {
        metricId: mockMetricDefinitions.PIPELINE_COVERAGE.id,
        companyId: TEST_COMPANY_ID,
        startDate: new Date(),
        endDate: new Date(),
        timeframe: TEST_TIMEFRAME
      };

      // Initial calculation
      const initialResult = await metricsService.calculateMetric(params);

      // Record new value
      await metricsService.recordMetricValue({
        metricId: params.metricId,
        companyId: params.companyId,
        value: 500,
        timestamp: new Date()
      });

      // Cache should be invalidated
      const cachedResult = await metricsService.getCachedMetric(
        params.companyId,
        params.metricId,
        params.timeframe
      );

      expect(cachedResult).toBeNull();
    });
  });

  describe('Validation Tests', () => {
    test('should validate metric calculations against defined ranges', async () => {
      const validationResult = await metricsService.validateMetricCalculation(
        mockMetricDefinitions.MAGIC_NUMBER.id,
        { value: 11 } // Outside valid range of 0-10
      );

      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors.length).toBeGreaterThan(0);
      expect(validationResult.errors[0].rule.type).toBe('RANGE');
    });

    test('should detect statistical anomalies in metric values', async () => {
      const params: IMetricCalculationParams = {
        metricId: mockMetricDefinitions.NET_DOLLAR_RETENTION.id,
        companyId: TEST_COMPANY_ID,
        startDate: new Date(),
        endDate: new Date(),
        timeframe: TEST_TIMEFRAME
      };

      // Record anomalous value
      await metricsService.recordMetricValue({
        metricId: params.metricId,
        companyId: params.companyId,
        value: 190, // Unusually high NDR
        timestamp: new Date()
      });

      const validationResult = await metricsService.validateMetricCalculation(
        params.metricId,
        { value: 190 }
      );

      expect(validationResult.warnings.length).toBeGreaterThan(0);
      expect(validationResult.warnings[0].type).toBe('STATISTICAL_ANOMALY');
    });
  });
});