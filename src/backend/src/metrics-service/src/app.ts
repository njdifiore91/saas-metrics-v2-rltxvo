/**
 * Startup Metrics Benchmarking Platform - Metrics Service
 * Main application entry point with enhanced security, monitoring, and reliability features
 * @version 1.0.0
 */

import express, { Express, Request, Response, NextFunction } from 'express'; // v4.18.2
import cors from 'cors'; // v2.8.5
import helmet from 'helmet'; // v6.0.0
import compression from 'compression'; // v1.7.4
import rateLimit from 'express-rate-limit'; // v6.7.0
import { validate } from 'express-validator'; // v7.0.1
import { register, collectDefaultMetrics } from 'prom-client'; // v14.2.0

import prisma from './config/database.config';
import redisClient from './config/redis.config';
import { MetricsController } from './controllers/metrics.controller';

// Environment variables with defaults
const PORT = process.env.PORT || 3002;
const NODE_ENV = process.env.NODE_ENV || 'development';
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 100;

// Initialize Express application
const app: Express = express();

/**
 * Configure comprehensive middleware stack with security and monitoring features
 */
const setupMiddleware = (app: Express): void => {
  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "same-site" },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true
  }));

  // CORS configuration
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Request-ID'],
    credentials: true,
    maxAge: 600 // 10 minutes
  }));

  // Performance middleware
  app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req: Request) => {
      return req.headers['x-no-compression'] ? false : compression.filter(req, req.res);
    }
  }));

  // Request parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Rate limiting
  app.use(rateLimit({
    windowMs: RATE_LIMIT_WINDOW,
    max: RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: 429,
      type: 'error',
      message: 'Too many requests, please try again later.'
    }
  }));

  // Request correlation
  app.use((req: Request, res: Response, next: NextFunction) => {
    req.id = req.headers['x-request-id'] || crypto.randomUUID();
    res.setHeader('X-Request-ID', req.id);
    next();
  });

  // Prometheus metrics collection
  collectDefaultMetrics({ prefix: 'metrics_service_' });
};

/**
 * Configure API routes with validation and error handling
 */
const setupRoutes = (app: Express): void => {
  const metricsController = new MetricsController();

  // Health check endpoint
  app.get('/health', async (req: Request, res: Response) => {
    try {
      const dbHealth = await prisma.$queryRaw`SELECT 1`;
      const cacheHealth = await redisClient.health();
      
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        checks: {
          database: dbHealth ? 'up' : 'down',
          cache: cacheHealth ? 'up' : 'down'
        }
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  });

  // Metrics endpoints
  app.get('/metrics', async (req: Request, res: Response) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  // API routes
  const apiRouter = express.Router();
  
  apiRouter.post('/metrics/batch', validate([
    // Add validation rules
  ]), metricsController.createMetricBatch);
  
  apiRouter.post('/metrics/calculate/batch', validate([
    // Add validation rules
  ]), metricsController.calculateMetricBatch);

  app.use('/api/v1', apiRouter);

  // Error handling
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(`[Error] ${req.id}:`, err);
    res.status(500).json({
      type: 'https://api.startupmetrics.com/errors/internal',
      title: 'Internal Server Error',
      status: 500,
      detail: NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
      instance: req.originalUrl,
      requestId: req.id
    });
  });

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      type: 'https://api.startupmetrics.com/errors/not-found',
      title: 'Resource Not Found',
      status: 404,
      detail: 'The requested resource was not found',
      instance: req.originalUrl
    });
  });
};

/**
 * Initialize service dependencies with enhanced reliability
 */
const initializeServices = async (): Promise<void> => {
  try {
    // Initialize database connection
    await prisma.$connect();
    console.log('Database connection established');

    // Initialize Redis connection
    await redisClient.connect();
    console.log('Redis connection established');

    // Initialize Prometheus metrics
    collectDefaultMetrics();
    console.log('Metrics collection initialized');
  } catch (error) {
    console.error('Failed to initialize services:', error);
    process.exit(1);
  }
};

/**
 * Start server with comprehensive monitoring
 */
const startServer = async (): Promise<void> => {
  try {
    await initializeServices();
    setupMiddleware(app);
    setupRoutes(app);

    const server = app.listen(PORT, () => {
      console.log(`Metrics service listening on port ${PORT} in ${NODE_ENV} mode`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log('Shutting down gracefully...');
      
      server.close(async () => {
        await prisma.$disconnect();
        await redisClient.disconnect();
        process.exit(0);
      });

      // Force shutdown after 30s
      setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start application
if (require.main === module) {
  startServer();
}

export default app;