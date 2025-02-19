import { renderHook, act } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { useBenchmark } from '../../src/hooks/useBenchmark';
import { IBenchmarkData } from '../../src/interfaces/benchmark.interface';
import { ERROR_CODES } from '../../src/constants/api.constants';

// Enable fetch mocks
require('jest-fetch-mock').enableMocks();

// Mock data for tests
const mockBenchmarkData: IBenchmarkData = {
  id: 'benchmark-1',
  metricId: 'arr',
  revenueRangeId: 'range-1',
  p10Value: 800000,
  p25Value: 900000,
  p50Value: 1000000,
  p75Value: 1200000,
  p90Value: 1500000,
  source: 'industry-data',
  collectedAt: new Date()
};

// Mock store setup
const mockStore = configureStore({
  reducer: {
    benchmark: (state = {}, action) => state
  }
});

// Test wrapper component
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <Provider store={mockStore}>{children}</Provider>
);

describe('useBenchmark', () => {
  // Global test timeout
  jest.setTimeout(3000);

  beforeAll(() => {
    // Configure global test environment
    global.fetch = require('jest-fetch-mock');
  });

  beforeEach(() => {
    // Reset mocks before each test
    fetchMock.resetMocks();
    localStorage.clear();
    jest.clearAllMocks();
  });

  describe('fetchBenchmarkData', () => {
    it('should fetch and cache benchmark data successfully', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({ data: mockBenchmarkData }));

      const { result } = renderHook(() => useBenchmark(), { wrapper });

      await act(async () => {
        await result.current.fetchBenchmarkData('arr', 'range-1');
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('should return cached data within cache duration', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({ data: mockBenchmarkData }));

      const { result } = renderHook(() => useBenchmark(), { wrapper });

      // First fetch
      await act(async () => {
        await result.current.fetchBenchmarkData('arr', 'range-1');
      });

      // Second fetch should use cache
      await act(async () => {
        await result.current.fetchBenchmarkData('arr', 'range-1');
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('should handle network errors with retry logic', async () => {
      fetchMock
        .mockRejectOnce(new Error('Network error'))
        .mockResponseOnce(JSON.stringify({ data: mockBenchmarkData }));

      const { result } = renderHook(() => useBenchmark(), { wrapper });

      await act(async () => {
        await result.current.fetchBenchmarkData('arr', 'range-1');
      });

      expect(result.current.error).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should respect force refresh parameter', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({ data: mockBenchmarkData }));

      const { result } = renderHook(() => useBenchmark(), { wrapper });

      await act(async () => {
        await result.current.fetchBenchmarkData('arr', 'range-1', true);
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('compareToBenchmark', () => {
    it('should calculate comparison metrics correctly', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({ 
        data: { 
          ...mockBenchmarkData,
          percentile: 75
        }
      }));

      const { result } = renderHook(() => useBenchmark(), { wrapper });

      await act(async () => {
        const comparison = await result.current.compareToBenchmark(1200000, 'arr', 'range-1');
        expect(comparison).toBeTruthy();
        expect(comparison?.percentile).toBe(75);
      });
    });

    it('should handle invalid comparison values', async () => {
      const { result } = renderHook(() => useBenchmark(), { wrapper });

      await act(async () => {
        const comparison = await result.current.compareToBenchmark(NaN, 'arr', 'range-1');
        expect(comparison).toBeNull();
        expect(result.current.error?.code).toBe(ERROR_CODES.DATA.VALIDATION_ERROR);
      });
    });
  });

  describe('cache management', () => {
    it('should cleanup expired cache entries', async () => {
      jest.useFakeTimers();
      fetchMock.mockResponseOnce(JSON.stringify({ data: mockBenchmarkData }));

      const { result } = renderHook(() => useBenchmark(), { wrapper });

      await act(async () => {
        await result.current.fetchBenchmarkData('arr', 'range-1');
      });

      // Fast forward past cache duration
      jest.advanceTimersByTime(16 * 60 * 1000);

      const cacheStatus = result.current.getCacheStatus();
      expect(cacheStatus.size).toBe(0);

      jest.useRealTimers();
    });

    it('should provide accurate cache statistics', async () => {
      fetchMock.mockResponseOnce(JSON.stringify({ data: mockBenchmarkData }));

      const { result } = renderHook(() => useBenchmark(), { wrapper });

      await act(async () => {
        await result.current.fetchBenchmarkData('arr', 'range-1');
      });

      const cacheStatus = result.current.getCacheStatus();
      expect(cacheStatus.size).toBe(1);
      expect(cacheStatus.oldestEntry).toBeTruthy();
    });
  });

  describe('performance requirements', () => {
    it('should complete operations within 2 second SLA', async () => {
      const startTime = Date.now();
      
      const { result } = renderHook(() => useBenchmark(), { wrapper });

      await act(async () => {
        await result.current.fetchBenchmarkData('arr', 'range-1');
        await result.current.compareToBenchmark(1200000, 'arr', 'range-1');
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('error handling', () => {
    it('should handle service unavailable errors', async () => {
      fetchMock.mockRejectOnce(new Error(ERROR_CODES.SYS.SERVICE_UNAVAILABLE));

      const { result } = renderHook(() => useBenchmark(), { wrapper });

      await act(async () => {
        await result.current.fetchBenchmarkData('arr', 'range-1');
      });

      expect(result.current.error?.code).toBe(ERROR_CODES.SYS.SERVICE_UNAVAILABLE);
      expect(result.current.error?.retry).toBeDefined();
    });

    it('should handle rate limiting errors', async () => {
      fetchMock.mockRejectOnce(new Error(ERROR_CODES.SYS.RATE_LIMIT));

      const { result } = renderHook(() => useBenchmark(), { wrapper });

      await act(async () => {
        await result.current.fetchBenchmarkData('arr', 'range-1');
      });

      expect(result.current.error?.code).toBe(ERROR_CODES.SYS.RATE_LIMIT);
    });

    it('should provide retry capability for recoverable errors', async () => {
      fetchMock
        .mockRejectOnce(new Error(ERROR_CODES.SYS.SERVICE_UNAVAILABLE))
        .mockResponseOnce(JSON.stringify({ data: mockBenchmarkData }));

      const { result } = renderHook(() => useBenchmark(), { wrapper });

      await act(async () => {
        await result.current.fetchBenchmarkData('arr', 'range-1');
        if (result.current.error?.retry) {
          await result.current.error.retry();
        }
      });

      expect(result.current.error).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});