import { Request, Response, NextFunction } from 'express'; // v4.18.2
import { Logger } from 'winston'; // v3.8+
import supertest from 'supertest'; // v6.3+
import { Redis } from 'ioredis'; // v4.6+
import CircuitBreaker from 'opossum'; // v6.4.0

import { BenchmarkController } from '../../../backend/src/metrics-service/src/controllers/benchmark.controller';
import { BenchmarkService } from '../../../backend/src/metrics-service/src/services/benchmark.service';
import { MOCK_BENCHMARK_DEFINITIONS, MOCK_BENCHMARK_DATA } from '../../mocks/benchmark-data.mock';
import { HTTP_STATUS_CODES, DATA_ERRORS } from '../../../backend/src/shared/constants/error-codes';
import { MetricType } from '../../../backend/src/shared/types/metric-types';

describe('BenchmarkController', () => {
  let benchmarkController: BenchmarkController;
  let mockBenchmarkService: jest.Mocked<BenchmarkService>;
  let mockLogger: jest.Mocked<Logger>;
  let mockCircuitBreaker: jest.Mocked<CircuitBreaker>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    // Create mock instances
    mockBenchmarkService = {
      getBenchmarkData: jest.fn(),
      getBenchmarksByRevenue: jest.fn(),
      calculatePercentile: jest.fn()
    } as any;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    } as any;

    mockCircuitBreaker = {
      fire: jest.fn()
    } as any;

    // Initialize controller with mocks
    benchmarkController = new BenchmarkController(
      mockBenchmarkService,
      mockLogger,
      mockCircuitBreaker
    );

    // Setup request/response mocks
    mockRequest = {
      params: {},
      body: {},
      user: { id: 'test-user', roles: ['USER'] },
      path: '/api/v1/benchmarks',
      method: 'GET',
      protocol: 'https',
      get: jest.fn().mockReturnValue('localhost'),
      originalUrl: '/api/v1/benchmarks'
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn()
    };

    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getBenchmark', () => {
    const benchmarkId = MOCK_BENCHMARK_DEFINITIONS[0].id;
    const mockBenchmarkData = MOCK_BENCHMARK_DATA[0];

    it('should return benchmark data successfully with cache miss', async () => {
      mockRequest.params = { id: benchmarkId };
      mockCircuitBreaker.fire.mockResolvedValueOnce(mockBenchmarkData);

      await benchmarkController.getBenchmark(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS_CODES.OK);
      expect(mockResponse.json).toHaveBeenCalledWith({
        data: mockBenchmarkData,
        meta: expect.objectContaining({
          timestamp: expect.any(String),
          requestId: expect.any(String)
        })
      });
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should handle invalid benchmark ID', async () => {
      mockRequest.params = {};

      await benchmarkController.getBenchmark(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: DATA_ERRORS.DATA002
        })
      );
    });

    it('should handle service errors gracefully', async () => {
      mockRequest.params = { id: benchmarkId };
      mockCircuitBreaker.fire.mockRejectedValueOnce(new Error('Service error'));

      await benchmarkController.getBenchmark(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('calculatePercentile', () => {
    const benchmarkId = MOCK_BENCHMARK_DEFINITIONS[0].id;
    const mockPercentileResult = {
      percentile: 75,
      companyId: 'test-company',
      benchmarkId,
      metricValue: 100,
      comparedAt: new Date(),
      deviationFromMedian: 25,
      trendDirection: 'increasing'
    };

    it('should calculate percentile successfully', async () => {
      mockRequest.params = { id: benchmarkId };
      mockRequest.body = { 
        metricValue: 100,
        options: {
          confidenceLevel: 0.95,
          includeConfidenceIntervals: true
        }
      };
      mockCircuitBreaker.fire.mockResolvedValueOnce(mockPercentileResult);

      await benchmarkController.calculatePercentile(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS_CODES.OK);
      expect(mockResponse.json).toHaveBeenCalledWith({
        data: mockPercentileResult,
        meta: expect.any(Object)
      });
    });

    it('should handle invalid metric value', async () => {
      mockRequest.params = { id: benchmarkId };
      mockRequest.body = { metricValue: 'invalid' };

      await benchmarkController.calculatePercentile(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: DATA_ERRORS.DATA001
        })
      );
    });
  });

  describe('getBenchmarksByRevenue', () => {
    const revenueRange = '$1M-$5M';
    const mockBenchmarks = MOCK_BENCHMARK_DEFINITIONS.filter(
      b => b.revenueRange.label === revenueRange
    );

    it('should return benchmarks by revenue range successfully', async () => {
      mockRequest.params = { range: revenueRange };
      mockCircuitBreaker.fire.mockResolvedValueOnce(mockBenchmarks);

      await benchmarkController.getBenchmarksByRevenue(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS_CODES.OK);
      expect(mockResponse.json).toHaveBeenCalledWith({
        data: mockBenchmarks,
        meta: expect.any(Object)
      });
    });

    it('should handle missing revenue range', async () => {
      mockRequest.params = {};

      await benchmarkController.getBenchmarksByRevenue(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: DATA_ERRORS.DATA002
        })
      );
    });

    it('should handle empty results', async () => {
      mockRequest.params = { range: 'invalid-range' };
      mockCircuitBreaker.fire.mockResolvedValueOnce([]);

      await benchmarkController.getBenchmarksByRevenue(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS_CODES.OK);
      expect(mockResponse.json).toHaveBeenCalledWith({
        data: [],
        meta: expect.any(Object)
      });
    });
  });

  describe('Security and Performance', () => {
    it('should set security headers on responses', async () => {
      mockRequest.params = { id: MOCK_BENCHMARK_DEFINITIONS[0].id };
      mockCircuitBreaker.fire.mockResolvedValueOnce(MOCK_BENCHMARK_DATA[0]);

      await benchmarkController.getBenchmark(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'private, no-cache, no-store, must-revalidate'
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Pragma',
        'no-cache'
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Expires',
        '0'
      );
    });

    it('should handle rate limiting', async () => {
      // Simulate rate limit exceeded
      for (let i = 0; i < 101; i++) {
        await benchmarkController.getBenchmark(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );
      }

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Too many requests')
        })
      );
    });
  });
});