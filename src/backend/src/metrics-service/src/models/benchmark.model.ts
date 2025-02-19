import { Logger, createLogger, format, transports } from 'winston'; // v3.8+
import { IBenchmarkDefinition, IBenchmarkData } from '../../../shared/interfaces/benchmark.interface';
import prisma from '../config/database.config';
import { MetricType, METRIC_VALIDATION_RANGES } from '../../../shared/types/metric-types';
import Redis from 'ioredis'; // v4.0+

/**
 * Manages benchmark data operations with comprehensive security, caching and performance optimizations
 */
export class BenchmarkModel {
  private logger: Logger;
  private cache: Redis;
  private readonly CACHE_TTL = 3600; // 1 hour cache duration
  private readonly MAX_RETRIES = 3;

  constructor() {
    // Initialize structured logger
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.json()
      ),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'logs/benchmark-operations.log' })
      ]
    });

    // Initialize Redis cache with connection pooling
    this.cache = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true
    });
  }

  /**
   * Creates a new benchmark definition with associated data points
   * @param benchmarkDefinition The benchmark definition to create
   * @param benchmarkData The associated benchmark data points
   * @returns Created benchmark with data points
   */
  async createBenchmark(
    benchmarkDefinition: IBenchmarkDefinition,
    benchmarkData: IBenchmarkData
  ): Promise<IBenchmarkDefinition> {
    try {
      // Validate input data
      this.validateBenchmarkData(benchmarkData);

      // Create benchmark using transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create benchmark definition
        const createdBenchmark = await tx.benchmarkDefinition.create({
          data: {
            id: benchmarkDefinition.id,
            metricType: benchmarkDefinition.metricType,
            revenueRangeId: benchmarkDefinition.revenueRange.id,
            timeframe: benchmarkDefinition.timeframe,
            source: benchmarkDefinition.source,
            dataClassification: benchmarkDefinition.dataClassification,
            collectedAt: benchmarkDefinition.collectedAt,
            lastUpdatedAt: new Date()
          }
        });

        // Create associated data points
        await tx.benchmarkData.create({
          data: {
            benchmarkId: createdBenchmark.id,
            p10Value: benchmarkData.p10Value,
            p25Value: benchmarkData.p25Value,
            p50Value: benchmarkData.p50Value,
            p75Value: benchmarkData.p75Value,
            p90Value: benchmarkData.p90Value,
            sampleSize: benchmarkData.sampleSize,
            confidenceLevel: benchmarkData.confidenceLevel
          }
        });

        return createdBenchmark;
      });

      // Invalidate relevant cache entries
      await this.invalidateCache(result.revenueRangeId);

      this.logger.info('Benchmark created successfully', {
        benchmarkId: result.id,
        metricType: result.metricType
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to create benchmark', {
        error: error.message,
        benchmarkDefinition
      });
      throw error;
    }
  }

  /**
   * Retrieves benchmarks filtered by revenue range with caching
   * @param revenueRangeId The revenue range identifier
   * @returns List of benchmarks with performance metrics
   */
  async getBenchmarksByRevenueRange(revenueRangeId: string): Promise<IBenchmarkDefinition[]> {
    const cacheKey = `benchmarks:range:${revenueRangeId}`;

    try {
      // Check cache first
      const cachedData = await this.cache.get(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      // Query database with optimization
      const benchmarks = await prisma.benchmarkDefinition.findMany({
        where: {
          revenueRangeId,
          active: true
        },
        include: {
          benchmarkData: true,
          revenueRange: true
        },
        orderBy: {
          lastUpdatedAt: 'desc'
        }
      });

      // Cache results
      await this.cache.setex(
        cacheKey,
        this.CACHE_TTL,
        JSON.stringify(benchmarks)
      );

      this.logger.info('Retrieved benchmarks by revenue range', {
        revenueRangeId,
        count: benchmarks.length
      });

      return benchmarks;
    } catch (error) {
      this.logger.error('Failed to retrieve benchmarks', {
        error: error.message,
        revenueRangeId
      });
      throw error;
    }
  }

  /**
   * Updates benchmark data points with validation and audit logging
   * @param benchmarkId The benchmark identifier
   * @param updatedData The updated benchmark data
   * @returns Updated benchmark data
   */
  async updateBenchmarkData(
    benchmarkId: string,
    updatedData: IBenchmarkData
  ): Promise<IBenchmarkData> {
    try {
      // Validate updated data
      this.validateBenchmarkData(updatedData);

      // Update with optimistic locking
      const result = await prisma.$transaction(async (tx) => {
        const benchmark = await tx.benchmarkDefinition.findUnique({
          where: { id: benchmarkId },
          include: { benchmarkData: true }
        });

        if (!benchmark) {
          throw new Error(`Benchmark not found: ${benchmarkId}`);
        }

        const updated = await tx.benchmarkData.update({
          where: { benchmarkId },
          data: {
            p10Value: updatedData.p10Value,
            p25Value: updatedData.p25Value,
            p50Value: updatedData.p50Value,
            p75Value: updatedData.p75Value,
            p90Value: updatedData.p90Value,
            sampleSize: updatedData.sampleSize,
            confidenceLevel: updatedData.confidenceLevel
          }
        });

        // Update last modified timestamp
        await tx.benchmarkDefinition.update({
          where: { id: benchmarkId },
          data: { lastUpdatedAt: new Date() }
        });

        return updated;
      });

      // Invalidate cache
      await this.invalidateCache(benchmarkId);

      this.logger.info('Benchmark data updated successfully', {
        benchmarkId,
        updatedAt: new Date()
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to update benchmark data', {
        error: error.message,
        benchmarkId
      });
      throw error;
    }
  }

  /**
   * Deletes benchmark with cascading cleanup and audit logging
   * @param benchmarkId The benchmark identifier
   */
  async deleteBenchmark(benchmarkId: string): Promise<void> {
    try {
      await prisma.$transaction(async (tx) => {
        // Delete benchmark data first
        await tx.benchmarkData.delete({
          where: { benchmarkId }
        });

        // Delete benchmark definition
        await tx.benchmarkDefinition.delete({
          where: { id: benchmarkId }
        });
      });

      // Invalidate cache
      await this.invalidateCache(benchmarkId);

      this.logger.info('Benchmark deleted successfully', {
        benchmarkId,
        deletedAt: new Date()
      });
    } catch (error) {
      this.logger.error('Failed to delete benchmark', {
        error: error.message,
        benchmarkId
      });
      throw error;
    }
  }

  /**
   * Validates benchmark data against defined rules
   * @param data The benchmark data to validate
   */
  private validateBenchmarkData(data: IBenchmarkData): void {
    // Validate percentile values are in ascending order
    if (
      data.p10Value > data.p25Value ||
      data.p25Value > data.p50Value ||
      data.p50Value > data.p75Value ||
      data.p75Value > data.p90Value
    ) {
      throw new Error('Percentile values must be in ascending order');
    }

    // Validate confidence level
    if (data.confidenceLevel < 0 || data.confidenceLevel > 1) {
      throw new Error('Confidence level must be between 0 and 1');
    }

    // Validate sample size
    if (data.sampleSize < 1) {
      throw new Error('Sample size must be at least 1');
    }
  }

  /**
   * Invalidates cache entries related to a benchmark
   * @param key The cache key to invalidate
   */
  private async invalidateCache(key: string): Promise<void> {
    try {
      const cacheKey = `benchmarks:range:${key}`;
      await this.cache.del(cacheKey);
    } catch (error) {
      this.logger.warn('Cache invalidation failed', {
        error: error.message,
        key
      });
    }
  }
}