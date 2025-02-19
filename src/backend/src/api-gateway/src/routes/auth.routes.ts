import { Router, Request, Response } from 'express'; // v4.18.2
import helmet from 'helmet'; // v4.6.0
import rateLimit from 'express-rate-limit'; // v6.7.0
import csurf from 'csurf'; // v1.11.0

import { authenticate, handleTokenRefresh } from '../middleware/auth.middleware';
import { AuthController } from '../../auth-service/src/controllers/auth.controller';

// Initialize router
const router = Router();

// Security configuration
const RATE_LIMIT_CONFIG = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    type: 'https://auth.api.startup-metrics.com/errors/rate-limit',
    status: 429,
    code: 'SYS001',
    message: 'Too many authentication attempts, please try again later',
    details: { windowMs: '15m', limit: 100 },
    instance: '/api/auth'
  }
};

// CSRF protection middleware
const csrfProtection = csurf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
});

// Security headers configuration
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
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

// Apply global security middleware
router.use(securityHeaders);
router.use(rateLimit(RATE_LIMIT_CONFIG));

// Initialize auth controller
const authController = new AuthController();

/**
 * Google OAuth callback endpoint
 * Handles the OAuth 2.0 callback with CSRF protection and rate limiting
 */
router.get(
  '/auth/google/callback',
  rateLimit({
    ...RATE_LIMIT_CONFIG,
    max: 5 // Stricter limit for callback endpoint
  }),
  authController.googleAuthCallback
);

/**
 * Session validation endpoint
 * Validates current user session with rate limiting
 */
router.get(
  '/auth/validate',
  authenticate,
  rateLimit({
    ...RATE_LIMIT_CONFIG,
    max: 50 // Moderate limit for session validation
  }),
  authController.validateSession
);

/**
 * Token refresh endpoint
 * Handles JWT token refresh with sliding session
 */
router.post(
  '/auth/refresh',
  handleTokenRefresh,
  rateLimit({
    ...RATE_LIMIT_CONFIG,
    max: 20 // Limited token refresh attempts
  }),
  authController.refreshToken
);

/**
 * Logout endpoint
 * Handles user logout with CSRF protection
 */
router.post(
  '/auth/logout',
  authenticate,
  csrfProtection,
  authController.logout
);

/**
 * Error handling middleware
 * Implements RFC 7807 Problem Details for HTTP APIs
 */
router.use((err: any, req: Request, res: Response) => {
  const errorResponse = {
    type: 'https://auth.api.startup-metrics.com/errors',
    status: err.status || 500,
    code: err.code || 'AUTH003',
    message: err.message || 'Authentication error occurred',
    details: { error: err.message },
    instance: req.originalUrl
  };

  res.status(errorResponse.status).json(errorResponse);
});

export default router;