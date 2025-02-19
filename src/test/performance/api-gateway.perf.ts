import autocannon from 'autocannon'; // v7.10.0
import { setupTestServer, teardownTestServer, getTestAgent } from '../utils/test-server';
import app from '../../backend/src/api-gateway/src/app';
import pino from 'pino'; // v8.14.1
import clinic from 'clinic'; // v12.0.0
import jest from 'jest'; // v29.5.0

// Constants for performance testing
const BASE_URL = 'http://localhost:3000/api/v1';
const TEST_DURATION = 30; // seconds
const CONCURRENT_USERS = 1000;
const PERFORMANCE_THRESHOLDS = {
  responseTime: 200, // ms
  errorRate: 0.01, // 1%
  cpuUsage: 80, // percentage
  memoryUsage: 85 // percentage
};
const STATISTICAL_CONFIDENCE = 0.95;

// Configure performance test logger
const logger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard'
    }
  }
});

// Performance metrics interface
interface PerformanceMetrics {
  latency: {
    p50: number;
    p90: number;
    p99: number;
    max: number;
    mean: number;
    stddev: number;
  };
  throughput: {
    requestsPerSecond: number;
    bytesPerSecond: number;
  };
  errors: {
    rate: number;
    count: number;
    types: Record<string, number>;
  };
  resources: {
    cpuUsage: number;
    memoryUsage: number;
    eventLoopLag: number;
  };
  statistical: {
    confidenceInterval: {
      lower: number;
      upper: number;
    };
    sampleSize: number;
    validationPassed: boolean;
  };
}

/**
 * Enhanced setup function that initializes test environment with performance monitoring
 */
beforeAll(async () => {
  // Initialize test server
  await setupTestServer();

  // Configure performance monitoring
  const profiler = clinic.doctor({
    sampleInterval: 100,
    collectDelay: 0,
    debug: true
  });

  // Start profiling
  profiler.start();

  // Initialize system resource monitoring
  process.cpuUsage();
  process.memoryUsage();

  logger.info('Performance test environment initialized');
});

/**
 * Enhanced cleanup function that ensures proper resource cleanup
 */
afterAll(async () => {
  // Generate performance reports
  const profiler = clinic.doctor();
  await profiler.stop();

  // Clean up test server
  await teardownTestServer();

  logger.info('Performance test environment cleaned up');
});

/**
 * Generic function for endpoint performance testing with statistical validation
 */
async function testEndpointPerformance(
  endpoint: string,
  method: string,
  payload: object,
  performanceThresholds: typeof PERFORMANCE_THRESHOLDS
): Promise<PerformanceMetrics> {
  // Configure autocannon with enhanced settings
  const instance = autocannon({
    url: `${BASE_URL}${endpoint}`,
    connections: CONCURRENT_USERS,
    duration: TEST_DURATION,
    method,
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload),
    setupClient: (client) => {
      client.on('error', (error) => {
        logger.error('Client error:', error);
      });
    },
    requests: [
      {
        onResponse: (status, body, context) => {
          if (status >= 400) {
            context.errors = (context.errors || 0) + 1;
          }
        }
      }
    ]
  });

  // Collect resource metrics
  const resourceMetrics = {
    cpuUsage: 0,
    memoryUsage: 0,
    eventLoopLag: 0
  };

  const resourceInterval = setInterval(() => {
    const cpu = process.cpuUsage();
    const memory = process.memoryUsage();
    
    resourceMetrics.cpuUsage = (cpu.user + cpu.system) / 1000000;
    resourceMetrics.memoryUsage = memory.heapUsed / memory.heapTotal * 100;
  }, 1000);

  // Run performance test
  const results = await new Promise<autocannon.Result>((resolve) => {
    autocannon.track(instance, { renderProgressBar: true });
    instance.on('done', resolve);
  });

  clearInterval(resourceInterval);

  // Calculate statistical metrics
  const confidenceInterval = calculateConfidenceInterval(
    results.latency.mean,
    results.latency.stddev,
    results.non2xx + results.non3xx,
    STATISTICAL_CONFIDENCE
  );

  // Format performance metrics
  const metrics: PerformanceMetrics = {
    latency: {
      p50: results.latency.p50,
      p90: results.latency.p90,
      p99: results.latency.p99,
      max: results.latency.max,
      mean: results.latency.mean,
      stddev: results.latency.stddev
    },
    throughput: {
      requestsPerSecond: results.requests.average,
      bytesPerSecond: results.throughput.average
    },
    errors: {
      rate: (results.non2xx + results.non3xx) / results.requests.total,
      count: results.non2xx + results.non3xx,
      types: results.errors
    },
    resources: resourceMetrics,
    statistical: {
      confidenceInterval,
      sampleSize: results.requests.total,
      validationPassed: validatePerformanceMetrics(results, performanceThresholds)
    }
  };

  // Log performance results
  logger.info('Performance test results:', {
    endpoint,
    method,
    metrics
  });

  return metrics;
}

