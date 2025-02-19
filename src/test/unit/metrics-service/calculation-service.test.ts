import { jest } from '@jest/globals';
import Redis from 'ioredis-mock';
import { faker } from '@faker-js/faker';
import { CalculationService } from '../../../backend/src/metrics-service/src/services/calculation.service';
import { MetricModel } from '../../../backend/src/metrics-service/src/models/metric.model';
import { mockMetricDefinitions } from '../../mocks/metric-data.mock';
import { METRIC_VALIDATION_RANGES } from '../../../backend/src/shared/types/metric-types';
import { IMetricCalculationParams } from '../../../backend/src/shared/interfaces/metric.interface';

describe('CalculationService', () => {
  let calculationService: CalculationService;
  let redisMock: Redis;
  let metricModel: MetricModel;
  let loggerMock: any;

  beforeAll(() => {
    // Initialize Redis mock with test configuration
    redisMock = new Redis({
      data: {
        // Pre-populate with test data if needed
      }
    });

    // Initialize logger mock
    loggerMock = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    };

    // Initialize metric model with mock definitions
    metricModel = new MetricModel(mockMetricDefinitions.NET_DOLLAR_RETENTION);

    // Initialize calculation service
    calculationService = new CalculationService(redisMock, loggerMock, metricModel);

    // Configure longer timeout for performance tests
    jest.setTimeout(10000);
  });

  afterAll(async () => {
    await redisMock.flushall();
    jest.clearAllMocks();
  });

  describe('Metric Calculations', () => {
    describe('Net Dollar Retention (NDR)', () => {
      it('should calculate NDR correctly within valid range', async () => {
        const params: IMetricCalculationParams = {
          metricId: mockMetricDefinitions.NET_DOLLAR_RETENTION.id,
          companyId: faker.string.uuid(),
          startDate: new Date(),
          endDate: new Date(),
          timeframe: 'ANNUAL',
          startingARR: 1000000,
          expansions: 200000,
          contractions: 50000,
          churn: 100000
        };

        const result = await calculationService.calculateMetric(params);
        
        expect(result).toBeGreaterThanOrEqual(METRIC_VALIDATION_RANGES.NET_DOLLAR_RETENTION.min);
        expect(result).toBeLessThanOrEqual(METRIC_VALIDATION_RANGES.NET_DOLLAR_RETENTION.max);
        expect(Number.isFinite(result)).toBe(true);
      });

      it('should throw error for invalid NDR inputs', async () => {
        const params: IMetricCalculationParams = {
          metricId: mockMetricDefinitions.NET_DOLLAR_RETENTION.id,
          companyId: faker.string.uuid(),
          startDate: new Date(),
          endDate: new Date(),
          timeframe: 'ANNUAL',
          startingARR: -1000000, // Invalid negative value
          expansions: 200000,
          contractions: 50000,
          churn: 100000
        };

        await expect(calculationService.calculateMetric(params))
          .rejects.toThrow('Invalid calculation parameters');
      });
    });

    describe('CAC Payback Period', () => {
      it('should calculate CAC payback correctly within valid range', async () => {
        const params: IMetricCalculationParams = {
          metricId: mockMetricDefinitions.CAC_PAYBACK.id,
          companyId: faker.string.uuid(),
          startDate: new Date(),
          endDate: new Date(),
          timeframe: 'ANNUAL',
          cac: 50000,
          arr: 300000,
          grossMargin: 80
        };

        const result = await calculationService.calculateMetric(params);
        
        expect(result).toBeGreaterThanOrEqual(METRIC_VALIDATION_RANGES.CAC_PAYBACK.min);
        expect(result).toBeLessThanOrEqual(METRIC_VALIDATION_RANGES.CAC_PAYBACK.max);
        expect(Number.isFinite(result)).toBe(true);
      });

      it('should throw error for invalid gross margin', async () => {
        const params: IMetricCalculationParams = {
          metricId: mockMetricDefinitions.CAC_PAYBACK.id,
          companyId: faker.string.uuid(),
          startDate: new Date(),
          endDate: new Date(),
          timeframe: 'ANNUAL',
          cac: 50000,
          arr: 300000,
          grossMargin: 101 // Invalid margin > 100%
        };

        await expect(calculationService.calculateMetric(params))
          .rejects.toThrow('Invalid gross margin');
      });
    });

    describe('Magic Number', () => {
      it('should calculate magic number correctly within valid range', async () => {
        const params: IMetricCalculationParams = {
          metricId: mockMetricDefinitions.MAGIC_NUMBER.id,
          companyId: faker.string.uuid(),
          startDate: new Date(),
          endDate: new Date(),
          timeframe: 'QUARTERLY',
          netNewARR: 500000,
          previousQuarterSMSpend: 200000
        };

        const result = await calculationService.calculateMetric(params);
        
        expect(result).toBeGreaterThanOrEqual(METRIC_VALIDATION_RANGES.MAGIC_NUMBER.min);
        expect(result).toBeLessThanOrEqual(METRIC_VALIDATION_RANGES.MAGIC_NUMBER.max);
        expect(Number.isFinite(result)).toBe(true);
      });

      it('should throw error for zero marketing spend', async () => {
        const params: IMetricCalculationParams = {
          metricId: mockMetricDefinitions.MAGIC_NUMBER.id,
          companyId: faker.string.uuid(),
          startDate: new Date(),
          endDate: new Date(),
          timeframe: 'QUARTERLY',
          netNewARR: 500000,
          previousQuarterSMSpend: 0 // Invalid zero denominator
        };

        await expect(calculationService.calculateMetric(params))
          .rejects.toThrow('Denominator cannot be zero');
      });
    });
  });

  describe('Caching Behavior', () => {
    it('should cache calculation results with correct TTL', async () => {
      const params: IMetricCalculationParams = {
        metricId: mockMetricDefinitions.NET_DOLLAR_RETENTION.id,
        companyId: faker.string.uuid(),
        startDate: new Date(),
        endDate: new Date(),
        timeframe: 'ANNUAL',
        startingARR: 1000000,
        expansions: 200000,
        contractions: 50000,
        churn: 100000
      };

      // First calculation should cache result
      const result1 = await calculationService.calculateMetric(params);
      
      // Verify cache hit on second calculation
      const result2 = await calculationService.calculateMetric(params);
      
      expect(result1).toBe(result2);
      expect(loggerMock.info).toHaveBeenCalledWith(
        'Cache hit for metric calculation',
        expect.any(Object)
      );
    });

    it('should handle cache failures gracefully', async () => {
      // Simulate Redis failure
      jest.spyOn(redisMock, 'get').mockRejectedValueOnce(new Error('Redis error'));

      const params: IMetricCalculationParams = {
        metricId: mockMetricDefinitions.NET_DOLLAR_RETENTION.id,
        companyId: faker.string.uuid(),
        startDate: new Date(),
        endDate: new Date(),
        timeframe: 'ANNUAL',
        startingARR: 1000000,
        expansions: 200000,
        contractions: 50000,
        churn: 100000
      };

      const result = await calculationService.calculateMetric(params);
      
      expect(result).toBeDefined();
      expect(loggerMock.warn).toHaveBeenCalledWith(
        'Cache retrieval failed',
        expect.any(Object)
      );
    });
  });

  describe('Performance Requirements', () => {
    it('should complete calculations within 2 second SLA', async () => {
      const params: IMetricCalculationParams = {
        metricId: mockMetricDefinitions.NET_DOLLAR_RETENTION.id,
        companyId: faker.string.uuid(),
        startDate: new Date(),
        endDate: new Date(),
        timeframe: 'ANNUAL',
        startingARR: 1000000,
        expansions: 200000,
        contractions: 50000,
        churn: 100000
      };

      const startTime = Date.now();
      await calculationService.calculateMetric(params);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000); // Less than 2 seconds
    });

    it('should handle concurrent calculations efficiently', async () => {
      const calculations = Array(10).fill(null).map(() => ({
        metricId: mockMetricDefinitions.NET_DOLLAR_RETENTION.id,
        companyId: faker.string.uuid(),
        startDate: new Date(),
        endDate: new Date(),
        timeframe: 'ANNUAL',
        startingARR: faker.number.int({ min: 100000, max: 5000000 }),
        expansions: faker.number.int({ min: 10000, max: 1000000 }),
        contractions: faker.number.int({ min: 5000, max: 500000 }),
        churn: faker.number.int({ min: 5000, max: 500000 })
      }));

      const startTime = Date.now();
      await Promise.all(calculations.map(params => 
        calculationService.calculateMetric(params)
      ));
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000); // Less than 2 seconds for 10 concurrent calculations
    });
  });

  describe('Validation Rules', () => {
    it('should validate all required parameters', async () => {
      const params: Partial<IMetricCalculationParams> = {
        metricId: mockMetricDefinitions.NET_DOLLAR_RETENTION.id,
        // Missing companyId and timeframe
        startDate: new Date(),
        endDate: new Date()
      };

      await expect(calculationService.calculateMetric(params as IMetricCalculationParams))
        .rejects.toThrow('Invalid calculation parameters');
    });

    it('should enforce metric-specific validation rules', async () => {
      const params: IMetricCalculationParams = {
        metricId: mockMetricDefinitions.GROSS_MARGINS.id,
        companyId: faker.string.uuid(),
        startDate: new Date(),
        endDate: new Date(),
        timeframe: 'ANNUAL',
        revenue: 1000000,
        cogs: 2000000 // Invalid: COGS > Revenue
      };

      await expect(calculationService.calculateMetric(params))
        .rejects.toThrow('Calculated value is outside acceptable range');
    });
  });
});