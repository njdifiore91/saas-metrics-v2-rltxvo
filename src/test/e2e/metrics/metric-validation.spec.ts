import { describe, it, beforeAll, afterAll, beforeEach, afterEach, expect } from 'jest'; // v29.0.0
import { setupTestServer, teardownTestServer, getTestAgent } from '../../utils/test-server';
import { MetricType, MetricTimeframe, METRIC_VALIDATION_RANGES } from '../../../backend/src/shared/types/metric-types';
import { generateTestDataSet } from '../../utils/test-data-generator';

describe('Metric Validation E2E Tests', () => {
  let testAgent: any;
  let testData: any;

  beforeAll(async () => {
    await setupTestServer();
    testAgent = getTestAgent();
  });

  afterAll(async () => {
    await teardownTestServer();
  });

  beforeEach(async () => {
    // Generate fresh test data for each test
    testData = generateTestDataSet({
      userCount: 1,
      metricsPerUser: 5,
      includeHistorical: true
    });
  });

  afterEach(async () => {
    // Clean up test data after each test
    testData = null;
  });

  describe('Single Metric Validation', () => {
    it('should validate and accept valid Net Dollar Retention metric', async () => {
      const validNDR = {
        metricId: testData.metrics[0].id,
        value: 110, // Valid NDR between 0-200%
        companyId: testData.users[0].id,
        timeframe: MetricTimeframe.MONTHLY
      };

      const response = await testAgent
        .post('/api/v1/metrics/validate')
        .send(validNDR)
        .expect(200);

      expect(response.body).toEqual({
        isValid: true,
        warnings: []
      });
    });

    it('should reject Net Dollar Retention metric outside allowed range', async () => {
      const invalidNDR = {
        metricId: testData.metrics[0].id,
        value: 250, // Invalid: NDR > 200%
        companyId: testData.users[0].id,
        timeframe: MetricTimeframe.MONTHLY
      };

      const response = await testAgent
        .post('/api/v1/metrics/validate')
        .send(invalidNDR)
        .expect(400);

      expect(response.body).toEqual({
        type: 'https://api.startup-metrics.com/errors/validation',
        status: 400,
        code: 'DATA001',
        message: 'Invalid metric value',
        details: {
          metricId: testData.metrics[0].id,
          value: 250,
          allowedRange: METRIC_VALIDATION_RANGES.NET_DOLLAR_RETENTION
        }
      });
    });

    it('should validate and accept valid CAC Payback metric', async () => {
      const validCAC = {
        metricId: testData.metrics[1].id,
        value: 12, // Valid CAC Payback between 0-60 months
        companyId: testData.users[0].id,
        timeframe: MetricTimeframe.MONTHLY
      };

      const response = await testAgent
        .post('/api/v1/metrics/validate')
        .send(validCAC)
        .expect(200);

      expect(response.body).toEqual({
        isValid: true,
        warnings: []
      });
    });

    it('should reject CAC Payback metric outside allowed range', async () => {
      const invalidCAC = {
        metricId: testData.metrics[1].id,
        value: 72, // Invalid: CAC > 60 months
        companyId: testData.users[0].id,
        timeframe: MetricTimeframe.MONTHLY
      };

      const response = await testAgent
        .post('/api/v1/metrics/validate')
        .send(invalidCAC)
        .expect(400);

      expect(response.body).toEqual({
        type: 'https://api.startup-metrics.com/errors/validation',
        status: 400,
        code: 'DATA001',
        message: 'Invalid metric value',
        details: {
          metricId: testData.metrics[1].id,
          value: 72,
          allowedRange: METRIC_VALIDATION_RANGES.CAC_PAYBACK
        }
      });
    });
  });

  describe('Batch Metric Validation', () => {
    it('should validate multiple metrics in a single request', async () => {
      const batchMetrics = [
        {
          metricId: testData.metrics[0].id,
          value: 95, // Valid NDR
          companyId: testData.users[0].id,
          timeframe: MetricTimeframe.MONTHLY
        },
        {
          metricId: testData.metrics[1].id,
          value: 8, // Valid CAC
          companyId: testData.users[0].id,
          timeframe: MetricTimeframe.MONTHLY
        }
      ];

      const response = await testAgent
        .post('/api/v1/metrics/validate/batch')
        .send({ metrics: batchMetrics })
        .expect(200);

      expect(response.body).toEqual({
        results: [
          { metricId: testData.metrics[0].id, isValid: true, warnings: [] },
          { metricId: testData.metrics[1].id, isValid: true, warnings: [] }
        ],
        summary: {
          total: 2,
          valid: 2,
          invalid: 0
        }
      });
    });

    it('should handle mixed valid and invalid metrics in batch', async () => {
      const batchMetrics = [
        {
          metricId: testData.metrics[0].id,
          value: 250, // Invalid NDR > 200%
          companyId: testData.users[0].id,
          timeframe: MetricTimeframe.MONTHLY
        },
        {
          metricId: testData.metrics[1].id,
          value: 8, // Valid CAC
          companyId: testData.users[0].id,
          timeframe: MetricTimeframe.MONTHLY
        }
      ];

      const response = await testAgent
        .post('/api/v1/metrics/validate/batch')
        .send({ metrics: batchMetrics })
        .expect(200);

      expect(response.body).toEqual({
        results: [
          {
            metricId: testData.metrics[0].id,
            isValid: false,
            errors: [{
              code: 'DATA001',
              message: 'Invalid metric value',
              details: {
                value: 250,
                allowedRange: METRIC_VALIDATION_RANGES.NET_DOLLAR_RETENTION
              }
            }]
          },
          {
            metricId: testData.metrics[1].id,
            isValid: true,
            warnings: []
          }
        ],
        summary: {
          total: 2,
          valid: 1,
          invalid: 1
        }
      });
    });

    it('should enforce batch size limits', async () => {
      const batchMetrics = Array(101).fill({
        metricId: testData.metrics[0].id,
        value: 95,
        companyId: testData.users[0].id,
        timeframe: MetricTimeframe.MONTHLY
      });

      const response = await testAgent
        .post('/api/v1/metrics/validate/batch')
        .send({ metrics: batchMetrics })
        .expect(400);

      expect(response.body).toEqual({
        type: 'https://api.startup-metrics.com/errors/validation',
        status: 400,
        code: 'DATA003',
        message: 'Batch size exceeds maximum limit of 100 metrics',
        details: {
          providedSize: 101,
          maxSize: 100
        }
      });
    });
  });

  describe('Metric Format Validation', () => {
    it('should validate required fields', async () => {
      const invalidMetric = {
        // Missing metricId
        value: 95,
        companyId: testData.users[0].id,
        timeframe: MetricTimeframe.MONTHLY
      };

      const response = await testAgent
        .post('/api/v1/metrics/validate')
        .send(invalidMetric)
        .expect(400);

      expect(response.body).toEqual({
        type: 'https://api.startup-metrics.com/errors/validation',
        status: 400,
        code: 'DATA002',
        message: 'Required field missing',
        details: {
          field: 'metricId',
          message: 'Metric ID is required'
        }
      });
    });

    it('should validate metric value format', async () => {
      const invalidFormat = {
        metricId: testData.metrics[0].id,
        value: "95%", // Invalid: string instead of number
        companyId: testData.users[0].id,
        timeframe: MetricTimeframe.MONTHLY
      };

      const response = await testAgent
        .post('/api/v1/metrics/validate')
        .send(invalidFormat)
        .expect(400);

      expect(response.body).toEqual({
        type: 'https://api.startup-metrics.com/errors/validation',
        status: 400,
        code: 'DATA001',
        message: 'Invalid metric value format',
        details: {
          value: "95%",
          expectedType: 'number'
        }
      });
    });
  });
});