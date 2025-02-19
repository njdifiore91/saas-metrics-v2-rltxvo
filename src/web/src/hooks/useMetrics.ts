/**
 * Enhanced React hook for managing metric operations with advanced caching,
 * batch processing, and comprehensive error handling.
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useMemo } from 'react'; // ^18.2.0
import { metricService } from '../services/metric.service';
import { IMetricDefinition } from '../interfaces/metric.interface';
import { useAppDispatch, useAppSelector } from '../store';
import { 
  MetricType, 
  MetricTimeframe, 
  MetricValidationType 
} from '../types/metric.types';

// Interface for hook options
interface UseMetricsOptions {
  batchSize?: number;
  cacheTimeout?: number;
  retryAttempts?: number;
  autoRefresh?: boolean;
  validateOnChange?: boolean;
}

// Interface for metric error
interface IMetricError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Interface for metric validation result
interface IMetricValidationResult {
  isValid: boolean;
  errors: string[];
  timestamp: string;
}

// Default options
const DEFAULT_OPTIONS: UseMetricsOptions = {
  batchSize: 10,
  cacheTimeout: 15 * 60 * 1000, // 15 minutes
  retryAttempts: 3,
  autoRefresh: true,
  validateOnChange: true
};

/**
 * Enhanced custom hook for managing metric operations
 * @param companyId - Company identifier for metric context
 * @param options - Configuration options for the hook
 */
export const useMetrics = (
  companyId: string,
  options: UseMetricsOptions = DEFAULT_OPTIONS
) => {
  // Merge options with defaults
  const hookOptions = { ...DEFAULT_OPTIONS, ...options };

  // State management
  const [metricDefinitions, setMetricDefinitions] = useState<IMetricDefinition[]>([]);
  const [companyMetrics, setCompanyMetrics] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<IMetricError | null>(null);
  const [validationResults, setValidationResults] = useState<Record<string, IMetricValidationResult>>({});
  const [calculationCache, setCalculationCache] = useState<Record<string, { value: number; timestamp: number }>>({});

  // Redux integration
  const dispatch = useAppDispatch();

  /**
   * Fetches metric definitions with caching
   */
  const fetchMetricDefinitions = useCallback(async (forceRefresh: boolean = false) => {
    try {
      setIsLoading(true);
      setError(null);
      const definitions = await metricService.getMetricDefinitions(forceRefresh);
      setMetricDefinitions(definitions);
      setProgress(25);
    } catch (err: any) {
      setError({
        code: 'FETCH_DEFINITIONS_ERROR',
        message: err.message
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Validates a batch of metrics
   */
  const validateMetrics = useCallback(async (
    metrics: Array<{ metricId: string; value: number }>
  ): Promise<Record<string, IMetricValidationResult>> => {
    try {
      const results = await metricService.validateMetricBatch(metrics);
      const validationMap = results.reduce((acc, result) => ({
        ...acc,
        [result.metricId]: {
          isValid: result.isValid,
          errors: result.errors,
          timestamp: new Date().toISOString()
        }
      }), {});
      setValidationResults(validationMap);
      return validationMap;
    } catch (err: any) {
      setError({
        code: 'VALIDATION_ERROR',
        message: err.message
      });
      return {};
    }
  }, []);

  /**
   * Calculates metrics with batch processing and caching
   */
  const calculateMetrics = useCallback(async (
    metrics: Array<{ metricId: string; value: number }>,
    timeframe: MetricTimeframe = MetricTimeframe.MONTHLY
  ) => {
    try {
      setIsLoading(true);
      setProgress(0);

      // Process metrics in batches
      const batches = [];
      for (let i = 0; i < metrics.length; i += hookOptions.batchSize!) {
        batches.push(metrics.slice(i, i + hookOptions.batchSize!));
      }

      const results = [];
      for (let i = 0; i < batches.length; i++) {
        const batchResults = await metricService.calculateMetricBatch(
          batches[i].map(metric => ({
            metricId: metric.metricId,
            value: metric.value,
            params: {
              timeframe,
              startDate: new Date(),
              endDate: new Date(),
              filterCriteria: { companyId }
            }
          }))
        );
        results.push(...batchResults);
        setProgress(((i + 1) / batches.length) * 100);
      }

      // Update calculation cache
      const newCache = results.reduce((acc, result) => ({
        ...acc,
        [result.metricId]: {
          value: result.value,
          timestamp: Date.now()
        }
      }), {});
      setCalculationCache(prev => ({ ...prev, ...newCache }));

      return results;
    } catch (err: any) {
      setError({
        code: 'CALCULATION_ERROR',
        message: err.message
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [companyId, hookOptions.batchSize]);

  /**
   * Submits metric values with validation
   */
  const submitMetrics = useCallback(async (
    metrics: Array<{ metricId: string; value: number }>
  ) => {
    try {
      setIsLoading(true);
      setError(null);

      // Validate metrics before submission
      if (hookOptions.validateOnChange) {
        const validationResults = await validateMetrics(metrics);
        const hasErrors = Object.values(validationResults).some(result => !result.isValid);
        if (hasErrors) {
          throw new Error('Validation failed for one or more metrics');
        }
      }

      // Submit metrics
      await metricService.submitMetrics(metrics);
      setCompanyMetrics(prev => ({
        ...prev,
        ...metrics.reduce((acc, metric) => ({
          ...acc,
          [metric.metricId]: metric.value
        }), {})
      }));

      return true;
    } catch (err: any) {
      setError({
        code: 'SUBMIT_ERROR',
        message: err.message
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [hookOptions.validateOnChange, validateMetrics]);

  /**
   * Clears metric cache
   */
  const clearMetricCache = useCallback(() => {
    setCalculationCache({});
  }, []);

  /**
   * Gets cached metric value if valid
   */
  const getCachedMetrics = useCallback((metricId: string) => {
    const cached = calculationCache[metricId];
    if (!cached || Date.now() - cached.timestamp > hookOptions.cacheTimeout!) {
      return null;
    }
    return cached.value;
  }, [calculationCache, hookOptions.cacheTimeout]);

  // Initialize hook
  useEffect(() => {
    fetchMetricDefinitions();

    // Set up auto-refresh if enabled
    if (hookOptions.autoRefresh) {
      const refreshInterval = setInterval(() => {
        fetchMetricDefinitions(true);
      }, hookOptions.cacheTimeout);

      return () => clearInterval(refreshInterval);
    }
  }, [fetchMetricDefinitions, hookOptions.autoRefresh, hookOptions.cacheTimeout]);

  // Memoized return values
  return useMemo(() => ({
    metricDefinitions,
    companyMetrics,
    isLoading,
    progress,
    error,
    validationResults,
    submitMetrics,
    calculateMetrics,
    validateMetrics,
    clearMetricCache,
    getCachedMetrics,
    refreshMetrics: () => fetchMetricDefinitions(true)
  }), [
    metricDefinitions,
    companyMetrics,
    isLoading,
    progress,
    error,
    validationResults,
    submitMetrics,
    calculateMetrics,
    validateMetrics,
    clearMetricCache,
    getCachedMetrics,
    fetchMetricDefinitions
  ]);
};