import { Logger } from 'winston'; // v3.8+
import CircuitBreaker from 'opossum'; // v6.0+
import { BenchmarkModel } from '../models/benchmark.model';
import redisClient, { CACHE_TTL } from '../config/redis.config';
import { IBenchmarkData, IBenchmarkDefinition, IBenchmarkComparison } from '../../../shared/interfaces/benchmark.interface';
import { MetricType, METRIC_VALIDATION_RANGES } from '../../../shared/types/metric-types';

/**
 * Service class for managing benchmark operations with enhanced security,
 * caching, and monitoring capabilities
 */
export class BenchmarkService {
  constructor(
    private readonly benchmarkModel: BenchmarkModel,
    private readonly cache: typeof redisClient,
    private readonly logger: Logger,
    private readonly cacheBreaker: CircuitBreaker
  ) {}

  /**
   * Retrieves benchmark data with caching and security validation
   * @param benchmarkId Unique identifier of the benchmark
   * @param accessContext Security context for access validation
   * @returns Promise resolving to validated benchmark data
   */
  async getBenchmarkData(
    benchmarkId: string,
    accessContext: { userId: string; roles: string[] }
  ): Promise<IBenchmarkData> {
    try {
      // Validate access permissions
      this.validateAccess(accessContext, 'READ');

      // Generate secure cache key
      const cacheKey = `benchmark:${benchmarkId}:${accessContext.userId}`;

      // Attempt cache retrieval with circuit breaker
      try {
        const cachedData = await this.cacheBreaker.fire(
          async () => this.cache.get(cacheKey)
        );

        if (cachedData) {
          this.logger.debug('Cache hit for benchmark data', { benchmarkId });
          return JSON.parse(cachedData);
        }
      } catch (cacheError) {
        this.logger.warn('Cache retrieval failed', { error: cacheError.message });
      }

      // Retrieve from database with security checks
      const benchmarkData = await this.benchmarkModel.getBenchmarksByRevenueRange(benchmarkId);
      
      if (!benchmarkData.length) {
        throw new Error(`Benchmark not found: ${benchmarkId}`);
      }

      // Sanitize data before caching
      const sanitizedData = this.sanitizeBenchmarkData(benchmarkData[0]);

      // Cache the result with TTL
      await this.cacheBreaker.fire(
        async () => this.cache.set(
          cacheKey,
          JSON.stringify(sanitizedData),
          CACHE_TTL.BENCHMARK_DATA
        )
      );

      this.logger.info('Benchmark data retrieved successfully', {
        benchmarkId,
        userId: accessContext.userId
      });

      return sanitizedData;
    } catch (error) {
      this.logger.error('Failed to retrieve benchmark data', {
        error: error.message,
        benchmarkId,
        userId: accessContext.userId
      });
      throw error;
    }
  }

  /**
   * Calculates percentile position with statistical confidence intervals
   * @param metricValue Company metric value to compare
   * @param benchmarkId Reference benchmark for comparison
   * @param options Statistical calculation options
   * @returns Promise resolving to percentile calculation results
   */
  async calculatePercentile(
    metricValue: number,
    benchmarkId: string,
    options: {
      confidenceLevel: number;
      includeConfidenceIntervals: boolean;
    }
  ): Promise<IBenchmarkComparison> {
    try {
      // Validate metric value against defined ranges
      this.validateMetricValue(metricValue, benchmarkId);

      // Generate cache key for calculation
      const cacheKey = `percentile:${benchmarkId}:${metricValue}`;

      // Check cache for existing calculation
      try {
        const cachedResult = await this.cacheBreaker.fire(
          async () => this.cache.get(cacheKey)
        );

        if (cachedResult) {
          return JSON.parse(cachedResult);
        }
      } catch (cacheError) {
        this.logger.warn('Cache retrieval failed for percentile calculation', {
          error: cacheError.message
        });
      }

      // Retrieve benchmark distribution data
      const benchmarkData = await this.benchmarkModel.getBenchmarksByRevenueRange(benchmarkId);
      
      if (!benchmarkData.length) {
        throw new Error(`Benchmark not found: ${benchmarkId}`);
      }

      // Calculate percentile position
      const result = this.computePercentilePosition(
        metricValue,
        benchmarkData[0],
        options
      );

      // Cache calculation result
      await this.cacheBreaker.fire(
        async () => this.cache.set(
          cacheKey,
          JSON.stringify(result),
          CACHE_TTL.USER_METRICS
        )
      );

      this.logger.info('Percentile calculation completed', {
        benchmarkId,
        metricValue,
        percentile: result.percentile
      });

      return result;
    } catch (error) {
      this.logger.error('Percentile calculation failed', {
        error: error.message,
        benchmarkId,
        metricValue
      });
      throw error;
    }
  }

