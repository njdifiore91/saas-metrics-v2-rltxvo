/**
 * Metrics API Router Configuration
 * Implements REST endpoints for metric operations with security, caching and performance optimizations
 * @version 1.0.0
 */

import { Router } from 'express'; // v4.18.2
import compression from 'compression'; // v1.7.4
import cors from 'cors'; // v2.8.5
import { body, param, query, validationResult } from 'express-validator'; // v7.0.1
import { RateLimiterRedis } from 'rate-limiter-flexible'; // v2.4.1
import CircuitBreaker from 'circuit-breaker-js'; // v0.0.1
import { authenticate, authorize } from '../middleware/auth.middleware';
import { MetricsController } from '../../../metrics-service/src/controllers/metrics.controller';
import { MetricTimeframe } from '../../../shared/types/metric-types';
import { HTTP_STATUS_CODES, DATA_ERRORS, SYSTEM_ERRORS } from '../../../shared/constants/error-codes';

// Configure rate limiting for metric operations
const RATE_LIMIT_OPTIONS = {
  points: 100,
  duration: 60,
  blockDuration: 120,
  keyPrefix: 'metrics_rl'
};

// Configure circuit breaker for metric calculations
const CIRCUIT_BREAKER_OPTIONS = {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000
};

/**
 * Configures and returns the Express router with metric-related API endpoints
 * @param metricsController Injected metrics controller instance
 * @returns Configured Express router
 */
