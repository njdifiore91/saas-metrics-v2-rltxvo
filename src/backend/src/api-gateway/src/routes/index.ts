/**
 * Main Router Configuration for the Startup Metrics Benchmarking Platform
 * Implements comprehensive routing with security, monitoring, and performance optimizations
 * @version 1.0.0
 */

import { Router } from 'express'; // v4.18.2
import compression from 'compression'; // v1.7.4
import helmet from 'helmet'; // v7.0.0
import rateLimit from 'express-rate-limit'; // v6.7.0
import correlator from 'express-correlation-id'; // v2.0.1

// Import route modules
import authRouter from './auth.routes';
import metricsRouter from './metrics.routes';
import benchmarkRouter from './benchmark.routes';
import reportsRouter from './reports.routes';
import { adminRouter } from './admin.routes';
import errorHandler from '../middleware/error.middleware';

// Initialize router
const router = Router();

// Configure rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    type: 'https://api.startup-metrics.com/errors/rate-limit',
    status: 429,
    code: 'SYS001',
    message: 'Rate limit exceeded',
    details: { windowMs: '15m', limit: 100 },
    instance: '/api'
  }
});

// Configure security headers
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: 'same-site' },
  dnsPrefetchControl: true,
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true
});

// Apply global middleware
router.use(compression()); // Enable response compression
router.use(securityHeaders); // Apply security headers
router.use(apiLimiter); // Apply rate limiting
router.use(correlator()); // Add correlation IDs for request tracking

// Health check endpoint (no auth required)
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Mount route modules
router.use('/auth', authRouter);
router.use('/metrics', metricsRouter);
router.use('/benchmarks', benchmarkRouter);
router.use('/reports', reportsRouter);
router.use('/admin', adminRouter);

// Apply error handling middleware
router.use(errorHandler);

// Handle 404 errors for unmatched routes
router.use((req, res) => {
  res.status(404).json({
    type: 'https://api.startup-metrics.com/errors/not-found',
    status: 404,
    code: 'API002',
    message: 'Endpoint not found',
    details: {
      path: req.path,
      method: req.method
    },
    instance: req.originalUrl
  });
});

export default router;