/**
 * Calculates confidence interval for latency measurements
 */
function calculateConfidenceInterval(
  mean: number,
  stddev: number,
  errorCount: number,
  confidence: number
): { lower: number; upper: number } {
  const z = 1.96; // 95% confidence level
  const margin = z * (stddev / Math.sqrt(errorCount));
  
  return {
    lower: mean - margin,
    upper: mean + margin
  };
}

/**
 * Validates performance metrics against thresholds
 */
function validatePerformanceMetrics(
  results: autocannon.Result,
  thresholds: typeof PERFORMANCE_THRESHOLDS
): boolean {
  return (
    results.latency.p99 <= thresholds.responseTime &&
    (results.non2xx + results.non3xx) / results.requests.total <= thresholds.errorRate
  );
}

// Performance test suite
describe('API Gateway Performance Tests', () => {
  test('GET /metrics endpoint performance', async () => {
    const metrics = await testEndpointPerformance(
      '/metrics',
      'GET',
      {},
      PERFORMANCE_THRESHOLDS
    );

    expect(metrics.latency.p99).toBeLessThanOrEqual(PERFORMANCE_THRESHOLDS.responseTime);
    expect(metrics.errors.rate).toBeLessThanOrEqual(PERFORMANCE_THRESHOLDS.errorRate);
    expect(metrics.resources.cpuUsage).toBeLessThanOrEqual(PERFORMANCE_THRESHOLDS.cpuUsage);
    expect(metrics.resources.memoryUsage).toBeLessThanOrEqual(PERFORMANCE_THRESHOLDS.memoryUsage);
    expect(metrics.statistical.validationPassed).toBe(true);
  });

  test('POST /metrics endpoint performance', async () => {
    const metrics = await testEndpointPerformance(
      '/metrics',
      'POST',
      {
        name: 'Test Metric',
        value: 100,
        timestamp: new Date().toISOString()
      },
      PERFORMANCE_THRESHOLDS
    );

    expect(metrics.latency.p99).toBeLessThanOrEqual(PERFORMANCE_THRESHOLDS.responseTime);
    expect(metrics.errors.rate).toBeLessThanOrEqual(PERFORMANCE_THRESHOLDS.errorRate);
    expect(metrics.resources.cpuUsage).toBeLessThanOrEqual(PERFORMANCE_THRESHOLDS.cpuUsage);
    expect(metrics.resources.memoryUsage).toBeLessThanOrEqual(PERFORMANCE_THRESHOLDS.memoryUsage);
    expect(metrics.statistical.validationPassed).toBe(true);
  });

  test('GET /benchmarks endpoint performance', async () => {
    const metrics = await testEndpointPerformance(
      '/benchmarks',
      'GET',
      {},
      PERFORMANCE_THRESHOLDS
    );

    expect(metrics.latency.p99).toBeLessThanOrEqual(PERFORMANCE_THRESHOLDS.responseTime);
    expect(metrics.errors.rate).toBeLessThanOrEqual(PERFORMANCE_THRESHOLDS.errorRate);
    expect(metrics.resources.cpuUsage).toBeLessThanOrEqual(PERFORMANCE_THRESHOLDS.cpuUsage);
    expect(metrics.resources.memoryUsage).toBeLessThanOrEqual(PERFORMANCE_THRESHOLDS.memoryUsage);
    expect(metrics.statistical.validationPassed).toBe(true);
  });
});

export { testEndpointPerformance };