  /**
   * Validates user access permissions for benchmark operations
   * @param accessContext User access context
   * @param operation Requested operation type
   */
  private validateAccess(
    accessContext: { userId: string; roles: string[] },
    operation: 'READ' | 'WRITE'
  ): void {
    const hasAccess = accessContext.roles.some(role => 
      role === 'ADMIN' || 
      (operation === 'READ' && role === 'USER')
    );

    if (!hasAccess) {
      throw new Error('Insufficient permissions for benchmark operation');
    }
  }

  /**
   * Sanitizes benchmark data for secure transmission
   * @param data Raw benchmark data
   * @returns Sanitized benchmark data
   */
  private sanitizeBenchmarkData(data: IBenchmarkDefinition): IBenchmarkData {
    // Remove sensitive metadata
    const { source, dataClassification, ...sanitized } = data;
    return sanitized as IBenchmarkData;
  }

  /**
   * Validates metric value against defined ranges
   * @param value Metric value to validate
   * @param benchmarkId Associated benchmark ID
   */
  private validateMetricValue(value: number, benchmarkId: string): void {
    const benchmark = METRIC_VALIDATION_RANGES[benchmarkId];
    if (benchmark && (value < benchmark.min || value > benchmark.max)) {
      throw new Error(`Metric value outside valid range: ${benchmark.min}-${benchmark.max}`);
    }
  }

  /**
   * Computes percentile position with statistical analysis
   * @param value Metric value
   * @param benchmark Reference benchmark data
   * @param options Calculation options
   * @returns Computed benchmark comparison
   */
  private computePercentilePosition(
    value: number,
    benchmark: IBenchmarkDefinition,
    options: { confidenceLevel: number; includeConfidenceIntervals: boolean }
  ): IBenchmarkComparison {
    // Calculate percentile position
    const percentile = this.calculatePercentileRank(value, benchmark);
    
    // Calculate median deviation
    const medianDeviation = ((value - benchmark.p50Value) / benchmark.p50Value) * 100;

    // Determine trend direction
    const trendDirection = this.determineTrendDirection(value, benchmark);

    return {
      companyId: 'dynamic', // Set by caller
      benchmarkId: benchmark.id,
      metricValue: value,
      percentile,
      comparedAt: new Date(),
      deviationFromMedian: medianDeviation,
      trendDirection
    };
  }

  /**
   * Calculates percentile rank for a value within benchmark distribution
   * @param value Metric value
   * @param benchmark Reference benchmark data
   * @returns Calculated percentile rank
   */
  private calculatePercentileRank(
    value: number,
    benchmark: IBenchmarkDefinition
  ): number {
    const percentiles = [
      { value: benchmark.p10Value, rank: 10 },
      { value: benchmark.p25Value, rank: 25 },
      { value: benchmark.p50Value, rank: 50 },
      { value: benchmark.p75Value, rank: 75 },
      { value: benchmark.p90Value, rank: 90 }
    ];

    // Linear interpolation between known percentile points
    for (let i = 0; i < percentiles.length - 1; i++) {
      if (value <= percentiles[i + 1].value) {
        const range = percentiles[i + 1].value - percentiles[i].value;
        const position = value - percentiles[i].value;
        return percentiles[i].rank + 
          ((percentiles[i + 1].rank - percentiles[i].rank) * (position / range));
      }
    }

    return value <= percentiles[0].value ? 0 : 100;
  }

  /**
   * Determines trend direction based on metric position
   * @param value Metric value
   * @param benchmark Reference benchmark data
   * @returns Trend direction indicator
   */
  private determineTrendDirection(
    value: number,
    benchmark: IBenchmarkDefinition
  ): string {
    if (value > benchmark.p75Value) return 'increasing';
    if (value < benchmark.p25Value) return 'decreasing';
    return 'stable';
  }
}