export default function setupMetricsRoutes(metricsController: MetricsController): Router {
  const router = Router();

  // Apply middleware
  router.use(compression());
  router.use(cors());

  // Health check endpoint - no auth required
  router.get('/health', async (req, res) => {
    try {
      const health = await metricsController.healthCheck();
      res.json(health);
    } catch (error) {
      res.status(HTTP_STATUS_CODES.SERVER_ERROR).json({
        type: 'https://api.startup-metrics.com/errors/health-check',
        status: HTTP_STATUS_CODES.SERVER_ERROR,
        code: SYSTEM_ERRORS.SYS003,
        message: 'Health check failed',
        details: { error: error.message },
        instance: req.originalUrl
      });
    }
  });

  // Get metric definitions with caching
  router.get('/metrics',
    authenticate,
    authorize(['user', 'admin']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          type: 'https://api.startup-metrics.com/errors/validation',
          status: HTTP_STATUS_CODES.BAD_REQUEST,
          code: DATA_ERRORS.DATA003,
          message: 'Invalid query parameters',
          details: errors.array(),
          instance: req.originalUrl
        });
      }

      try {
        const metrics = await metricsController.getMetric(
          req.query.page as unknown as number,
          req.query.limit as unknown as number
        );
        res.json(metrics);
      } catch (error) {
        res.status(HTTP_STATUS_CODES.SERVER_ERROR).json({
          type: 'https://api.startup-metrics.com/errors/metrics',
          status: HTTP_STATUS_CODES.SERVER_ERROR,
          code: SYSTEM_ERRORS.SYS003,
          message: 'Failed to retrieve metrics',
          details: { error: error.message },
          instance: req.originalUrl
        });
      }
    }
  );

  // Record metric values with rate limiting
  router.post('/metrics/:id/values',
    authenticate,
    authorize(['user', 'admin']),
    param('id').isUUID(),
    body('value').isFloat(),
    body('companyId').isUUID(),
    body('timeframe').isIn(Object.values(MetricTimeframe)),
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          type: 'https://api.startup-metrics.com/errors/validation',
          status: HTTP_STATUS_CODES.BAD_REQUEST,
          code: DATA_ERRORS.DATA003,
          message: 'Invalid request body',
          details: errors.array(),
          instance: req.originalUrl
        });
      }

      try {
        const result = await metricsController.recordMetricValue({
          metricId: req.params.id,
          ...req.body
        });
        res.status(HTTP_STATUS_CODES.CREATED).json(result);
      } catch (error) {
        res.status(HTTP_STATUS_CODES.SERVER_ERROR).json({
          type: 'https://api.startup-metrics.com/errors/metrics',
          status: HTTP_STATUS_CODES.SERVER_ERROR,
          code: SYSTEM_ERRORS.SYS003,
          message: 'Failed to record metric value',
          details: { error: error.message },
          instance: req.originalUrl
        });
      }
    }
  );

  // Batch record metric values
  router.post('/metrics/batch/values',
    authenticate,
    authorize(['user', 'admin']),
    body('metrics').isArray({ min: 1, max: 100 }),
    body('metrics.*.metricId').isUUID(),
    body('metrics.*.value').isFloat(),
    body('metrics.*.companyId').isUUID(),
    body('metrics.*.timeframe').isIn(Object.values(MetricTimeframe)),
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          type: 'https://api.startup-metrics.com/errors/validation',
          status: HTTP_STATUS_CODES.BAD_REQUEST,
          code: DATA_ERRORS.DATA003,
          message: 'Invalid request body',
          details: errors.array(),
          instance: req.originalUrl
        });
      }

      try {
        const result = await metricsController.batchRecordMetrics(req.body.metrics);
        res.status(HTTP_STATUS_CODES.CREATED).json(result);
      } catch (error) {
        res.status(HTTP_STATUS_CODES.SERVER_ERROR).json({
          type: 'https://api.startup-metrics.com/errors/metrics',
          status: HTTP_STATUS_CODES.SERVER_ERROR,
          code: SYSTEM_ERRORS.SYS003,
          message: 'Failed to record metric values batch',
          details: { error: error.message },
          instance: req.originalUrl
        });
      }
    }
  );

  // Calculate metric with circuit breaker
  router.post('/metrics/:id/calculate',
    authenticate,
    authorize(['user', 'admin']),
    param('id').isUUID(),
    body('companyId').isUUID(),
    body('timeframe').isIn(Object.values(MetricTimeframe)),
    body('startDate').isISO8601(),
    body('endDate').isISO8601(),
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          type: 'https://api.startup-metrics.com/errors/validation',
          status: HTTP_STATUS_CODES.BAD_REQUEST,
          code: DATA_ERRORS.DATA003,
          message: 'Invalid request body',
          details: errors.array(),
          instance: req.originalUrl
        });
      }

      try {
        const result = await metricsController.calculateMetric({
          metricId: req.params.id,
          ...req.body
        });
        res.json(result);
      } catch (error) {
        res.status(HTTP_STATUS_CODES.SERVER_ERROR).json({
          type: 'https://api.startup-metrics.com/errors/metrics',
          status: HTTP_STATUS_CODES.SERVER_ERROR,
          code: SYSTEM_ERRORS.SYS003,
          message: 'Failed to calculate metric',
          details: { error: error.message },
          instance: req.originalUrl
        });
      }
    }
  );

  // Batch calculate metrics
  router.post('/metrics/batch/calculate',
    authenticate,
    authorize(['user', 'admin']),
    body('metricIds').isArray({ min: 1, max: 100 }),
    body('metricIds.*').isUUID(),
    body('companyId').isUUID(),
    body('timeframe').isIn(Object.values(MetricTimeframe)),
    body('startDate').isISO8601(),
    body('endDate').isISO8601(),
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          type: 'https://api.startup-metrics.com/errors/validation',
          status: HTTP_STATUS_CODES.BAD_REQUEST,
          code: DATA_ERRORS.DATA003,
          message: 'Invalid request body',
          details: errors.array(),
          instance: req.originalUrl
        });
      }

      try {
        const result = await metricsController.batchCalculateMetrics(req.body);
        res.json(result);
      } catch (error) {
        res.status(HTTP_STATUS_CODES.SERVER_ERROR).json({
          type: 'https://api.startup-metrics.com/errors/metrics',
          status: HTTP_STATUS_CODES.SERVER_ERROR,
          code: SYSTEM_ERRORS.SYS003,
          message: 'Failed to calculate metrics batch',
          details: { error: error.message },
          instance: req.originalUrl
        });
      }
    }
  );

  return router;
}