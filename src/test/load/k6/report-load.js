// k6 v0.40.0 imports
import http from 'k6/http';
import { check, sleep } from 'k6';

// Base URL for report service API endpoints
const BASE_URL = 'http://localhost:3000/api/v1/reports';

// Report types and export formats supported by the API
const REPORT_TYPES = ['benchmark', 'comparison', 'trend', 'custom'];
const EXPORT_FORMATS = ['pdf', 'excel', 'csv', 'json'];

// Performance thresholds based on requirements
const PERFORMANCE_THRESHOLDS = {
  http_req_duration: ['p(95)<200', 'p(99)<2000'],  // Response time thresholds
  http_req_failed: ['rate<0.01'],                  // Error rate threshold
  vus: ['value>=1000']                            // Concurrent users threshold
};

// Test setup function to initialize test data and context
export function setup() {
  // Generate test OAuth token
  const authToken = 'test-oauth-token-' + Date.now();
  
  // Create sample report templates
  const reportTemplates = REPORT_TYPES.map(type => ({
    type,
    name: `Sample ${type} Report`,
    metrics: ['arr', 'growth_rate', 'cac', 'ndr'],
    filters: {
      revenueRange: '$1M-$5M',
      timeframe: 'last_12_months'
    }
  }));

  // Initialize test report IDs
  const reportIds = Array(10).fill().map((_, i) => `report-${i}`);

  return {
    authToken,
    reportTemplates,
    reportIds,
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  };
}

// Report generation load test scenario
function generateReportScenario(testContext) {
  const template = testContext.reportTemplates[Math.floor(Math.random() * REPORT_TYPES.length)];
  
  const payload = {
    ...template,
    timestamp: new Date().toISOString()
  };

  const response = http.post(
    `${BASE_URL}`,
    JSON.stringify(payload),
    { headers: testContext.headers }
  );

  check(response, {
    'report generation status is 201': (r) => r.status === 201,
    'report generation time < 200ms': (r) => r.timings.duration < 200,
    'report data is valid': (r) => {
      const report = r.json();
      return report.id && report.type && report.status === 'generated';
    }
  });

  sleep(Math.random() * 2 + 1); // Random sleep 1-3 seconds
}

// Report export load test scenario
function exportReportScenario(testContext) {
  const reportId = testContext.reportIds[Math.floor(Math.random() * testContext.reportIds.length)];
  const format = EXPORT_FORMATS[Math.floor(Math.random() * EXPORT_FORMATS.length)];
  
  const response = http.post(
    `${BASE_URL}/${reportId}/export`,
    JSON.stringify({ format }),
    { headers: testContext.headers }
  );

  check(response, {
    'export status is 200': (r) => r.status === 200,
    'export time < 2000ms': (r) => r.timings.duration < 2000,
    'export URL is valid': (r) => {
      const data = r.json();
      return data.exportUrl && data.format === format;
    }
  });

  sleep(Math.random() * 3 + 2); // Random sleep 2-5 seconds
}

// Report retrieval load test scenario
function getReportScenario(testContext) {
  const reportId = testContext.reportIds[Math.floor(Math.random() * testContext.reportIds.length)];
  
  const response = http.get(
    `${BASE_URL}/${reportId}`,
    { headers: testContext.headers }
  );

  check(response, {
    'get report status is 200': (r) => r.status === 200,
    'get report time < 200ms': (r) => r.timings.duration < 200,
    'report data is complete': (r) => {
      const report = r.json();
      return report.id && report.type && report.metrics && report.filters;
    }
  });

  sleep(Math.random() * 1 + 0.5); // Random sleep 0.5-1.5 seconds
}

// Main test execution configuration
export default function() {
  const testContext = setup();

  // Configure test scenarios with specified thresholds
  const options = {
    scenarios: {
      generate_reports: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
          { duration: '2m', target: 500 },   // Ramp up to 500 users
          { duration: '5m', target: 1000 },  // Ramp up to 1000 users
          { duration: '10m', target: 1000 }, // Stay at 1000 users
          { duration: '3m', target: 0 }      // Ramp down to 0
        ],
        exec: 'generateReportScenario'
      },
      export_reports: {
        executor: 'constant-vus',
        vus: 200,
        duration: '20m',
        exec: 'exportReportScenario'
      },
      get_reports: {
        executor: 'ramping-arrival-rate',
        startRate: 50,
        timeUnit: '1s',
        preAllocatedVUs: 500,
        maxVUs: 1000,
        stages: [
          { duration: '5m', target: 200 },  // Ramp up request rate
          { duration: '10m', target: 200 }, // Maintain request rate
          { duration: '5m', target: 0 }     // Ramp down request rate
        ],
        exec: 'getReportScenario'
      }
    },
    thresholds: PERFORMANCE_THRESHOLDS
  };

  // Execute test scenarios based on configuration
  if (__ITER === 0) {
    console.log('Starting load test with configuration:', JSON.stringify(options, null, 2));
  }

  // Random scenario selection for mixed load testing
  const scenario = Math.random();
  if (scenario < 0.4) {
    generateReportScenario(testContext);
  } else if (scenario < 0.7) {
    exportReportScenario(testContext);
  } else {
    getReportScenario(testContext);
  }
}