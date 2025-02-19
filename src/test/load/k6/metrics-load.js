import http from 'k6/http';
import { check, sleep } from 'k6';
import { MetricType } from '../../../backend/src/shared/types/metric-types';

// Base URL for metrics API endpoints
export const BASE_URL = 'http://localhost:3000/api/v1/metrics';

// K6 test configuration with staged load and thresholds
export const options = {
  // Load stages to simulate gradual user increase
  stages: [
    { duration: '1m', target: 100 },  // Ramp up to 100 users
    { duration: '3m', target: 500 },  // Ramp up to 500 users
    { duration: '2m', target: 1000 }, // Peak load of 1000 users
    { duration: '1m', target: 0 }     // Ramp down to 0
  ],
  // Performance thresholds based on requirements
  thresholds: {
    'http_req_duration': ['p(95)<2000'], // 95% of requests under 2s
    'http_req_failed': ['rate<0.01']     // Error rate under 1%
  }
};

/**
 * Generates realistic test metric data payload
 * @param {MetricType} type - Type of metric to generate
 * @returns {Object} Metric payload
 */
function generateMetricPayload(type) {
  const companyId = `test-company-${Math.random().toString(36).substr(2, 9)}`;
  let value, validationRules;

  switch (type) {
    case MetricType.FINANCIAL:
      value = Math.floor(Math.random() * 1000000) + 100000; // $100K-$1.1M range
      validationRules = {
        type: 'RANGE',
        min: 0,
        max: 10000000
      };
      break;
    case MetricType.RETENTION:
      value = Math.floor(Math.random() * 100) + 1; // 1-100% range
      validationRules = {
        type: 'RANGE',
        min: 0,
        max: 100
      };
      break;
    default:
      value = Math.floor(Math.random() * 1000);
      validationRules = {
        type: 'RANGE',
        min: 0,
        max: 1000
      };
  }

  return {
    companyId,
    metricType: type,
    value,
    timestamp: new Date().toISOString(),
    validationRules
  };
}

/**
 * Test environment setup
 * @returns {Object} Test context
 */
export function setup() {
  // Initialize test data and configurations
  const testContext = {
    metricTypes: [MetricType.FINANCIAL, MetricType.RETENTION],
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token'
    }
  };

  // Verify API availability
  const checkResponse = http.get(BASE_URL, { headers: testContext.headers });
  if (checkResponse.status !== 200) {
    throw new Error('API not available for testing');
  }

  return testContext;
}

/**
 * Main test execution function
 * @param {Object} testContext - Test context from setup
 */
export default function(testContext) {
  // Select random metric type for this iteration
  const metricType = testContext.metricTypes[Math.floor(Math.random() * testContext.metricTypes.length)];
  
  // Generate test payload
  const payload = generateMetricPayload(metricType);

  // Test Scenario 1: Create new metric
  const createResponse = http.post(
    `${BASE_URL}/record`,
    JSON.stringify(payload),
    { headers: testContext.headers }
  );

  // Validate response
  check(createResponse, {
    'status is 201': (r) => r.status === 201,
    'response has metric id': (r) => r.json('id') !== undefined,
    'response time OK': (r) => r.timings.duration < 2000
  });

  // Simulate user think time
  sleep(Math.random() * 2 + 1);

  // Test Scenario 2: Retrieve metric
  if (createResponse.status === 201) {
    const metricId = createResponse.json('id');
    const getResponse = http.get(
      `${BASE_URL}/${metricId}`,
      { headers: testContext.headers }
    );

    // Validate retrieval
    check(getResponse, {
      'status is 200': (r) => r.status === 200,
      'correct metric returned': (r) => r.json('value') === payload.value,
      'response time OK': (r) => r.timings.duration < 2000
    });
  }

  // Simulate user think time
  sleep(Math.random() * 3 + 1);

  // Test Scenario 3: Get metric calculations
  const calculationResponse = http.get(
    `${BASE_URL}/calculate/${payload.companyId}`,
    { headers: testContext.headers }
  );

  // Validate calculations
  check(calculationResponse, {
    'status is 200': (r) => r.status === 200,
    'has calculations': (r) => r.json('calculations') !== undefined,
    'response time OK': (r) => r.timings.duration < 2000
  });

  // Final think time before next iteration
  sleep(Math.random() * 2 + 1);
}