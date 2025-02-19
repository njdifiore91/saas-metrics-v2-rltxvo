import { renderHook, act } from '@testing-library/react-hooks';
import { useMetrics } from '../../src/hooks/useMetrics';
import { metricService } from '../../src/services/metric.service';
import { MetricType, MetricTimeframe, MetricValidationType } from '../../src/types/metric.types';

// Mock the metric service
jest.mock('../../src/services/metric.service');

// Mock Redux hooks
jest.mock('../../src/store', () => ({
  useAppDispatch: jest.fn(),
  useAppSelector: jest.fn()
}));

describe('useMetrics', () => {
  // Test data setup
  const mockCompanyId = 'company-123';
  const mockMetricDefinitions = [
    {
      id: 'metric-1',
      name: 'Net Dollar Retention',
      type: MetricType.RETENTION,
      validationRules: [
        {
          type: MetricValidationType.RANGE,
          minValue: 0,
          maxValue: 200,
          required: true,
          errorMessage: 'NDR must be between 0-200%'
        }
      ]
    },
    {
      id: 'metric-2',
      name: 'CAC Payback',
      type: MetricType.EFFICIENCY,
      validationRules: [
        {
          type: MetricValidationType.RANGE,
          minValue: 0,
          maxValue: 60,
          required: true,
          errorMessage: 'CAC Payback must be between 0-60 months'
        }
      ]
    }
  ];

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Setup mock implementations
    (metricService.getMetricDefinitions as jest.Mock).mockResolvedValue(mockMetricDefinitions);
    (metricService.validateMetricBatch as jest.Mock).mockResolvedValue([
      { metricId: 'metric-1', isValid: true, errors: [] }
    ]);
    (metricService.calculateMetricBatch as jest.Mock).mockResolvedValue([
      { metricId: 'metric-1', value: 125 }
    ]);
  });

  describe('initialization', () => {
    it('should initialize with default options', () => {
      const { result } = renderHook(() => useMetrics(mockCompanyId));

      expect(result.current.metricDefinitions).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should fetch metric definitions on mount', async () => {
      const { result, waitForNextUpdate } = renderHook(() => useMetrics(mockCompanyId));

      await waitForNextUpdate();

      expect(metricService.getMetricDefinitions).toHaveBeenCalled();
      expect(result.current.metricDefinitions).toEqual(mockMetricDefinitions);
    });
  });

  describe('metric calculations', () => {
    it('should calculate NDR within valid range', async () => {
      const { result } = renderHook(() => useMetrics(mockCompanyId));

      await act(async () => {
        await result.current.calculateMetrics([
          { metricId: 'metric-1', value: 125 }
        ]);
      });

      expect(metricService.calculateMetricBatch).toHaveBeenCalledWith([
        expect.objectContaining({
          metricId: 'metric-1',
          value: 125
        })
      ]);
    });

    it('should handle batch calculations with progress tracking', async () => {
      const { result } = renderHook(() => useMetrics(mockCompanyId));

      await act(async () => {
        await result.current.calculateMetrics([
          { metricId: 'metric-1', value: 125 },
          { metricId: 'metric-2', value: 12 }
        ]);
      });

      expect(result.current.progress).toBe(100);
    });

    it('should validate metrics before calculation', async () => {
      const { result } = renderHook(() => useMetrics(mockCompanyId, { validateOnChange: true }));

      await act(async () => {
        await result.current.calculateMetrics([
          { metricId: 'metric-1', value: 250 } // Invalid value
        ]);
      });

      expect(metricService.validateMetricBatch).toHaveBeenCalled();
      expect(result.current.error).not.toBeNull();
    });
  });

  describe('caching behavior', () => {
    it('should cache calculation results', async () => {
      const { result } = renderHook(() => useMetrics(mockCompanyId));

      await act(async () => {
        await result.current.calculateMetrics([
          { metricId: 'metric-1', value: 125 }
        ]);
      });

      const cachedValue = result.current.getCachedMetrics('metric-1');
      expect(cachedValue).toBe(125);
    });

    it('should invalidate cache after timeout', async () => {
      const { result } = renderHook(() => 
        useMetrics(mockCompanyId, { cacheTimeout: 100 })
      );

      await act(async () => {
        await result.current.calculateMetrics([
          { metricId: 'metric-1', value: 125 }
        ]);
      });

      await new Promise(resolve => setTimeout(resolve, 150));

      const cachedValue = result.current.getCachedMetrics('metric-1');
      expect(cachedValue).toBeNull();
    });

    it('should clear cache manually', async () => {
      const { result } = renderHook(() => useMetrics(mockCompanyId));

      await act(async () => {
        await result.current.calculateMetrics([
          { metricId: 'metric-1', value: 125 }
        ]);
        result.current.clearMetricCache();
      });

      const cachedValue = result.current.getCachedMetrics('metric-1');
      expect(cachedValue).toBeNull();
    });
  });

  describe('validation', () => {
    it('should validate NDR within 0-200% range', async () => {
      const { result } = renderHook(() => useMetrics(mockCompanyId));

      await act(async () => {
        const validationResults = await result.current.validateMetrics([
          { metricId: 'metric-1', value: 250 }
        ]);
        expect(validationResults['metric-1'].isValid).toBe(false);
      });
    });

    it('should validate CAC Payback within 0-60 months', async () => {
      const { result } = renderHook(() => useMetrics(mockCompanyId));

      await act(async () => {
        const validationResults = await result.current.validateMetrics([
          { metricId: 'metric-2', value: 70 }
        ]);
        expect(validationResults['metric-2'].isValid).toBe(false);
      });
    });
  });

  describe('batch processing', () => {
    it('should process metrics in batches', async () => {
      const { result } = renderHook(() => 
        useMetrics(mockCompanyId, { batchSize: 2 })
      );

      const metrics = Array.from({ length: 5 }, (_, i) => ({
        metricId: `metric-${i}`,
        value: 100
      }));

      await act(async () => {
        await result.current.calculateMetrics(metrics);
      });

      expect(metricService.calculateMetricBatch).toHaveBeenCalledTimes(3);
    });

    it('should track batch processing progress', async () => {
      const { result } = renderHook(() => useMetrics(mockCompanyId));

      const progressValues: number[] = [];
      
      (metricService.calculateMetricBatch as jest.Mock).mockImplementation(() => {
        progressValues.push(result.current.progress);
        return Promise.resolve([]);
      });

      await act(async () => {
        await result.current.calculateMetrics([
          { metricId: 'metric-1', value: 100 },
          { metricId: 'metric-2', value: 100 }
        ]);
      });

      expect(progressValues).toEqual(expect.arrayContaining([0, 50, 100]));
    });
  });

  describe('error handling', () => {
    it('should handle calculation errors', async () => {
      (metricService.calculateMetricBatch as jest.Mock).mockRejectedValue(
        new Error('Calculation failed')
      );

      const { result } = renderHook(() => useMetrics(mockCompanyId));

      await act(async () => {
        await result.current.calculateMetrics([
          { metricId: 'metric-1', value: 100 }
        ]);
      });

      expect(result.current.error).toEqual({
        code: 'CALCULATION_ERROR',
        message: 'Calculation failed'
      });
    });

    it('should handle validation errors', async () => {
      (metricService.validateMetricBatch as jest.Mock).mockRejectedValue(
        new Error('Validation failed')
      );

      const { result } = renderHook(() => useMetrics(mockCompanyId));

      await act(async () => {
        await result.current.validateMetrics([
          { metricId: 'metric-1', value: 100 }
        ]);
      });

      expect(result.current.error).toEqual({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed'
      });
    });
  });

  describe('auto-refresh behavior', () => {
    it('should auto-refresh metric definitions', async () => {
      jest.useFakeTimers();

      const { result } = renderHook(() => 
        useMetrics(mockCompanyId, { 
          autoRefresh: true,
          cacheTimeout: 1000 
        })
      );

      await act(async () => {
        jest.advanceTimersByTime(1100);
      });

      expect(metricService.getMetricDefinitions).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('should not auto-refresh when disabled', async () => {
      jest.useFakeTimers();

      const { result } = renderHook(() => 
        useMetrics(mockCompanyId, { 
          autoRefresh: false,
          cacheTimeout: 1000 
        })
      );

      await act(async () => {
        jest.advanceTimersByTime(1100);
      });

      expect(metricService.getMetricDefinitions).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });
  });
});