import { BenchmarkService } from '../../../backend/src/metrics-service/src/services/benchmark.service';
import { MOCK_BENCHMARK_DEFINITIONS } from '../../mocks/benchmark-data.mock';
import { setupTestServer, teardownTestServer } from '../../utils/test-server';
import { MetricType, MetricTimeframe } from '../../../backend/src/shared/types/metric-types';
import Redis from 'ioredis';
import { Logger } from 'winston';

describe('Benchmark Data Integration Tests', () => {
  let benchmarkService: BenchmarkService;
  let redisClient: Redis;
  let logger: Logger;

  beforeAll(async () => {
    // Initialize test environment
    await setupTestServer();

    // Configure Redis client for testing
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      db: 1, // Use separate DB for testing
      maxRetriesPerRequest: 3
    });

    // Configure test logger
    logger = new Logger({
      level: 'info',
      transports: []
    });

    // Initialize benchmark service with test dependencies
    benchmarkService = new BenchmarkService(
      redisClient,
      logger
    );
  });

  afterAll(async () => {
    // Clean up test environment
    await redisClient.flushdb();
    await redisClient.quit();
    await teardownTestServer();
  });

  describe('getBenchmarkData', () => {
    const validAccessContext = {
      userId: 'test-user',
      roles: ['USER']
    };

    it('should retrieve benchmark data with proper caching', async () => {
      // Arrange
      const benchmarkId = MOCK_BENCHMARK_DEFINITIONS[0].id;
      const startTime = Date.now();

      // Act
      const result = await benchmarkService.getBenchmarkData(
        benchmarkId,
        validAccessContext
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(benchmarkId);
      expect(Date.now() - startTime).toBeLessThan(200); // Performance requirement
      
      // Verify cache
      const cachedData = await redisClient.get(`benchmark:${benchmarkId}:${validAccessContext.userId}`);
      expect(cachedData).toBeDefined();
      expect(JSON.parse(cachedData!)).toEqual(result);
    });

    it('should enforce security controls for unauthorized access', async () => {
      // Arrange
      const benchmarkId = MOCK_BENCHMARK_DEFINITIONS[0].id;
      const invalidAccessContext = {
        userId: 'test-user',
        roles: ['GUEST']
      };

      // Act & Assert
      await expect(
        benchmarkService.getBenchmarkData(benchmarkId, invalidAccessContext)
      ).rejects.toThrow('Insufficient permissions for benchmark operation');
    });

    it('should handle cache failures gracefully', async () => {
      // Arrange
      const benchmarkId = MOCK_BENCHMARK_DEFINITIONS[0].id;
      await redisClient.flushall(); // Clear cache

      // Act
      const result = await benchmarkService.getBenchmarkData(
        benchmarkId,
        validAccessContext
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(benchmarkId);
    });
  });

  describe('getBenchmarksByRevenue', () => {
    const validAccessContext = {
      userId: 'test-user',
      roles: ['USER']
    };

    it('should filter benchmarks by revenue range correctly', async () => {
      // Arrange
      const revenueRangeId = '1M-5M';

      // Act
      const results = await benchmarkService.getBenchmarksByRevenue(
        revenueRangeId,
        validAccessContext
      );

      // Assert
      expect(results).toBeInstanceOf(Array);
      results.forEach(benchmark => {
        expect(benchmark.revenueRange.id).toBe(revenueRangeId);
      });
    });

    it('should maintain performance under load', async () => {
      // Arrange
      const revenueRangeId = '1M-5M';
      const requests = Array(10).fill(null).map(() => 
        benchmarkService.getBenchmarksByRevenue(revenueRangeId, validAccessContext)
      );

      // Act
      const startTime = Date.now();
      const results = await Promise.all(requests);

      // Assert
      expect(Date.now() - startTime).toBeLessThan(2000); // Performance requirement
      results.forEach(result => {
        expect(result).toBeInstanceOf(Array);
      });
    });
  });

  describe('calculatePercentile', () => {
    it('should calculate percentiles accurately', async () => {
      // Arrange
      const metricValue = 1000000;
      const benchmarkId = MOCK_BENCHMARK_DEFINITIONS[0].id;
      const options = {
        confidenceLevel: 0.95,
        includeConfidenceIntervals: true
      };

      // Act
      const result = await benchmarkService.calculatePercentile(
        metricValue,
        benchmarkId,
        options
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.percentile).toBeGreaterThanOrEqual(0);
      expect(result.percentile).toBeLessThanOrEqual(100);
      expect(result.deviationFromMedian).toBeDefined();
      expect(result.trendDirection).toMatch(/increasing|stable|decreasing/);
    });

    it('should validate metric values against defined ranges', async () => {
      // Arrange
      const invalidValue = -1000;
      const benchmarkId = MOCK_BENCHMARK_DEFINITIONS[0].id;
      const options = {
        confidenceLevel: 0.95,
        includeConfidenceIntervals: true
      };

      // Act & Assert
      await expect(
        benchmarkService.calculatePercentile(invalidValue, benchmarkId, options)
      ).rejects.toThrow('Metric value outside valid range');
    });
  });

  describe('updateBenchmarkData', () => {
    const validAccessContext = {
      userId: 'test-user',
      roles: ['ADMIN']
    };

    it('should update benchmark data and invalidate cache', async () => {
      // Arrange
      const benchmarkId = MOCK_BENCHMARK_DEFINITIONS[0].id;
      const updateData = {
        p50Value: 1500000,
        sampleSize: 1000,
        confidenceLevel: 0.95
      };

      // Act
      const result = await benchmarkService.updateBenchmarkData(
        benchmarkId,
        updateData,
        validAccessContext
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.p50Value).toBe(updateData.p50Value);

      // Verify cache invalidation
      const cachedData = await redisClient.get(`benchmark:${benchmarkId}:${validAccessContext.userId}`);
      expect(cachedData).toBeNull();
    });

    it('should enforce security controls for updates', async () => {
      // Arrange
      const benchmarkId = MOCK_BENCHMARK_DEFINITIONS[0].id;
      const updateData = {
        p50Value: 1500000
      };
      const invalidAccessContext = {
        userId: 'test-user',
        roles: ['USER']
      };

      // Act & Assert
      await expect(
        benchmarkService.updateBenchmarkData(benchmarkId, updateData, invalidAccessContext)
      ).rejects.toThrow('Insufficient permissions for benchmark operation');
    });
  });
});