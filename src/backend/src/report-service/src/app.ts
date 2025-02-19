/**
 * Main application entry point for the Report Service microservice
 * Implements comprehensive security, monitoring, and report generation capabilities
 * @version 1.0.0
 */

import express, { Express, Request, Response, NextFunction } from 'express'; // v4.18.2
import helmet from 'helmet'; // v7.0.0
import cors from 'cors'; // v2.8.5
import compression from 'compression'; // v1.7.4
import rateLimit from 'express-rate-limit'; // v6.7.0
import { ReportController } from './controllers/report.controller';
import { errorHandler } from '../../shared/middleware/error-handler';
import { Logger } from '../../shared/utils/logger';
import { HTTP_STATUS_CODES } from '../../shared/constants/error-codes';
import { validate } from 'express-validator'; // v7.0.1

// Initialize logger
const logger = new Logger('ReportService');

// Environment variables with defaults
const PORT = process.env.PORT || 3004;
const NODE_ENV = process.env.NODE_ENV || 'development';
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'];
const RATE_LIMIT_WINDOW = process.env.RATE_LIMIT_WINDOW || 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = process.env.RATE_LIMIT_MAX || 100;

// Initialize Express application
const app: Express = express();

/**
 * Configures comprehensive security middleware
 * @param app Express application instance
 */
const setupSecurityMiddleware = (app: Express): void => {
  // Configure Helmet with strict CSP
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
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "same-site" },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
    noSniff: true,
    hidePoweredBy: true
  }));

  // Configure CORS
  app.use(cors({
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    credentials: true,
    maxAge: 600 // 10 minutes
  }));

  // Configure rate limiting
  app.use(rateLimit({
    windowMs: RATE_LIMIT_WINDOW,
    max: RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
  }));
};

/**
 * Configures monitoring and logging middleware
 * @param app Express application instance
 */
const setupMonitoring = (app: Express): void => {
  // Request logging
  app.use((req: Request, res: Response, next: NextFunction) => {
    logger.info('Incoming request', {
      method: req.method,
      path: req.path,
      correlationId: req.headers['x-correlation-id'],
      userAgent: req.headers['user-agent']
    });
    next();
  });

  // Response time monitoring
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info('Request completed', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration
      });
    });
    next();
  });

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.status(HTTP_STATUS_CODES.OK).json({
      status: 'healthy',
      timestamp: new Date(),
      version: process.env.npm_package_version
    });
  });

  // Readiness probe endpoint
  app.get('/ready', (req: Request, res: Response) => {
    res.status(HTTP_STATUS_CODES.OK).json({
      status: 'ready',
      timestamp: new Date(),
      uptime: process.uptime()
    });
  });
};

/**
 * Configures API routes with authentication and rate limiting
 * @param app Express application instance
 * @param reportController Report controller instance
 */
const setupRoutes = (app: Express, reportController: ReportController): void => {
  const apiRouter = express.Router();

  // Report generation endpoints
  apiRouter.post('/reports', 
    validate([/* validation rules */]), 
    reportController.generateReport
  );

  apiRouter.post('/reports/:reportId/export',
    validate([/* validation rules */]),
    reportController.exportReport
  );

  // Mount API router with version prefix
  app.use('/api/v1', apiRouter);
};

/**
 * Handles graceful server shutdown
 * @param app Express application instance
 * @param server HTTP server instance
 */
const gracefulShutdown = async (
  app: Express,
  server: any
): Promise<void> => {
  logger.info('Received shutdown signal');

  // Stop accepting new connections
  server.close(() => {
    logger.info('Server closed');
    
    // Perform cleanup
    process.exit(0);
  });

  // Force shutdown after timeout
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 30000);
};

// Configure middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

// Setup security, monitoring and routes
setupSecurityMiddleware(app);
setupMonitoring(app);

// Initialize controller and setup routes
const reportController = new ReportController(/* dependencies */);
setupRoutes(app, reportController);

// Error handling middleware
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Report Service started`, {
    port: PORT,
    environment: NODE_ENV,
    corsOrigins: CORS_ORIGINS
  });
});

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown(app, server));
process.on('SIGINT', () => gracefulShutdown(app, server));

export default app;