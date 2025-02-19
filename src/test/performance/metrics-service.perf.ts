import autocannon from 'autocannon'; // v7.10.0
import { expect } from '@jest/globals'; // ^29.0.0
import { setupTestServer, teardownTestServer } from '../utils/test-server';
import { generateTestMetricData } from '../utils/metric-helpers';
import { MetricsService } from '../../backend/src/metrics-service/src/services/metrics.service';

// Performance test configuration
const PERFORMANCE_CONFIG = {
  duration: 60, // Test duration in seconds
  connections: 1000, // Concurrent connections
  pipelining: 10, // HTTP pipelining factor
  timeout: 10000, // Request timeout in ms
  maxRetries: 3, // Maximum retry attempts
  warmup: {
    duration: 10,
    connections: 100
  },
  scenarios: {
    gradual: {
      rampUp: 30,
      sustainPeak: 20,
      rampDown: 10
    },
    burst: {
      duration: 5,
      connections: 2000
    }
  }
};

// API endpoints for testing
const ENDPOINTS = {
  calculateMetric: '/api/v1/metrics/calculate',
  recordMetric: '/api/v1/metrics/record',
  getHistory: '/api/v1/metrics/history'
};

/**
 * Sets up performance test environment with resource isolation and monitoring
 */
async function setupPerformanceTest(config: typeof PERFORMANCE_CONFIG): Promise<void> {
  try {
    // Initialize test server with performance monitoring
    await setupTestServer({
      enableSecurity: true,
      enableCompression: true,
      timeoutMs: config.timeout
    });

    // Generate test data
    const testData = generateTestMetricData({
      includeEdgeCases: true,
      timeSeries: true,
      timeSeriesLength: 100
    });

    // Warm up the system
    const warmupInstance = autocannon({
      url: ENDPOINTS.calculateMetric,
      connections: config.warmup.connections,
      duration: config.warmup.duration,
      headers: {
        'content-type': 'application/json'
      },
      requests: [
        {
          method: 'POST',
          path: ENDPOINTS.calculateMetric,
          body: JSON.stringify(testData)
        }
      ]
    });

    await new Promise((resolve) => warmupInstance.on('done', resolve));

  } catch (error) {
    console.error('Performance test setup failed:', error);
    throw error;
  }
}

/**
 * Executes comprehensive load test scenarios with detailed metrics collection
 */
async function runLoadTest(testConfig: typeof PERFORMANCE_CONFIG): Promise<any> {
  const results = {
    latency: {
      p50: 0,
      p90: 0,
      p99: 0
    },
    throughput: {
      average: 0,
      peak: 0
    },
    errors: {
      count: 0,
      rate: 0
    },
    duration: 0
  };

  // Gradual load increase scenario
  const gradualLoadInstance = autocannon({
    url: ENDPOINTS.calculateMetric,
    connections: testConfig.connections,
    duration: testConfig.scenarios.gradual.sustainPeak,
    amount: testConfig.connections * 2,
    timeout: testConfig.timeout,
    headers: {
      'content-type': 'application/json'
    },
    requests: [
      {
        method: 'POST',
        path: ENDPOINTS.calculateMetric,
        body: JSON.stringify({
          metricId: 'test-metric',
          value: 100,
          timestamp: new Date()
        })
      }
    ]
  });

  // Collect metrics
  gradualLoadInstance.on('response', (client, statusCode) => {
    if (statusCode >= 400) {
      results.errors.count++;
    }
  });

  // Wait for test completion
  await new Promise((resolve) => gradualLoadInstance.on('done', (metrics) => {
    results.latency = {
      p50: metrics.latency.p50,
      p90: metrics.latency.p90,
      p99: metrics.latency.p99
    };
    results.throughput = {
      average: metrics.throughput.average,
      peak: metrics.throughput.peak
    };
    results.errors.rate = results.errors.count / metrics.duration;
    results.duration = metrics.duration;
    resolve(null);
  }));

  return results;
}

/**
 * Validates collected performance metrics against requirements
 */
async function validatePerformance(results: any): Promise<boolean> {
  // Validate response time requirements
  expect(results.latency.p90).toBeLessThan(2000); // < 2 seconds for 90th percentile
  expect(results.latency.p50).toBeLessThan(200); // < 200ms for median

  // Validate throughput requirements
  expect(results.throughput.average).toBeGreaterThan(500); // > 500 RPS average
  
  // Validate error rate requirements
  expect(results.errors.rate).toBeLessThan(0.001); // < 0.1% error rate

  // Validate uptime requirement (99.9%)
  const successRate = 1 - (results.errors.count / (results.throughput.average * results.duration));
  expect(successRate).toBeGreaterThan(0.999);

  return true;
}

describe('Metrics Service Performance Tests', () => {
  beforeAll(async () => {
    await setupPerformanceTest(PERFORMANCE_CONFIG);
  });

  afterAll(async () => {
    await teardownTestServer();
  });

  it('should handle sustained load within performance requirements', async () => {
    const results = await runLoadTest(PERFORMANCE_CONFIG);
    await validatePerformance(results);
  }, PERFORMANCE_CONFIG.duration * 1000 + 5000);

  it('should maintain calculation accuracy under load', async () => {
    const metricsService = new MetricsService();
    const testCases = generateTestMetricData({
      includeEdgeCases: true,
      customValues: [10, 50, 100]
    });

    const results = await Promise.all(
      testCases.inputs.map(async (value) => {
        const result = await metricsService.calculateMetric({
          value,
          timestamp: new Date()
        });
        return Math.abs(result - value) < 0.001;
      })
    );

    expect(results.every(r => r)).toBe(true);
  });

  it('should handle burst traffic without degradation', async () => {
    const burstConfig = {
      ...PERFORMANCE_CONFIG,
      duration: PERFORMANCE_CONFIG.scenarios.burst.duration,
      connections: PERFORMANCE_CONFIG.scenarios.burst.connections
    };

    const results = await runLoadTest(burstConfig);
    expect(results.latency.p99).toBeLessThan(5000); // < 5 seconds even under burst
    expect(results.errors.rate).toBeLessThan(0.01); // < 1% error rate under burst
  });
});