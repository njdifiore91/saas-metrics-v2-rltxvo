import { useDispatch, useSelector } from 'react-redux'; // ^8.1.0
import { useState, useCallback, useRef } from 'react'; // ^18.2.0
import { IBenchmarkData, IBenchmarkComparison } from '../interfaces/benchmark.interface';
import { benchmarkService } from '../services/benchmark.service';
import { ERROR_CODES } from '../constants/api.constants';

/**
 * Cache entry type definition for benchmark data
 */
interface CacheEntry {
  data: IBenchmarkData;
  timestamp: number;
  expiresAt: number;
}

/**
 * Error state interface with retry capability
 */
interface BenchmarkError {
  code: string;
  message: string;
  retry?: () => Promise<void>;
}

/**
 * Custom hook for managing benchmark data and operations
 * Implements caching, error handling, and performance optimizations
 * @returns {Object} Hook interface for benchmark operations
 */
export const useBenchmark = () => {
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<BenchmarkError | null>(null);
  
  // Cache implementation with useRef for persistence across renders
  const cache = useRef<Map<string, CacheEntry>>(new Map());
  const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
  const MAX_RETRIES = 3;

  /**
   * Generates cache key for benchmark data
   */
  const getCacheKey = (metricId: string, revenueRangeId: string): string => {
    return `${metricId}-${revenueRangeId}`;
  };

  /**
   * Retrieves data from cache if valid
   */
  const getFromCache = (key: string): IBenchmarkData | null => {
    const entry = cache.current.get(key);
    if (!entry || Date.now() > entry.expiresAt) {
      cache.current.delete(key);
      return null;
    }
    return entry.data;
  };

  /**
   * Stores data in cache with expiration
   */
  const setCache = (key: string, data: IBenchmarkData): void => {
    cache.current.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + CACHE_DURATION
    });
  };

  /**
   * Fetches benchmark data with caching and error handling
   */
  const fetchBenchmarkData = useCallback(async (
    metricId: string,
    revenueRangeId: string,
    forceRefresh: boolean = false
  ): Promise<void> => {
    const cacheKey = getCacheKey(metricId, revenueRangeId);
    
    if (!forceRefresh) {
      const cachedData = getFromCache(cacheKey);
      if (cachedData) {
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    let retryCount = 0;
    const attemptFetch = async (): Promise<void> => {
      try {
        const data = await benchmarkService.getBenchmarkData(metricId, revenueRangeId);
        setCache(cacheKey, data);
        setIsLoading(false);
      } catch (err: any) {
        if (retryCount < MAX_RETRIES && err.code === ERROR_CODES.SYS.SERVICE_UNAVAILABLE) {
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          return attemptFetch();
        }
        
        setError({
          code: err.code || ERROR_CODES.SYS.SERVICE_UNAVAILABLE,
          message: err.message || 'Failed to fetch benchmark data',
          retry: () => attemptFetch()
        });
        setIsLoading(false);
      }
    };

    await attemptFetch();
  }, []);

  /**
   * Compares company metrics to benchmarks with optimistic updates
   */
  const compareToBenchmark = useCallback(async (
    companyValue: number,
    metricId: string,
    revenueRangeId: string
  ): Promise<IBenchmarkComparison | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const comparison = await benchmarkService.compareMetric(
        metricId,
        revenueRangeId,
        companyValue
      );
      setIsLoading(false);
      return comparison;
    } catch (err: any) {
      setError({
        code: err.code || ERROR_CODES.DATA.VALIDATION_ERROR,
        message: err.message || 'Failed to compare metrics',
        retry: () => compareToBenchmark(companyValue, metricId, revenueRangeId)
      });
      setIsLoading(false);
      return null;
    }
  }, []);

  /**
   * Cleans up expired cache entries
   */
  const cleanupCache = useCallback((): void => {
    const now = Date.now();
    for (const [key, entry] of cache.current.entries()) {
      if (now > entry.expiresAt) {
        cache.current.delete(key);
      }
    }
  }, []);

  /**
   * Returns cache statistics for monitoring
   */
  const getCacheStatus = useCallback((): { size: number; oldestEntry: number | null } => {
    let oldestEntry: number | null = null;
    for (const entry of cache.current.values()) {
      if (!oldestEntry || entry.timestamp < oldestEntry) {
        oldestEntry = entry.timestamp;
      }
    }
    return {
      size: cache.current.size,
      oldestEntry
    };
  }, []);

  // Set up cache cleanup interval
  useRef<NodeJS.Timeout>().current = setInterval(cleanupCache, 5 * 60 * 1000); // Clean every 5 minutes

  return {
    isLoading,
    error,
    fetchBenchmarkData,
    compareToBenchmark,
    cleanupCache,
    getCacheStatus
  };
};