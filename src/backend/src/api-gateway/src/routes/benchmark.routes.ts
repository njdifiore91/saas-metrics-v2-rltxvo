import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit'; // v6.7.0
import compression from 'compression'; // v1.7.4
import { validateRequest } from 'express-validator'; // v7.0.1
import cacheControl from 'express-cache-controller'; // v1.1.0

import { authenticate, authorize } from '../middleware/auth.middleware';
import { IBenchmarkData } from '../../shared/interfaces/benchmark.interface';
import { 
  HTTP_STATUS_CODES, 
  DATA_ERRORS, 
  SYSTEM_ERRORS,
  ErrorResponse 
} from '../../../shared/constants/error-codes';
import { MetricType, MetricUnit, METRIC_VALIDATION_RANGES } from '../../../shared/types/metric-types';

// Initialize router with strict routing
const router = Router({ strict: true });

// Cache TTL in seconds (15 minutes)
const CACHE_TTL = 900;

// Rate limiting configuration for benchmark endpoints
const benchmarkRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    type: 'https://api.startup-metrics.com/errors/rate-limit',
    status: HTTP_STATUS_CODES.RATE_LIMIT,
    code: SYSTEM_ERRORS.SYS001,
    message: 'Rate limit exceeded for benchmark operations',
    details: { windowMs: '60s', limit: 100 },
    instance: '/api/v1/benchmarks'
  }
});

// Validation schema for benchmark data retrieval
const benchmarkSchema = [
  validateRequest.param('metricId').isUUID().withMessage('Invalid metric ID format'),
  validateRequest.param('revenueRangeId').isUUID().withMessage('Invalid revenue range ID format'),
  validateRequest.query('timeframe').optional().isIn(['MONTHLY', 'QUARTERLY', 'ANNUAL'])
];

// Validation schema for benchmark comparison
const comparisonSchema = [
  validateRequest.body('metricValue').isFloat().custom((value, { req }) => {
    const metricType = req.body.metricType;
    const range = METRIC_VALIDATION_RANGES[metricType];
    if (range && (value < range.min || value > range.max)) {
      throw new Error(`Value must be between ${range.min} and ${range.max} ${range.unit}`);
    }
    return true;
  }),
  validateRequest.body('metricType').isIn(Object.values(MetricType)),
  validateRequest.body('revenueRangeId').isUUID()
];

/**
 * Retrieve benchmark data with caching and security controls
 * @route GET /api/v1/benchmarks/:metricId/:revenueRangeId
 */
router.get(
  '/benchmarks/:metricId/:revenueRangeId',
  authenticate,
  authorize(['user', 'admin']),
  benchmarkRateLimit,
  compression(),
  cacheControl({ maxAge: CACHE_TTL, public: true }),
  benchmarkSchema,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const correlationId = req.headers['x-correlation-id'];
    
    try {
      const { metricId, revenueRangeId } = req.params;
      const timeframe = req.query.timeframe || 'QUARTERLY';

      // Forward request to metrics service with security context
      const benchmarkData: IBenchmarkData = await fetch(
        `${process.env.METRICS_SERVICE_URL}/benchmarks/${metricId}/${revenueRangeId}?timeframe=${timeframe}`,
        {
          headers: {
            'Authorization': req.headers.authorization!,
            'X-Correlation-ID': correlationId as string
          }
        }
      ).then(response => response.json());

      // Set security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('Cache-Control', `public, max-age=${CACHE_TTL}`);

      res.status(HTTP_STATUS_CODES.OK).json({
        data: benchmarkData,
        meta: {
          timestamp: new Date().toISOString(),
          correlationId
        }
      });
    } catch (error) {
      const errorResponse: ErrorResponse = {
        type: 'https://api.startup-metrics.com/errors/benchmark-retrieval-failed',
        status: HTTP_STATUS_CODES.SERVER_ERROR,
        code: DATA_ERRORS.DATA003,
        message: 'Failed to retrieve benchmark data',
        details: { error: (error as Error).message, correlationId },
        instance: req.originalUrl
      };
      res.status(HTTP_STATUS_CODES.SERVER_ERROR).json(errorResponse);
    }
  }
);

/**
 * Compare company metrics against benchmarks
 * @route POST /api/v1/benchmarks/compare
 */
router.post(
  '/benchmarks/compare',
  authenticate,
  authorize(['user', 'admin']),
  benchmarkRateLimit,
  compression(),
  comparisonSchema,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const correlationId = req.headers['x-correlation-id'];
    
    try {
      const { metricValue, metricType, revenueRangeId } = req.body;

      // Forward comparison request to metrics service
      const comparisonResult = await fetch(
        `${process.env.METRICS_SERVICE_URL}/benchmarks/compare`,
        {
          method: 'POST',
          headers: {
            'Authorization': req.headers.authorization!,
            'Content-Type': 'application/json',
            'X-Correlation-ID': correlationId as string
          },
          body: JSON.stringify({
            metricValue,
            metricType,
            revenueRangeId,
            companyId: req.user.companyId
          })
        }
      ).then(response => response.json());

      res.status(HTTP_STATUS_CODES.OK).json({
        data: comparisonResult,
        meta: {
          timestamp: new Date().toISOString(),
          correlationId
        }
      });
    } catch (error) {
      const errorResponse: ErrorResponse = {
        type: 'https://api.startup-metrics.com/errors/comparison-failed',
        status: HTTP_STATUS_CODES.SERVER_ERROR,
        code: DATA_ERRORS.DATA003,
        message: 'Failed to perform benchmark comparison',
        details: { error: (error as Error).message, correlationId },
        instance: req.originalUrl
      };
      res.status(HTTP_STATUS_CODES.SERVER_ERROR).json(errorResponse);
    }
  }
);

export default router;