/**
 * API Gateway Application Configuration
 * Implements comprehensive security controls, monitoring, and routing
 * for the Startup Metrics Benchmarking Platform
 * @version 1.0.0
 */

import express from 'express'; // v4.18.2
import cors from 'cors'; // v2.8.5
import helmet from 'helmet'; // v6.0.0
import compression from 'compression'; // v1.7.4
import { expressjwt } from 'express-jwt'; // v8.4.1
import { expressjwt as jwt } from 'express-jwt'; // v8.4.1
import { expressjwt as expressJwt } from 'express-jwt'; // v8.4.1

// Import routes and middleware
import router from './routes';
import { corsConfig } from './config/cors.config';
import { rateLimitConfig } from './config/rate-limit.config';
import { authenticate } from './middleware/auth.middleware';
import { errorHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/logging.middleware';

// Initialize Express application
const app = express();

/**
 * Configures comprehensive Express application middleware stack
 * with security, performance, and monitoring features
 * @param app Express application instance
 */
const configureMiddleware = (app: express.Application): void => {
  // Security middleware
  app.use(helmet({
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
  }));

  // CORS configuration
  app.use(cors(corsConfig));

  // Body parsing middleware
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));

  // Response compression
  app.use(compression());

  // Rate limiting
  app.use(rateLimitConfig.createMiddleware());

  // Request correlation ID and logging
  app.use(requestLogger);

  // JWT authentication
  app.use(
    jwt({
      secret: process.env.JWT_PUBLIC_KEY!,
      algorithms: ['RS256'],
      credentialsRequired: false
    })
  );

  // Mount API routes
  app.use('/api/v1', router);

  // Error handling middleware
  app.use(errorHandler);
};

/**
 * Starts the Express application server with proper error handling
 * and graceful shutdown
 * @param app Express application instance
 */
const startServer = async (app: express.Application): Promise<void> => {
  try {
    // Configure middleware
    configureMiddleware(app);

    // Get port from environment variables
    const port = process.env.PORT || 3000;

    // Start server
    const server = app.listen(port, () => {
      console.log(`API Gateway listening on port ${port}`);
    });

    // Graceful shutdown handler
    process.on('SIGTERM', () => {
      console.log('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Initialize server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  startServer(app);
}

export { app, startServer };