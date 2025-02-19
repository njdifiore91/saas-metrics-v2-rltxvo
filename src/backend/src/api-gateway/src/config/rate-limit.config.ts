/**
 * Rate limiting configuration for API Gateway
 * Uses Redis-based distributed rate limiting with high availability
 * @module rate-limit.config
 * @version 1.0.0
 */

// External dependencies
// express-rate-limit v6.7.0
import rateLimit from 'express-rate-limit';
// rate-limit-redis v3.0.0
import RedisStore from 'rate-limit-redis';
// ioredis v5.0.0
import Redis from 'ioredis';

// Internal dependencies
import { SYSTEM_ERRORS, HTTP_STATUS_CODES } from '../../../shared/constants/error-codes';

// Rate limiting constants
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 100; // 100 requests per window
const REDIS_RATE_LIMIT_PREFIX = 'ratelimit:';
const REDIS_RATE_LIMIT_TTL = RATE_LIMIT_WINDOW_MS / 1000;

/**
 * Creates and configures Redis store for distributed rate limiting
 * @param redisClient - Configured Redis client instance
 * @returns Configured RedisStore instance
 */
const createRateLimitStore = (redisClient: Redis): RedisStore => {
  return new RedisStore({
    client: redisClient,
    prefix: REDIS_RATE_LIMIT_PREFIX,
    resetExpiryOnChange: true,
    expiry: REDIS_RATE_LIMIT_TTL,
    // Handle Redis connection errors gracefully
    sendCommand: (...args: unknown[]) => {
      try {
        return redisClient.call(...args);
      } catch (error) {
        console.error('Rate limit Redis store error:', error);
        return Promise.reject(error);
      }
    }
  });
};

/**
 * Custom rate limit exceeded handler with RFC 7807 compliance
 * @param req - Express request object
 * @param res - Express response object
 */
const createRateLimitHandler = (req: Request, res: Response): void => {
  const retryAfter = Math.ceil(RATE_LIMIT_WINDOW_MS / 1000);
  
  const errorResponse = {
    type: 'about:blank',
    title: 'Too Many Requests',
    status: HTTP_STATUS_CODES.RATE_LIMIT,
    code: SYSTEM_ERRORS.SYS001,
    message: 'Rate limit exceeded. Please try again later.',
    details: {
      limit: MAX_REQUESTS_PER_WINDOW,
      windowMs: RATE_LIMIT_WINDOW_MS,
      retryAfter
    }
  };

  res.setHeader('Retry-After', retryAfter.toString());
  res.status(HTTP_STATUS_CODES.RATE_LIMIT).json(errorResponse);
};

/**
 * Rate limiting configuration object
 * Implements token bucket algorithm with Redis-based distributed store
 */
export const rateLimitConfig = {
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: MAX_REQUESTS_PER_WINDOW,
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable legacy X-RateLimit headers
  store: undefined as RedisStore | undefined, // Will be set when Redis client is available
  handler: createRateLimitHandler,
  skipFailedRequests: false,
  skipSuccessfulRequests: false,
  
  // Custom headers configuration
  headers: {
    remaining: 'X-RateLimit-Remaining',
    reset: 'X-RateLimit-Reset',
    total: 'X-RateLimit-Limit',
    retryAfter: 'Retry-After'
  },

  // Method to initialize store with Redis client
  initializeStore: (redisClient: Redis): void => {
    rateLimitConfig.store = createRateLimitStore(redisClient);
  },

  // Middleware factory method
  createMiddleware: (): ReturnType<typeof rateLimit> => {
    if (!rateLimitConfig.store) {
      throw new Error('Rate limit store not initialized. Call initializeStore first.');
    }
    return rateLimit({
      ...rateLimitConfig,
      store: rateLimitConfig.store
    });
  }
};