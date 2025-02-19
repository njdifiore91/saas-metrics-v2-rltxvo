import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit'; // v6.7.0
import helmet from 'helmet'; // v6.0.0
import winston from 'winston'; // v3.8.0
import { v4 as uuidv4 } from 'uuid'; // v9.0.0
import { AuthService } from '../../auth-service/src/services/auth.service';
import { AUTH_ERRORS, ErrorResponse, HTTP_STATUS_CODES } from '../../../shared/constants/error-codes';

// Configure rate limiting for authentication attempts
const AUTH_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    type: 'https://auth.api.startup-metrics.com/errors/rate-limit',
    status: HTTP_STATUS_CODES.RATE_LIMIT,
    code: 'SYS001',
    message: 'Authentication rate limit exceeded',
    details: { windowMs: '15m', limit: 100 },
    instance: '/api/auth'
  }
};

// Configure security headers
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

// Interface for authorization options
interface AuthorizationOptions {
  requireAll?: boolean;
  permissions?: string[];
  customCheck?: (req: Request) => boolean | Promise<boolean>;
}

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'auth-middleware' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'auth-events.log' })
  ]
});

/**
 * Enhanced authentication middleware with comprehensive security controls
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const correlationId = uuidv4();
  req.headers['x-correlation-id'] = correlationId;

  try {
    // Apply rate limiting
    await rateLimit(AUTH_RATE_LIMIT)(req, res, () => {});

    // Apply security headers
    securityHeaders(req, res, () => {});

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error(AUTH_ERRORS.AUTH003);
    }

    const token = authHeader.split(' ')[1];

    // Initialize AuthService (assuming injection is handled by your DI container)
    const authService = new AuthService(null, null, logger);

    // Check token blacklist
    const isBlacklisted = await authService.checkTokenBlacklist(token);
    if (isBlacklisted) {
      throw new Error(AUTH_ERRORS.AUTH001);
    }

    // Validate session
    const session = await authService.validateSession(token);
    if (!session) {
      throw new Error(AUTH_ERRORS.AUTH004);
    }

    // Check concurrent sessions
    const validSession = await authService.validateConcurrentSessions(
      session.userId,
      session.sessionId
    );
    if (!validSession) {
      throw new Error(AUTH_ERRORS.AUTH005);
    }

    // Refresh session if needed
    const refreshedToken = await authService.refreshSession(token);
    if (refreshedToken) {
      res.setHeader('X-Refresh-Token', refreshedToken);
    }

    // Attach user context to request
    req.user = session;

    // Log successful authentication
    logger.info('Authentication successful', {
      correlationId,
      userId: session.userId,
      sessionId: session.sessionId
    });

    next();
  } catch (error) {
    const errorResponse: ErrorResponse = {
      type: 'https://auth.api.startup-metrics.com/errors/auth-failed',
      status: HTTP_STATUS_CODES.UNAUTHORIZED,
      code: (error as Error).message || AUTH_ERRORS.AUTH003,
      message: 'Authentication failed',
      details: { error: (error as Error).message, correlationId },
      instance: req.originalUrl
    };

    logger.error('Authentication failed', {
      correlationId,
      error: (error as Error).message,
      request: {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip
      }
    });

    res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json(errorResponse);
  }
};

/**
 * Enhanced RBAC middleware with detailed security logging
 */
export const authorize = (
  allowedRoles: string[],
  options: AuthorizationOptions = {}
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const correlationId = req.headers['x-correlation-id'] as string;

    try {
      if (!req.user) {
        throw new Error(AUTH_ERRORS.AUTH003);
      }

      const hasRole = allowedRoles.includes(req.user.role);
      const hasPermissions = options.permissions
        ? options.requireAll
          ? options.permissions.every(p => req.user.permissions.includes(p))
          : options.permissions.some(p => req.user.permissions.includes(p))
        : true;

      const customCheckPassed = options.customCheck
        ? await options.customCheck(req)
        : true;

      if (!(hasRole && hasPermissions && customCheckPassed)) {
        throw new Error(AUTH_ERRORS.AUTH002);
      }

      logger.info('Authorization successful', {
        correlationId,
        userId: req.user.userId,
        role: req.user.role,
        permissions: req.user.permissions
      });

      next();
    } catch (error) {
      const errorResponse: ErrorResponse = {
        type: 'https://auth.api.startup-metrics.com/errors/authorization-failed',
        status: HTTP_STATUS_CODES.FORBIDDEN,
        code: (error as Error).message || AUTH_ERRORS.AUTH002,
        message: 'Authorization failed',
        details: { error: (error as Error).message, correlationId },
        instance: req.originalUrl
      };

      logger.error('Authorization failed', {
        correlationId,
        userId: req.user?.userId,
        role: req.user?.role,
        requiredRoles: allowedRoles,
        requiredPermissions: options.permissions
      });

      res.status(HTTP_STATUS_CODES.FORBIDDEN).json(errorResponse);
    }
  };
};

// Export security configuration interface
export interface SecurityConfig {
  rateLimit: typeof AUTH_RATE_LIMIT;
  sessionConfig: {
    maxConcurrentSessions: number;
    sessionDuration: string;
    refreshThreshold: string;
  };
}