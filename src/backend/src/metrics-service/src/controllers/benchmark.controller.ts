import { Request, Response, NextFunction } from 'express'; // v4.18.2
import { Logger } from 'winston'; // v3.8.0
import rateLimit from 'express-rate-limit'; // v6.7.0
import { trace, Span } from '@opentelemetry/api'; // v1.4.0
import { validate } from 'class-validator'; // v0.14.0
import CircuitBreaker from 'opossum'; // v6.4.0

import { BenchmarkService } from '../services/benchmark.service';
import { IBenchmarkDefinition } from '../../../shared/interfaces/benchmark.interface';
import { errorHandler } from '../../../shared/middleware/error-handler';
import { HTTP_STATUS_CODES, DATA_ERRORS } from '../../../shared/constants/error-codes';
import { MetricType } from '../../../shared/types/metric-types';

/**
 * Controller handling benchmark-related HTTP requests with enhanced security,
 * caching, monitoring, and error handling capabilities.
 */
export class BenchmarkController {
  private readonly tracer = trace.getTracer('benchmark-controller');
  private readonly rateLimiter: any;

  constructor(
    private readonly benchmarkService: BenchmarkService,
    private readonly logger: Logger,
    private readonly circuitBreaker: CircuitBreaker
  ) {
    // Configure rate limiting
    this.rateLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per window
      message: 'Too many requests from this IP, please try again later'
    });
  }

  /**
   * Retrieves benchmark data by ID with caching and monitoring
   * @param req Express request object
   * @param res Express response object
   * @param next Express next function
   */
  async getBenchmark(req: Request, res: Response, next: NextFunction): Promise<void> {
    let span: Span | undefined;
    
    try {
      // Start performance monitoring span
      span = this.tracer.startSpan('getBenchmark');
      span.setAttribute('benchmarkId', req.params.id);

      // Apply rate limiting
      await this.rateLimiter(req, res, () => {});

      // Validate request parameters
      const benchmarkId = req.params.id;
      if (!benchmarkId) {
        throw new Error(DATA_ERRORS.DATA002);
      }

      // Set security headers
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      // Get benchmark data through circuit breaker
      const result = await this.circuitBreaker.fire(async () => {
        return this.benchmarkService.getBenchmarkData(benchmarkId, {
          userId: req.user?.id,
          roles: req.user?.roles || []
        });
      });

      // Log successful operation
      this.logger.info('Benchmark data retrieved', {
        benchmarkId,
        userId: req.user?.id,
        timestamp: new Date().toISOString()
      });

      // Send response
      res.status(HTTP_STATUS_CODES.OK).json({
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.id
        }
      });

    } catch (error) {
      // Handle errors with RFC 7807 format
      next(error);
    } finally {
      if (span) {
        span.end();
      }
    }
  }

  /**
   * Calculates benchmark percentile with validation and caching
   * @param req Express request object
   * @param res Express response object
   * @param next Express next function
   */
  async calculatePercentile(req: Request, res: Response, next: NextFunction): Promise<void> {
    let span: Span | undefined;

    try {
      // Start performance monitoring span
      span = this.tracer.startSpan('calculatePercentile');
      span.setAttribute('benchmarkId', req.params.id);

      // Validate request body
      const { metricValue, options } = req.body;
      if (typeof metricValue !== 'number') {
        throw new Error(DATA_ERRORS.DATA001);
      }

      // Calculate percentile through circuit breaker
      const result = await this.circuitBreaker.fire(async () => {
        return this.benchmarkService.calculatePercentile(
          metricValue,
          req.params.id,
          {
            confidenceLevel: options?.confidenceLevel || 0.95,
            includeConfidenceIntervals: options?.includeConfidenceIntervals || false
          }
        );
      });

      // Log calculation
      this.logger.info('Percentile calculated', {
        benchmarkId: req.params.id,
        metricValue,
        percentile: result.percentile,
        userId: req.user?.id
      });

      // Send response
      res.status(HTTP_STATUS_CODES.OK).json({
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.id
        }
      });

    } catch (error) {
      next(error);
    } finally {
      if (span) {
        span.end();
      }
    }
  }

  /**
   * Retrieves benchmarks by revenue range with security validation
   * @param req Express request object
   * @param res Express response object
   * @param next Express next function
   */
  async getBenchmarksByRevenue(req: Request, res: Response, next: NextFunction): Promise<void> {
    let span: Span | undefined;

    try {
      // Start performance monitoring span
      span = this.tracer.startSpan('getBenchmarksByRevenue');
      span.setAttribute('revenueRange', req.params.range);

      // Validate revenue range
      const revenueRange = req.params.range;
      if (!revenueRange) {
        throw new Error(DATA_ERRORS.DATA002);
      }

      // Get benchmarks through circuit breaker
      const result = await this.circuitBreaker.fire(async () => {
        return this.benchmarkService.getBenchmarksByRevenue(revenueRange);
      });

      // Log retrieval
      this.logger.info('Revenue range benchmarks retrieved', {
        revenueRange,
        count: result.length,
        userId: req.user?.id
      });

      // Send response
      res.status(HTTP_STATUS_CODES.OK).json({
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.id
        }
      });

    } catch (error) {
      next(error);
    } finally {
      if (span) {
        span.end();
      }
    }
  }
}