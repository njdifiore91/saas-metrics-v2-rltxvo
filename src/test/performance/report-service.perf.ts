import autocannon from 'autocannon'; // v7.x
import { expect } from '@jest/globals'; // v29.x
import { statistics } from 'simple-statistics'; // v7.8.x
import { PerformanceMetrics } from '@performance-metrics/core'; // v1.x

import { ReportService } from '../../backend/src/report-service/src/services/report.service';
import { setupTestServer, teardownTestServer, getTestAgent } from '../utils/test-server';
import { ExportFormat, PageOrientation } from '../../backend/src/shared/interfaces/report.interface';

// Global test instances
let testServer: Express.Application;
let reportService: ReportService;
let performanceMetrics: PerformanceMetrics;

// Performance thresholds based on technical specifications
const PERFORMANCE_THRESHOLDS = {
  responseTime: {
    p95: 200, // 95th percentile response time in ms
    p99: 500  // 99th percentile response time in ms
  },
  throughput: {
    minRps: 50,    // Minimum requests per second
    targetRps: 100 // Target requests per second
  },
  errorRate: {
    max: 0.001 // Maximum 0.1% error rate
  },
  resourceUtilization: {
    maxCpuPercent: 70,
    maxMemoryPercent: 80
  }
};

beforeAll(async () => {
  // Initialize test environment with performance monitoring
  testServer = await setupTestServer({
    enableSecurity: true,
    enableCompression: true,
    timeoutMs: 5000
  });

  // Initialize report service with instrumentation
  reportService = new ReportService(
    null, // reportModel will be injected by DI
    null, // cacheManager will be injected by DI
    null  // securityManager will be injected by DI
  );

  // Initialize performance metrics collector
  performanceMetrics = new PerformanceMetrics({
    serviceName: 'report-service',
    enableDetailedProfiling: true,
    samplingRate: 1.0
  });

  // Warm up the service
  await warmupService();
});

afterAll(async () => {
  // Generate final performance report
  const finalReport = performanceMetrics.generateReport();
  console.log('Performance Test Results:', finalReport);

  // Cleanup resources
  await teardownTestServer();
  await performanceMetrics.cleanup();
});

async function warmupService() {
  const warmupRequests = 100;
  const agent = getTestAgent();
  
  for (let i = 0; i < warmupRequests; i++) {
    await agent.post('/api/v1/reports/generate')
      .send({
        name: 'Warmup Report',
        templateId: 'template-123',
        metrics: ['metric-1', 'metric-2']
      });
  }
}

describe('Report Service Performance Tests', () => {
  test('Report Generation Performance', async () => {
    const instance = autocannon({
      url: 'http://localhost:3000/api/v1/reports/generate',
      connections: 100,
      duration: 30,
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Performance Test Report',
        templateId: 'template-123',
        metrics: ['metric-1', 'metric-2'],
        type: 'BENCHMARK_COMPARISON'
      })
    });

    const results = await new Promise((resolve) => {
      instance.on('done', resolve);
    });

    // Analyze results
    expect(results.latency.p95).toBeLessThan(PERFORMANCE_THRESHOLDS.responseTime.p95);
    expect(results.latency.p99).toBeLessThan(PERFORMANCE_THRESHOLDS.responseTime.p99);
    expect(results.errors).toBeLessThan(results.requests.total * PERFORMANCE_THRESHOLDS.errorRate.max);
    expect(results.requests.average).toBeGreaterThan(PERFORMANCE_THRESHOLDS.throughput.minRps);

    // Log detailed metrics
    performanceMetrics.recordMetric('report_generation_latency_p95', results.latency.p95);
    performanceMetrics.recordMetric('report_generation_rps', results.requests.average);
    performanceMetrics.recordMetric('report_generation_errors', results.errors);
  }, 60000);

  test('Report Export Performance', async () => {
    const exportFormats = Object.values(ExportFormat);
    const results = [];

    for (const format of exportFormats) {
      const instance = autocannon({
        url: 'http://localhost:3000/api/v1/reports/123/export',
        connections: 50,
        duration: 15,
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          format,
          orientation: PageOrientation.PORTRAIT,
          includeCharts: true,
          includeTables: true
        })
      });

      const formatResults = await new Promise((resolve) => {
        instance.on('done', resolve);
      });

      results.push({
        format,
        metrics: formatResults
      });

      // Record format-specific metrics
      performanceMetrics.recordMetric(`report_export_${format}_latency_p95`, formatResults.latency.p95);
      performanceMetrics.recordMetric(`report_export_${format}_rps`, formatResults.requests.average);
    }

    // Validate performance across all formats
    for (const result of results) {
      expect(result.metrics.latency.p95).toBeLessThan(PERFORMANCE_THRESHOLDS.responseTime.p95 * 2); // Export allows higher latency
      expect(result.metrics.errors).toBeLessThan(result.metrics.requests.total * PERFORMANCE_THRESHOLDS.errorRate.max);
    }
  }, 90000);

  test('Concurrent Report Generation', async () => {
    const concurrencyLevels = [10, 50, 100, 200, 500];
    const results = [];

    for (const concurrency of concurrencyLevels) {
      const instance = autocannon({
        url: 'http://localhost:3000/api/v1/reports/generate',
        connections: concurrency,
        duration: 20,
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          name: `Concurrency Test Report ${concurrency}`,
          templateId: 'template-123',
          metrics: ['metric-1', 'metric-2'],
          type: 'BENCHMARK_COMPARISON'
        })
      });

      const concurrencyResults = await new Promise((resolve) => {
        instance.on('done', resolve);
      });

      results.push({
        concurrency,
        metrics: concurrencyResults
      });

      // Record concurrency-specific metrics
      performanceMetrics.recordMetric(`concurrent_generation_${concurrency}_latency_p95`, concurrencyResults.latency.p95);
      performanceMetrics.recordMetric(`concurrent_generation_${concurrency}_rps`, concurrencyResults.requests.average);
      performanceMetrics.recordMetric(`concurrent_generation_${concurrency}_errors`, concurrencyResults.errors);
    }

    // Analyze scalability
    const rpsValues = results.map(r => r.metrics.requests.average);
    const latencyValues = results.map(r => r.metrics.latency.p95);

    // Calculate scalability metrics
    const rpsScalability = statistics.linearRegression(
      concurrencyLevels.map((c, i) => [c, rpsValues[i]])
    );

    // Validate scalability
    expect(rpsScalability.r2).toBeGreaterThan(0.8); // R-squared value indicates good scalability
    expect(Math.max(...latencyValues)).toBeLessThan(PERFORMANCE_THRESHOLDS.responseTime.p95 * 3); // Allow higher latency under extreme load
  }, 120000);
});