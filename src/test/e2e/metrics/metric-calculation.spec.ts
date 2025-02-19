import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'; // v29.0.0
import request from 'supertest'; // v6.3.3
import {
  validateMetricCalculation,
  generateTestMetricData,
  assertMetricCalculation
} from '../../utils/metric-helpers';
import {
  mockMetricDefinitions
} from '../../mocks/metric-data.mock';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const TEST_TIMEOUT = 10000;
const CALCULATION_TOLERANCE = 0.001;

describe('Metric Calculation E2E Tests', () => {
  let api: request.SuperTest<request.Test>;

  beforeAll(async () => {
    api = request(API_BASE_URL);
  });

  beforeEach(async () => {
    jest.setTimeout(TEST_TIMEOUT);
  });

  describe('Net Dollar Retention (NDR) Calculation', () => {
    it('should calculate NDR within valid range (0-200%)', async () => {
      const testData = {
        startingARR: 1000000,
        expansions: 250000,
        contractions: 50000,
        churn: 100000
      };

      const response = await api
        .post('/api/v1/metrics/calculate/ndr')
        .send(testData)
        .expect(200);

      const { value } = response.body;
      const validationResult = validateMetricCalculation(
        value,
        mockMetricDefinitions.NET_DOLLAR_RETENTION,
        { tolerance: CALCULATION_TOLERANCE }
      );

      expect(validationResult.isValid).toBe(true);
      assertMetricCalculation(value, 110, { 
        tolerance: CALCULATION_TOLERANCE,
        description: 'NDR calculation'
      });
    });

    it('should handle NDR edge cases correctly', async () => {
      const edgeCases = [
        { startingARR: 100000, expansions: 200000, contractions: 0, churn: 0 }, // 200% (max)
        { startingARR: 100000, expansions: 0, contractions: 100000, churn: 0 }, // 0% (min)
      ];

      for (const testCase of edgeCases) {
        const response = await api
          .post('/api/v1/metrics/calculate/ndr')
          .send(testCase)
          .expect(200);

        const { value } = response.body;
        const validationResult = validateMetricCalculation(
          value,
          mockMetricDefinitions.NET_DOLLAR_RETENTION,
          { tolerance: CALCULATION_TOLERANCE }
        );
        expect(validationResult.isValid).toBe(true);
      }
    });

    it('should reject invalid NDR inputs', async () => {
      const invalidCases = [
        { startingARR: -100000, expansions: 50000, contractions: 0, churn: 0 },
        { startingARR: 0, expansions: 50000, contractions: 0, churn: 0 }
      ];

      for (const testCase of invalidCases) {
        const response = await api
          .post('/api/v1/metrics/calculate/ndr')
          .send(testCase)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      }
    });
  });

  describe('CAC Payback Period Calculation', () => {
    it('should calculate CAC payback within valid range (0-60 months)', async () => {
      const testData = {
        cac: 12000,
        arr: 100000,
        grossMargin: 80
      };

      const response = await api
        .post('/api/v1/metrics/calculate/cac-payback')
        .send(testData)
        .expect(200);

      const { value } = response.body;
      const validationResult = validateMetricCalculation(
        value,
        mockMetricDefinitions.CAC_PAYBACK,
        { tolerance: CALCULATION_TOLERANCE }
      );

      expect(validationResult.isValid).toBe(true);
      assertMetricCalculation(value, 14.4, {
        tolerance: CALCULATION_TOLERANCE,
        description: 'CAC Payback calculation'
      });
    });

    it('should handle time-series CAC payback calculations', async () => {
      const timeSeriesData = generateTestMetricData(
        mockMetricDefinitions.CAC_PAYBACK,
        { timeSeries: true, timeSeriesLength: 12 }
      );

      for (const [index, value] of timeSeriesData.inputs.entries()) {
        const testData = {
          cac: value,
          arr: 100000,
          grossMargin: 80
        };

        const response = await api
          .post('/api/v1/metrics/calculate/cac-payback')
          .send(testData)
          .expect(200);

        assertMetricCalculation(
          response.body.value,
          timeSeriesData.expected[index],
          { tolerance: CALCULATION_TOLERANCE }
        );
      }
    });
  });

  describe('Magic Number Calculation', () => {
    it('should calculate magic number within valid range (0-10)', async () => {
      const testData = {
        netNewARR: 500000,
        previousQuarterSMSpend: 250000
      };

      const response = await api
        .post('/api/v1/metrics/calculate/magic-number')
        .send(testData)
        .expect(200);

      const { value } = response.body;
      const validationResult = validateMetricCalculation(
        value,
        mockMetricDefinitions.MAGIC_NUMBER,
        { tolerance: CALCULATION_TOLERANCE }
      );

      expect(validationResult.isValid).toBe(true);
      assertMetricCalculation(value, 2.0, {
        tolerance: CALCULATION_TOLERANCE,
        description: 'Magic Number calculation'
      });
    });

    it('should handle precision edge cases for magic number', async () => {
      const precisionCases = [
        { netNewARR: 333333, previousQuarterSMSpend: 100000 }, // Test decimal precision
        { netNewARR: 1000000, previousQuarterSMSpend: 100000 } // Test upper bound
      ];

      for (const testCase of precisionCases) {
        const response = await api
          .post('/api/v1/metrics/calculate/magic-number')
          .send(testCase)
          .expect(200);

        const { value } = response.body;
        expect(Number.isFinite(value)).toBe(true);
        expect(value.toString()).toMatch(/^\d+\.\d{2}$/);
      }
    });
  });

  describe('Gross Margins Calculation', () => {
    it('should calculate gross margins within valid range (-100% to 100%)', async () => {
      const testData = {
        revenue: 1000000,
        cogs: 400000
      };

      const response = await api
        .post('/api/v1/metrics/calculate/gross-margins')
        .send(testData)
        .expect(200);

      const { value } = response.body;
      const validationResult = validateMetricCalculation(
        value,
        mockMetricDefinitions.GROSS_MARGIN,
        { tolerance: CALCULATION_TOLERANCE }
      );

      expect(validationResult.isValid).toBe(true);
      assertMetricCalculation(value, 60, {
        tolerance: CALCULATION_TOLERANCE,
        description: 'Gross Margins calculation'
      });
    });

    it('should handle gross margins boundary conditions', async () => {
      const boundaryCases = [
        { revenue: 100000, cogs: 100000 }, // 0% margin
        { revenue: 100000, cogs: 0 }, // 100% margin
        { revenue: 100000, cogs: 200000 } // -100% margin
      ];

      for (const testCase of boundaryCases) {
        const response = await api
          .post('/api/v1/metrics/calculate/gross-margins')
          .send(testCase)
          .expect(200);

        const { value } = response.body;
        const validationResult = validateMetricCalculation(
          value,
          mockMetricDefinitions.GROSS_MARGIN,
          { tolerance: CALCULATION_TOLERANCE }
        );
        expect(validationResult.isValid).toBe(true);
      }
    });
  });
});