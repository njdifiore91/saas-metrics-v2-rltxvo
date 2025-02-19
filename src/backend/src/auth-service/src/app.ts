import express, { Express, Request, Response, NextFunction } from 'express'; // v4.18.2
import cors from 'cors'; // v2.8.5
import helmet from 'helmet'; // v6.0.0
import cookieParser from 'cookie-parser'; // v1.4.6
import morgan from 'morgan'; // v1.10.0
import { rateLimit } from 'express-rate-limit'; // v6.7.0
import Redis from 'ioredis'; // v5.3.0
import winston from 'winston'; // v3.8.0
import { RateLimiterRedis } from 'rate-limiter-flexible'; // v6.0.0

import { createGoogleOAuthClient } from './config/google-oauth.config';
import { JWT_CONFIG } from './config/jwt.config';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { AUTH_ERRORS, HTTP_STATUS_CODES, ErrorResponse } from '../../shared/constants/error-codes';

// Environment variables validation
const PORT = process.env.AUTH_SERVICE_PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const REDIS_URL = process.env.REDIS_URL;
const MAX_CONCURRENT_SESSIONS = Number(process.env.MAX_CONCURRENT_SESSIONS) || 3;

// Initialize logger
const logger = winston.createLogger({
  level: NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'auth-service-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'auth-service-combined.log' })
  ]
});

// Initialize Redis client
const redisClient = new Redis(REDIS_URL!, {
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => Math.min(times * 50, 2000)
});

redisClient.on('error', (error) => {
  logger.error('Redis connection error:', error);
});

// Initialize rate limiter
const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'ratelimit:auth',
  points: 10, // Number of requests
  duration: 1, // Per second
  blockDuration: 600 // Block for 10 minutes if limit exceeded
});

// Initialize Express application
const app: Express = express();

// Security middleware configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://accounts.google.com'],
      frameSrc: ["'self'", 'https://accounts.google.com'],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-site' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true
}));

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 600 // Cache preflight requests for 10 minutes
}));

// Request parsing middleware
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser(process.env.COOKIE_SECRET));

// Request logging
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) }
}));

// Rate limiting middleware
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: AUTH_ERRORS.AUTH001 },
  standardHeaders: true,
  legacyHeaders: false
}));

// Initialize services and controllers
const googleOAuthClient = createGoogleOAuthClient();
const authService = new AuthService(null, redisClient, logger);
const authController = new AuthController(authService, rateLimiter, logger);

// Authentication routes
app.get('/auth/google', authController.initiateGoogleAuth);
app.get('/auth/google/callback', authController.handleGoogleCallback);
app.post('/auth/refresh', authController.refreshToken);
app.post('/auth/logout', authController.logout);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(HTTP_STATUS_CODES.OK).json({ status: 'healthy' });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const errorResponse: ErrorResponse = {
    type: 'https://auth.api.startup-metrics.com/errors',
    status: HTTP_STATUS_CODES.SERVER_ERROR,
    code: AUTH_ERRORS.AUTH003,
    message: 'Internal server error',
    details: { error: err.message },
    instance: req.originalUrl
  };

  logger.error('Unhandled error:', {
    error: err,
    path: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  res.status(errorResponse.status).json(errorResponse);
});

// Graceful shutdown handler
const gracefulShutdown = async () => {
  logger.info('Received shutdown signal. Closing connections...');
  
  try {
    await redisClient.quit();
    logger.info('Redis connection closed');
  } catch (error) {
    logger.error('Error closing Redis connection:', error);
  }
  
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Export app for testing and deployment
export { app };