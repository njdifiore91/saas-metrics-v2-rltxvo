/**
 * Enhanced Metric Service
 * Handles all metric-related operations with advanced caching, validation, and batch processing
 * @version 1.0.0
 */

import { LRUCache } from 'lru-cache'; // ^7.14.1
import { apiService } from './api.service';
import { 
  IMetricDefinition, 
  IMetricValidationRule,
  IMetricCalculationParams,
  IMetricBenchmark,
  IMetricTrend,
  IMetricAggregation
} from '../interfaces/metric.interface';
import { 
  MetricType, 
  MetricUnit, 
  MetricTimeframe,
  MetricValidationType,
  MetricValue 
} from '../types/metric.types';
import { API_ENDPOINTS, ERROR_CODES } from '../constants/api.constants';

/**
 * Interface for metric calculation request
 */
interface IMetricCalculationRequest {
  metricId: string;
  value: number;
  params: IMetricCalculationParams;
}

/**
 * Interface for metric calculation result
 */
interface IMetricCalculationResult {
  metricId: string;
  value: number;
  benchmark: IMetricBenchmark;
  trend: IMetricTrend;
}

/**
 * Cache configuration interface
 */
interface IMetricCacheConfig {
  maxSize: number;
  ttl: number;
}

class MetricService {
  private readonly metricCache: LRUCache<string, IMetricDefinition>;
  private readonly calculationCache: LRUCache<string, IMetricCalculationResult>;
  private readonly validationRules: Map<string, IMetricValidationRule[]>;

  constructor(cacheConfig: IMetricCacheConfig = { maxSize: 1000, ttl: 900000 }) {
    // Initialize LRU caches with configuration
    this.metricCache = new LRUCache({
      max: cacheConfig.maxSize,
      ttl: cacheConfig.ttl,
      updateAgeOnGet: true
    });

    this.calculationCache = new LRUCache({
      max: cacheConfig.maxSize,
      ttl: cacheConfig.ttl / 2, // Shorter TTL for calculations
      updateAgeOnGet: true
    });

    this.validationRules = new Map();
  }

  /**
   * Retrieves metric definitions with caching
   */
  public async getMetricDefinitions(forceRefresh = false): Promise<IMetricDefinition[]> {
    if (!forceRefresh) {
      const cachedDefinitions = Array.from(this.metricCache.values());
      if (cachedDefinitions.length > 0) {
        return cachedDefinitions;
      }
    }

    try {
      const response = await apiService.get<IMetricDefinition[]>(API_ENDPOINTS.METRICS.LIST);
      response.data.forEach(definition => {
        this.metricCache.set(definition.id, definition);
        this.validationRules.set(definition.id, definition.validationRules);
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch metric definitions: ${error.message}`);
    }
  }

  /**
   * Calculates multiple metrics in parallel with caching
   */
  public async calculateMetricBatch(
    requests: IMetricCalculationRequest[]
  ): Promise<IMetricCalculationResult[]> {
    const results: IMetricCalculationResult[] = [];
    const uncachedRequests: IMetricCalculationRequest[] = [];

    // Check cache for existing calculations
    for (const request of requests) {
      const cacheKey = this.getCalculationCacheKey(request);
      const cachedResult = this.calculationCache.get(cacheKey);
      
      if (cachedResult) {
        results.push(cachedResult);
      } else {
        uncachedRequests.push(request);
      }
    }

    if (uncachedRequests.length > 0) {
      try {
        // Process uncached calculations in parallel
        const calculationPromises = uncachedRequests.map(request =>
          this.calculateSingleMetric(request)
        );
        
        const calculatedResults = await Promise.all(calculationPromises);
        
        // Cache new results
        calculatedResults.forEach((result, index) => {
          const cacheKey = this.getCalculationCacheKey(uncachedRequests[index]);
          this.calculationCache.set(cacheKey, result);
          results.push(result);
        });
      } catch (error) {
        throw new Error(`Batch calculation failed: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Validates a batch of metric values
   */
  public async validateMetricBatch(
    metrics: Array<{ metricId: string; value: number }>
  ): Promise<Array<{ metricId: string; isValid: boolean; errors: string[] }>> {
    return Promise.all(
      metrics.map(async ({ metricId, value }) => {
        const rules = this.validationRules.get(metricId);
        if (!rules) {
          throw new Error(`No validation rules found for metric ${metricId}`);
        }

        const errors: string[] = [];
        for (const rule of rules) {
          if (!this.validateMetricValue(value, rule)) {
            errors.push(rule.errorMessage);
          }
        }

        return {
          metricId,
          isValid: errors.length === 0,
          errors
        };
      })
    );
  }

  /**
   * Calculates a single metric with validation and benchmarking
   */
  private async calculateSingleMetric(
    request: IMetricCalculationRequest
  ): Promise<IMetricCalculationResult> {
    const { metricId, value, params } = request;

    // Validate the metric value
    const validationResult = await this.validateMetricBatch([{ metricId, value }]);
    if (!validationResult[0].isValid) {
      throw new Error(`Invalid metric value: ${validationResult[0].errors.join(', ')}`);
    }

    try {
      // Fetch benchmark data
      const benchmark = await apiService.get<IMetricBenchmark>(
        `${API_ENDPOINTS.BENCHMARKS.GET}/${metricId}`,
        { revenueRange: params.filterCriteria.revenueRange }
      );

      // Calculate trend data
      const trend = await apiService.get<IMetricTrend>(
        `${API_ENDPOINTS.BENCHMARKS.TRENDS}/${metricId}`,
        { timeframe: params.timeframe }
      );

      return {
        metricId,
        value,
        benchmark: benchmark.data,
        trend: trend.data
      };
    } catch (error) {
      throw new Error(`Metric calculation failed: ${error.message}`);
    }
  }

  /**
   * Validates a single metric value against a rule
   */
  private validateMetricValue(value: number, rule: IMetricValidationRule): boolean {
    switch (rule.type) {
      case MetricValidationType.RANGE:
        return value >= rule.minValue && value <= rule.maxValue;
      
      case MetricValidationType.MIN:
        return value >= rule.minValue;
      
      case MetricValidationType.MAX:
        return value <= rule.maxValue;
      
      case MetricValidationType.CUSTOM:
        return rule.customValidation ? rule.customValidation(value) : true;
      
      default:
        return true;
    }
  }

  /**
   * Generates cache key for metric calculations
   */
  private getCalculationCacheKey(request: IMetricCalculationRequest): string {
    return `${request.metricId}:${request.value}:${JSON.stringify(request.params)}`;
  }
}

// Export singleton instance
export const metricService = new MetricService();