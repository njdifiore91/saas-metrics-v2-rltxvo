import { setupTestServer, teardownTestServer, getTestAgent } from '../../utils/test-server'; // v4.18.2
import { generateTestBenchmark, generateTestBenchmarkData, validateBenchmarkData } from '../../utils/benchmark-helpers';
import { MetricType, MetricUnit, MetricTimeframe } from '../../../backend/src/shared/types/metric-types';
import { HTTP_STATUS_CODES, DATA_ERRORS } from '../../../backend/src/shared/constants/error-codes';
import { IBenchmarkRevenueRange } from '../../../backend/src/shared/interfaces/benchmark.interface';

describe('Benchmark Comparison E2E Tests', () => {
  // Test data setup
  const testRevenueRange: IBenchmarkRevenueRange = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    minRevenue: 1000000,
    maxRevenue: 5000000,
    label: '$1M-$5M',
    active: true
  };

  beforeAll(async () => {
    await setupTestServer({
      enableSecurity: true,
      enableCompression: true,
      enableRateLimit: true,
      timeoutMs: 5000
    });
  });

  afterAll(async () => {
    await teardownTestServer();
  });

  describe('Benchmark Data Retrieval', () => {
    it('should retrieve benchmark data with proper statistical validation', async () => {
      // Generate test benchmark with statistical validation
      const benchmark = generateTestBenchmark(
        MetricType.FINANCIAL,
        testRevenueRange,
        'CONFIDENTIAL'
      );

      const benchmarkData = generateTestBenchmarkData(
        benchmark.id,
        MetricType.FINANCIAL
      );

      // Validate benchmark data structure
      expect(validateBenchmarkData(benchmarkData, MetricType.FINANCIAL)).toBe(true);

      const response = await getTestAgent()
        .get(`/api/v1/benchmarks/${benchmark.id}/${testRevenueRange.id}`)
        .set('Authorization', 'Bearer test-token')
        .expect(HTTP_STATUS_CODES.OK);

      // Verify response structure
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.data).toHaveProperty('p50Value');
      expect(response.body.data.sampleSize).toBeGreaterThanOrEqual(30);
      expect(response.body.data.confidenceLevel).toBeGreaterThanOrEqual(0.9);

      // Verify statistical validity
      expect(response.body.data.p10Value).toBeLessThan(response.body.data.p25Value);
      expect(response.body.data.p25Value).toBeLessThan(response.body.data.p50Value);
      expect(response.body.data.p50Value).toBeLessThan(response.body.data.p75Value);
      expect(response.body.data.p75Value).toBeLessThan(response.body.data.p90Value);
    });

    it('should validate benchmark data classification', async () => {
      const response = await getTestAgent()
        .get(`/api/v1/benchmarks/${testRevenueRange.id}`)
        .set('Authorization', 'Bearer test-token')
        .expect(HTTP_STATUS_CODES.OK);

      // Verify security headers
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
      expect(response.headers).toHaveProperty('content-security-policy');
    });

    it('should handle error scenarios gracefully', async () => {
      const response = await getTestAgent()
        .get('/api/v1/benchmarks/invalid-id/123')
        .set('Authorization', 'Bearer test-token')
        .expect(HTTP_STATUS_CODES.BAD_REQUEST);

      // Verify RFC 7807 error format
      expect(response.body).toHaveProperty('type');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('code');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('details');
      expect(response.body).toHaveProperty('instance');
    });
  });

  describe('Benchmark Comparison Operations', () => {
    it('should compare company metrics against benchmarks', async () => {
      const comparisonData = {
        metricValue: 85,
        metricType: MetricType.RETENTION,
        revenueRangeId: testRevenueRange.id
      };

      const response = await getTestAgent()
        .post('/api/v1/benchmarks/compare')
        .set('Authorization', 'Bearer test-token')
        .send(comparisonData)
        .expect(HTTP_STATUS_CODES.OK);

      // Verify comparison results
      expect(response.body.data).toHaveProperty('percentile');
      expect(response.body.data).toHaveProperty('deviationFromMedian');
      expect(response.body.data.percentile).toBeGreaterThanOrEqual(0);
      expect(response.body.data.percentile).toBeLessThanOrEqual(100);
    });

    it('should validate metric values against defined ranges', async () => {
      const invalidData = {
        metricValue: 150, // Invalid for retention metric
        metricType: MetricType.RETENTION,
        revenueRangeId: testRevenueRange.id
      };

      const response = await getTestAgent()
        .post('/api/v1/benchmarks/compare')
        .set('Authorization', 'Bearer test-token')
        .send(invalidData)
        .expect(HTTP_STATUS_CODES.BAD_REQUEST);

      expect(response.body.code).toBe(DATA_ERRORS.DATA001);
    });
  });

  describe('Performance and Load Testing', () => {
    it('should maintain performance under concurrent requests', async () => {
      const concurrentRequests = 10;
      const startTime = Date.now();

      const requests = Array(concurrentRequests).fill(null).map(() =>
        getTestAgent()
          .get(`/api/v1/benchmarks/${testRevenueRange.id}`)
          .set('Authorization', 'Bearer test-token')
      );

      const responses = await Promise.all(requests);

      const endTime = Date.now();
      const totalDuration = endTime - startTime;
      const averageResponseTime = totalDuration / concurrentRequests;

      // Verify performance requirements
      expect(averageResponseTime).toBeLessThan(200); // 200ms max response time
      responses.forEach(response => {
        expect(response.status).toBe(HTTP_STATUS_CODES.OK);
      });
    });

    it('should handle rate limiting correctly', async () => {
      const excessiveRequests = 150; // Above rate limit
      const requests = Array(excessiveRequests).fill(null).map(() =>
        getTestAgent()
          .get(`/api/v1/benchmarks/${testRevenueRange.id}`)
          .set('Authorization', 'Bearer test-token')
      );

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(
        response => response.status === HTTP_STATUS_CODES.RATE_LIMIT
      );

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});