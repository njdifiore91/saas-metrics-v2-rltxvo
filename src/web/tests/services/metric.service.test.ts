import { jest } from '@jest/globals';
import '@testing-library/jest-dom';
import { metricService } from '../../src/services/metric.service';
import { apiService } from '../../src/services/api.service';
import { 
  METRIC_DEFINITIONS, 
  METRIC_VALIDATION_RULES,
  METRIC_CALCULATION_DEFAULTS 
} from '../../src/constants/metric.constants';
import { 
  MetricType, 
  MetricUnit, 
  MetricTimeframe,
  MetricValidationType 
} from '../../src/types/metric.types';
import { API_ENDPOINTS } from '../../src/constants/api.constants';

// Mock API service
jest.mock('../../src/services/api.service');

describe('MetricService Tests', () => {
  // Test data setup
  const mockMetricDefinition = {
    id: 'NDR',
    name: 'Net Dollar Retention',
    type: MetricType.RETENTION,
    unit: MetricUnit.PERCENTAGE,
    timeframe: MetricTimeframe.ANNUAL,
    validationRules: [{
      type: MetricValidationType.RANGE,
      minValue: 0,
      maxValue: 200,
      required: true,
      customValidation: null,
      errorMessage: 'Net Dollar Retention must be between 0% and 200%',
      priority: 1,
      validationContext: {}
    }]
  };

  const mockCalculationParams = {
    metricId: 'NDR',
    startDate: new Date('2023-01-01'),
    endDate: new Date('2023-12-31'),
    timeframe: MetricTimeframe.ANNUAL,
    comparisonPeriod: {
      start: new Date('2022-01-01'),
      end: new Date('2022-12-31')
    },
    aggregationMethod: 'average',
    filterCriteria: {
      revenueRange: '$1M-$5M'
    }
  };

  beforeAll(() => {
    // Global test environment setup
    jest.useFakeTimers();
  });

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    (apiService.get as jest.Mock).mockReset();
    (apiService.post as jest.Mock).mockReset();
  });

  afterEach(() => {
    // Cleanup after each test
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Global test environment cleanup
    jest.useRealTimers();
  });

  describe('getMetricDefinitions', () => {
    it('should fetch and cache metric definitions successfully', async () => {
      const mockResponse = { data: [mockMetricDefinition] };
      (apiService.get as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await metricService.getMetricDefinitions();
      
      expect(result).toEqual([mockMetricDefinition]);
      expect(apiService.get).toHaveBeenCalledWith(API_ENDPOINTS.METRICS.LIST);
      expect(apiService.get).toHaveBeenCalledTimes(1);

      // Test caching - second call should use cached data
      const cachedResult = await metricService.getMetricDefinitions();
      expect(apiService.get).toHaveBeenCalledTimes(1);
      expect(cachedResult).toEqual([mockMetricDefinition]);
    });

    it('should handle API errors gracefully', async () => {
      const errorMessage = 'Failed to fetch metrics';
      (apiService.get as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

      await expect(metricService.getMetricDefinitions())
        .rejects
        .toThrow(`Failed to fetch metric definitions: ${errorMessage}`);
    });

    it('should force refresh when requested', async () => {
      const mockResponse = { data: [mockMetricDefinition] };
      (apiService.get as jest.Mock).mockResolvedValueOnce(mockResponse);

      await metricService.getMetricDefinitions(true);
      expect(apiService.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('calculateMetricBatch', () => {
    const mockRequests = [{
      metricId: 'NDR',
      value: 110,
      params: mockCalculationParams
    }];

    const mockBenchmark = {
      data: {
        metricId: 'NDR',
        percentiles: { 50: 100, 75: 120, 90: 140 },
        industryAverage: 105,
        revenueRange: '$1M-$5M',
        timeframe: MetricTimeframe.ANNUAL
      }
    };

    const mockTrend = {
      data: {
        metricId: 'NDR',
        values: [{ date: new Date(), value: 110 }],
        growthRate: 0.1,
        seasonality: {}
      }
    };

    it('should calculate metrics in batch successfully', async () => {
      (apiService.get as jest.Mock)
        .mockResolvedValueOnce(mockBenchmark)
        .mockResolvedValueOnce(mockTrend);

      const results = await metricService.calculateMetricBatch(mockRequests);

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        metricId: 'NDR',
        value: 110,
        benchmark: mockBenchmark.data,
        trend: mockTrend.data
      });
    });

    it('should handle validation errors in batch calculations', async () => {
      const invalidRequest = [{
        metricId: 'NDR',
        value: 250, // Above max allowed value
        params: mockCalculationParams
      }];

      await expect(metricService.calculateMetricBatch(invalidRequest))
        .rejects
        .toThrow('Invalid metric value');
    });

    it('should use cached results when available', async () => {
      (apiService.get as jest.Mock)
        .mockResolvedValueOnce(mockBenchmark)
        .mockResolvedValueOnce(mockTrend);

      // First call - should make API requests
      await metricService.calculateMetricBatch(mockRequests);
      
      // Second call with same parameters - should use cache
      await metricService.calculateMetricBatch(mockRequests);
      
      expect(apiService.get).toHaveBeenCalledTimes(2); // Only from first call
    });
  });

  describe('validateMetricBatch', () => {
    const validMetrics = [{
      metricId: 'NDR',
      value: 110
    }];

    const invalidMetrics = [{
      metricId: 'NDR',
      value: 250 // Above max allowed value
    }];

    it('should validate correct metric values', async () => {
      const results = await metricService.validateMetricBatch(validMetrics);
      
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        metricId: 'NDR',
        isValid: true,
        errors: []
      });
    });

    it('should reject invalid metric values', async () => {
      const results = await metricService.validateMetricBatch(invalidMetrics);
      
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        metricId: 'NDR',
        isValid: false,
        errors: ['Net Dollar Retention must be between 0% and 200%']
      });
    });

    it('should handle missing validation rules', async () => {
      const unknownMetric = [{
        metricId: 'UNKNOWN_METRIC',
        value: 100
      }];

      await expect(metricService.validateMetricBatch(unknownMetric))
        .rejects
        .toThrow('No validation rules found for metric UNKNOWN_METRIC');
    });

    it('should validate multiple metrics efficiently', async () => {
      const multipleMetrics = [
        { metricId: 'NDR', value: 110 },
        { metricId: 'CAC_PAYBACK', value: 12 },
        { metricId: 'MAGIC_NUMBER', value: 1.5 }
      ];

      const results = await metricService.validateMetricBatch(multipleMetrics);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('Performance Tests', () => {
    it('should complete batch calculations within performance threshold', async () => {
      const start = performance.now();
      
      const batchRequests = Array(10).fill(null).map(() => ({
        metricId: 'NDR',
        value: 110,
        params: mockCalculationParams
      }));

      await metricService.calculateMetricBatch(batchRequests);
      
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should maintain cache hit ratio above threshold', async () => {
      const mockResponse = { data: [mockMetricDefinition] };
      (apiService.get as jest.Mock).mockResolvedValue(mockResponse);

      // Simulate multiple requests
      const requests = 100;
      let cacheHits = 0;

      for (let i = 0; i < requests; i++) {
        const result = await metricService.getMetricDefinitions();
        if (apiService.get.mock.calls.length === 1) {
          cacheHits++;
        }
      }

      const hitRatio = (cacheHits / requests) * 100;
      expect(hitRatio).toBeGreaterThan(85); // Cache hit ratio should be above 85%
    });
  });
});