import { describe, it, expect, beforeEach } from '@jest/globals';
import { MetricsController } from '../../../backend/src/metrics-service/src/controllers/metrics.controller';
import { mockMetricDefinitions, generateMockMetricValue, generateMockTimeSeriesData } from '../../mocks/metric-data.mock';
import { validateMetricCalculation, DEFAULT_TOLERANCE } from '../../utils/metric-helpers';
import { MetricTimeframe } from '../../../backend/src/shared/types/metric-types';

// Mock services
const mockMetricsService = {
  createMetricBatch: jest.fn(),
  calculateMetricBatch: jest.fn(),
  recordMetricValueBatch: jest.fn(),
  getMetricHistoryPaginated: jest.fn(),
  checkHealth: jest.fn()
};

const mockCacheService = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn()
};

const mockCircuitBreaker = {
  fire: jest.fn()
};

describe('MetricsController', () => {
  let metricsController: MetricsController;

  beforeEach(() => {
    jest.clearAllMocks();
    metricsController = new MetricsController(mockMetricsService as any);
  });

  describe('createMetricBatch', () => {
    it('should successfully create multiple metric definitions', async () => {
      const metricDefinitions = [
        mockMetricDefinitions.NET_DOLLAR_RETENTION,
        mockMetricDefinitions.CAC_PAYBACK
      ];

      mockMetricsService.createMetricBatch.mockResolvedValue(metricDefinitions);

      const result = await metricsController.createMetricBatch(metricDefinitions);

      expect(mockMetricsService.createMetricBatch).toHaveBeenCalledWith(metricDefinitions);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(mockMetricDefinitions.NET_DOLLAR_RETENTION.id);
    });

    it('should reject empty batch requests', async () => {
      await expect(metricsController.createMetricBatch([])).rejects.toThrow('Invalid batch input');
    });

    it('should enforce batch size limits', async () => {
      const largeBatch = Array(101).fill(mockMetricDefinitions.NET_DOLLAR_RETENTION);
      await expect(metricsController.createMetricBatch(largeBatch)).rejects.toThrow('Batch size exceeds limit');
    });
  });

  describe('calculateMetricBatch', () => {
    const batchRequest = {
      companyId: 'test-company',
      metricIds: [
        mockMetricDefinitions.NET_DOLLAR_RETENTION.id,
        mockMetricDefinitions.CAC_PAYBACK.id
      ],
      timeframe: MetricTimeframe.MONTHLY,
      startDate: new Date('2023-01-01'),
      endDate: new Date('2023-12-31')
    };

    it('should calculate multiple metrics with caching', async () => {
      const mockResult = {
        results: [
          { metricId: batchRequest.metricIds[0], value: 120, status: 'SUCCESS' },
          { metricId: batchRequest.metricIds[1], value: 12, status: 'SUCCESS' }
        ],
        auditTrail: {
          processedAt: new Date(),
          duration: 150,
          cacheHits: 1
        }
      };

      mockCircuitBreaker.fire.mockResolvedValue(mockResult);

      const result = await metricsController.calculateMetricBatch(batchRequest);

      expect(result.results).toHaveLength(2);
      result.results.forEach(metricResult => {
        const validationResult = validateMetricCalculation(
          metricResult.value,
          mockMetricDefinitions[metricResult.metricId],
          { tolerance: DEFAULT_TOLERANCE }
        );
        expect(validationResult.isValid).toBe(true);
      });
    });

    it('should handle circuit breaker failures gracefully', async () => {
      mockCircuitBreaker.fire.mockRejectedValue(new Error('Circuit breaker open'));

      await expect(metricsController.calculateMetricBatch(batchRequest))
        .rejects.toThrow('Circuit breaker open');
    });
  });

  describe('recordMetricValueBatch', () => {
    it('should record multiple metric values with validation', async () => {
      const metricValues = [
        generateMockMetricValue(mockMetricDefinitions.NET_DOLLAR_RETENTION.id, 150),
        generateMockMetricValue(mockMetricDefinitions.CAC_PAYBACK.id, 24)
      ];

      const mockResult = {
        results: metricValues.map(value => ({
          id: value.id,
          status: 'SUCCESS'
        })),
        summary: {
          total: 2,
          successful: 2,
          failed: 0
        }
      };

      mockMetricsService.recordMetricValueBatch.mockResolvedValue(mockResult);

      const result = await metricsController.recordMetricValueBatch(metricValues);

      expect(result.summary.successful).toBe(2);
      expect(result.summary.failed).toBe(0);
      expect(mockMetricsService.recordMetricValueBatch).toHaveBeenCalledWith(metricValues);
    });

    it('should validate values against metric definitions', async () => {
      const invalidValues = [
        generateMockMetricValue(mockMetricDefinitions.NET_DOLLAR_RETENTION.id, 250), // Above max
        generateMockMetricValue(mockMetricDefinitions.CAC_PAYBACK.id, -5) // Below min
      ];

      const result = await metricsController.recordMetricValueBatch(invalidValues);

      expect(result.summary.failed).toBeGreaterThan(0);
      expect(result.summary.successful).toBeLessThan(2);
    });
  });

  describe('getMetricHistoryPaginated', () => {
    const historyRequest = {
      metricId: mockMetricDefinitions.NET_DOLLAR_RETENTION.id,
      companyId: 'test-company',
      page: 1,
      limit: 20
    };

    it('should retrieve paginated metric history with caching', async () => {
      const mockHistory = {
        data: generateMockTimeSeriesData(
          historyRequest.metricId,
          new Date('2023-01-01'),
          new Date('2023-12-31')
        ),
        meta: {
          page: 1,
          limit: 20,
          total: 12,
          pages: 1
        }
      };

      mockMetricsService.getMetricHistoryPaginated.mockResolvedValue(mockHistory);

      const result = await metricsController.getMetricHistoryPaginated(
        historyRequest.metricId,
        historyRequest.companyId,
        { page: historyRequest.page, limit: historyRequest.limit }
      );

      expect(result.data).toHaveLength(12);
      expect(result.meta.page).toBe(1);
      expect(result.meta.total).toBe(12);
    });

    it('should handle invalid pagination parameters', async () => {
      await expect(metricsController.getMetricHistoryPaginated(
        historyRequest.metricId,
        historyRequest.companyId,
        { page: -1, limit: 0 }
      )).rejects.toThrow();
    });
  });

  describe('healthCheck', () => {
    it('should return system health status', async () => {
      const mockHealth = {
        isHealthy: true,
        details: {
          database: true,
          cache: true,
          calculator: true
        }
      };

      mockMetricsService.checkHealth.mockResolvedValue(mockHealth);

      const result = await metricsController.healthCheck();

      expect(result.status).toBe('healthy');
      expect(result.version).toBe('1.0.0');
      expect(result.details).toEqual(mockHealth.details);
    });

    it('should indicate unhealthy status when services fail', async () => {
      const mockHealth = {
        isHealthy: false,
        details: {
          database: false,
          cache: true,
          calculator: true
        }
      };

      mockMetricsService.checkHealth.mockResolvedValue(mockHealth);

      const result = await metricsController.healthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.details.database).toBe(false);
    });
  });
});