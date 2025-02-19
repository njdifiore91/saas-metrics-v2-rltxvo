// @ts-check
import { check, sleep } from 'k6';
import http from 'k6/http';

// k6 version: 0.45.0
// k6/http version: 0.45.0
// k6/check version: 0.45.0

// Base URL for benchmark API endpoints
const BASE_URL = 'http://localhost:3000/api/v1/benchmarks';

// Test data arrays
const BENCHMARK_IDS = ['test-benchmark-1', 'test-benchmark-2', 'test-benchmark-3'];
const REVENUE_RANGE_IDS = ['range-1m-5m', 'range-5m-10m', 'range-10m-20m'];
const TEST_METRIC_VALUES = [100000, 500000, 1000000, 2000000, 5000000];

// k6 test configuration
export const options = {
  // Ramping pattern for virtual users
  stages: [
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '3m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 500 },  // Stress test with 500 users
    { duration: '3m', target: 1500 }, // Peak load with 1500 users
    { duration: '2m', target: 100 },  // Scale down to normal load
    { duration: '1m', target: 0 },    // Ramp down to 0
  ],
  
  // Performance thresholds
  thresholds: {
    'http_req_duration': ['p95<200'], // 95% of requests should be under 200ms
    'http_req_failed': ['rate<0.01'],  // Less than 1% error rate
    'cache_hit_rate': ['rate>0.85'],   // Cache hit rate should be above 85%
    'checks': ['rate>0.99'],           // 99% of checks should pass
  },
};

// Test setup function for initialization
export function setup() {
  // Warm up the cache with initial requests
  const warmupResponses = BENCHMARK_IDS.map(id => {
    return http.get(`${BASE_URL}/${id}`);
  });

  // Validate warm-up responses
  const warmupSuccess = warmupResponses.every(res => res.status === 200);
  if (!warmupSuccess) {
    throw new Error('Cache warm-up failed');
  }

  return {
    benchmarkIds: BENCHMARK_IDS,
    revenueRangeIds: REVENUE_RANGE_IDS,
    metricValues: TEST_METRIC_VALUES,
  };
}

// Main test function
export default function(data) {
  // Random selection of test data
  const benchmarkId = data.benchmarkIds[Math.floor(Math.random() * data.benchmarkIds.length)];
  const revenueRangeId = data.revenueRangeIds[Math.floor(Math.random() * data.revenueRangeIds.length)];
  const metricValue = data.metricValues[Math.floor(Math.random() * data.metricValues.length)];

  // Scenario 1: Get benchmark by ID
  const benchmarkResponse = getBenchmarkScenario(benchmarkId);
  
  // Scenario 2: Get benchmarks by revenue range
  const rangeResponse = getBenchmarksByRevenueRangeScenario(revenueRangeId);
  
  // Scenario 3: Calculate percentile
  const percentileResponse = calculatePercentileScenario({
    benchmarkId,
    metricValue,
  });

  // Add controlled delay between iterations
  sleep(1);
}

// Get benchmark by ID scenario
function getBenchmarkScenario(benchmarkId) {
  const response = http.get(`${BASE_URL}/${benchmarkId}`, {
    tags: { name: 'get_benchmark' },
  });

  // Validate response
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
    'has valid benchmark data': (r) => {
      const body = JSON.parse(r.body);
      return body.id && body.metricType && body.revenueRange;
    },
    'cache header present': (r) => r.headers['cache-control'] !== undefined,
  });

  // Track cache hits/misses
  const isCacheHit = response.headers['x-cache'] === 'HIT';
  response.tags['cache'] = isCacheHit ? 'hit' : 'miss';

  return response;
}

// Get benchmarks by revenue range scenario
function getBenchmarksByRevenueRangeScenario(revenueRangeId) {
  const params = {
    page: 1,
    limit: 20,
  };

  const response = http.get(
    `${BASE_URL}/revenue-range/${revenueRangeId}`,
    {
      tags: { name: 'get_benchmarks_by_range' },
      params,
    }
  );

  // Validate response
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
    'has valid pagination': (r) => {
      const body = JSON.parse(r.body);
      return Array.isArray(body.data) && typeof body.total === 'number';
    },
  });

  return response;
}

// Calculate percentile scenario
function calculatePercentileScenario(metricData) {
  const payload = JSON.stringify({
    benchmarkId: metricData.benchmarkId,
    value: metricData.metricValue,
  });

  const response = http.post(
    `${BASE_URL}/calculate-percentile`,
    payload,
    {
      headers: {
        'Content-Type': 'application/json',
      },
      tags: { name: 'calculate_percentile' },
    }
  );

  // Validate response
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
    'has valid percentile calculation': (r) => {
      const body = JSON.parse(r.body);
      return typeof body.percentile === 'number' && 
             body.percentile >= 0 && 
             body.percentile <= 100;
    },
  });

  return response;
}