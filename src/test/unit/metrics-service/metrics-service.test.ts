import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { MockInstance, SpyInstance } from 'jest-mock';
import { performance } from 'perf_hooks';
import { MetricsService } from '../../../backend/src/metrics-service/src/services/metrics.service';
import { mockMetricDefinitions } from '../../mocks/metric-data.mock';
import { 
  IMetricDefinition,
  IMetricValue,
  IMetricCalculationParams 
} from '../../../backend/src/shared/interfaces/metric.interface';
import { 
  MetricType,
  MetricUnit,
  MetricTimeframe 
} from '../../../backend/src/shared/types/metric-types';

// Constants for test configuration
const TEST_TIMEOUT = 5000;
const CALCULATION_PRECISION = 0.001; // 99.9% accuracy requirement
const PERFORMANCE_THRESHOLD = 2000; // 2 second performance requirement

// Mock implementations
const mockPrisma = {
  metricDefinition: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  },
  metricValue: {
    create: jest.fn(),
    findMany: jest.fn()
  },
  $transaction: jest.fn((callback) => callback(mockPrisma))
};

const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn()
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};

describe('MetricsService', () => {
  let metricsService: MetricsService;
  let performanceSpy: SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    performanceSpy = jest.spyOn(performance, 'now');
    metricsService = new MetricsService(
      mockPrisma as any,
      mockRedis as any,
      mockLogger as any
    );
  });

  afterEach(() => {
    performanceSpy.mockRestore();
  });

  describe('createMetric', () => {
    it('should create valid metric definition with all required fields', async () => {
      const metricDef: IMetricDefinition = {
        ...mockMetricDefinitions.NET_DOLLAR_RETENTION,
        id: undefined as any
      };

      mockPrisma.metricDefinition.create.mockResolvedValueOnce({
        ...metricDef,
        id: 'new-metric-id'
      });

      const startTime = performance.now();
      const result = await metricsService.createMetric(metricDef);
      const duration = performance.now() - startTime;

      expect(result).toBeDefined();
      expect(result.id).toBe('new-metric-id');
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD);
      expect(mockPrisma.metricDefinition.create).toHaveBeenCalledWith({
        data: metricDef
      });
    });

    it('should reject metric definition with invalid formula', async () => {
      const invalidMetric = {
        ...mockMetricDefinitions.NET_DOLLAR_RETENTION,
        formula: 'invalid{formula'
      };

      await expect(metricsService.createMetric(invalidMetric))
        .rejects
        .toThrow('Invalid metric formula');
    });
  });

  describe('recordMetricValue', () => {
    it('should record valid metric value with timestamp', async () => {
      const metricValue: IMetricValue = {
        metricId: mockMetricDefinitions.NET_DOLLAR_RETENTION.id,
        companyId: 'test-company',
        value: 110,
        timeframe: MetricTimeframe.MONTHLY,
        recordedAt: new Date()
      } as any;

      mockPrisma.metricDefinition.findUnique.mockResolvedValueOnce(
        mockMetricDefinitions.NET_DOLLAR_RETENTION
      );
      mockPrisma.metricValue.create.mockResolvedValueOnce({
        ...metricValue,
        id: 'new-value-id'
      });

      const startTime = performance.now();
      const result = await metricsService.recordMetricValue(metricValue);
      const duration = performance.now() - startTime;

      expect(result.id).toBe('new-value-id');
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD);
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should validate value against metric definition rules', async () => {
      const invalidValue: IMetricValue = {
        metricId: mockMetricDefinitions.NET_DOLLAR_RETENTION.id,
        companyId: 'test-company',
        value: 250, // Above max 200%
        timeframe: MetricTimeframe.MONTHLY,
        recordedAt: new Date()
      } as any;

      mockPrisma.metricDefinition.findUnique.mockResolvedValueOnce(
        mockMetricDefinitions.NET_DOLLAR_RETENTION
      );

      await expect(metricsService.recordMetricValue(invalidValue))
        .rejects
        .toThrow('Value exceeds maximum allowed range');
    });
  });

  describe('calculateMetric', () => {
    it('should calculate NDR with 99.9% accuracy', async () => {
      const params: IMetricCalculationParams = {
        metricId: mockMetricDefinitions.NET_DOLLAR_RETENTION.id,
        companyId: 'test-company',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31'),
        timeframe: MetricTimeframe.ANNUAL
      };

      const mockData = {
        startingARR: 1000000,
        expansions: 200000,
        contractions: 50000,
        churn: 50000
      };

      mockPrisma.metricValue.findMany.mockResolvedValueOnce([mockData]);

      const expectedNDR = ((mockData.startingARR + mockData.expansions - 
        mockData.contractions - mockData.churn) / mockData.startingARR) * 100;

      const startTime = performance.now();
      const result = await metricsService.calculateMetric(params);
      const duration = performance.now() - startTime;

      expect(Math.abs(result - expectedNDR)).toBeLessThan(CALCULATION_PRECISION);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD);
    });

    it('should calculate CAC Payback with correct time periods', async () => {
      const params: IMetricCalculationParams = {
        metricId: mockMetricDefinitions.CAC_PAYBACK.id,
        companyId: 'test-company',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31'),
        timeframe: MetricTimeframe.ANNUAL
      };

      const mockData = {
        cac: 12000,
        arr: 24000,
        grossMargin: 0.8
      };

      mockPrisma.metricValue.findMany.mockResolvedValueOnce([mockData]);

      const expectedCACPayback = (mockData.cac / 
        (mockData.arr * mockData.grossMargin)) * 12;

      const startTime = performance.now();
      const result = await metricsService.calculateMetric(params);
      const duration = performance.now() - startTime;

      expect(Math.abs(result - expectedCACPayback))
        .toBeLessThan(CALCULATION_PRECISION);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD);
    });
  });

  describe('getMetricHistory', () => {
    it('should retrieve complete metric history', async () => {
      const params = {
        metricId: mockMetricDefinitions.NET_DOLLAR_RETENTION.id,
        companyId: 'test-company',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31')
      };

      const mockHistory = Array.from({ length: 12 }, (_, i) => ({
        id: `value-${i}`,
        value: 100 + i,
        recordedAt: new Date(`2023-${i + 1}-01`)
      }));

      mockPrisma.metricValue.findMany.mockResolvedValueOnce(mockHistory);

      const startTime = performance.now();
      const result = await metricsService.getMetricHistory(params);
      const duration = performance.now() - startTime;

      expect(result).toHaveLength(12);
      expect(result).toBeSortedBy('recordedAt');
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD);
    });

    it('should handle large dataset retrieval', async () => {
      const params = {
        metricId: mockMetricDefinitions.NET_DOLLAR_RETENTION.id,
        companyId: 'test-company',
        startDate: new Date('2020-01-01'),
        endDate: new Date('2023-12-31')
      };

      const mockHistory = Array.from({ length: 1000 }, (_, i) => ({
        id: `value-${i}`,
        value: 100 + (i % 100),
        recordedAt: new Date(params.startDate.getTime() + i * 86400000)
      }));

      mockPrisma.metricValue.findMany.mockResolvedValueOnce(mockHistory);

      const startTime = performance.now();
      const result = await metricsService.getMetricHistory(params);
      const duration = performance.now() - startTime;

      expect(result).toHaveLength(1000);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD);
    });
  });
});