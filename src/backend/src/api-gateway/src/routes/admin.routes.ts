/**
 * Admin Routes Configuration
 * Implements secure admin API endpoints with comprehensive security controls,
 * rate limiting, audit logging, and RFC 7807 compliant error handling.
 * @version 1.0.0
 */

import { Router } from 'express'; // v4.18.2
import helmet from 'helmet'; // v7.0.0
import { body, param, query } from 'express-validator'; // v7.0.1
import rateLimit from 'express-rate-limit'; // v6.7.0

import { authenticate, authorize } from '../middleware/auth.middleware';
import { AdminController } from '../../admin-service/src/controllers/admin.controller';
import { errorHandler } from '../middleware/error.middleware';
import { UserRole } from '../../shared/interfaces/user.interface';

// Initialize router and controller
const router = Router();
const adminController = new AdminController();

// Security configuration
const RATE_LIMIT_CONFIG = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    type: 'https://api.startup-metrics.com/errors/rate-limit',
    status: 429,
    code: 'SYS001',
    message: 'Rate limit exceeded for admin operations',
    details: { windowMs: '15m', limit: 100 },
    instance: '/api/admin'
  }
};

// Apply security middleware to all admin routes
router.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'"],
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

// Apply authentication and admin role authorization to all routes
router.use(authenticate);
router.use(authorize([UserRole.ADMIN]));
router.use(rateLimit(RATE_LIMIT_CONFIG));

// GET /api/admin/users - List admin users with pagination
router.get('/users',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('sortBy').optional().isString(),
    query('sortOrder').optional().isIn(['asc', 'desc'])
  ],
  adminController.getRateLimiter(),
  adminController.listAdmins
);

// POST /api/admin/users - Create new admin user
router.post('/users',
  [
    body('email').isEmail(),
    body('name').isString().trim().isLength({ min: 2 }),
    body('password').isString().isLength({ min: 12 }),
    body('mfaEnabled').optional().isBoolean(),
    body('securityQuestions').optional().isArray()
  ],
  adminController.getRateLimiter(),
  adminController.createAdmin
);

// GET /api/admin/users/:id - Get admin user by ID
router.get('/users/:id',
  [
    param('id').isUUID()
  ],
  adminController.getRateLimiter(),
  adminController.getAdmin
);

// PUT /api/admin/users/:id - Update admin user
router.put('/users/:id',
  [
    param('id').isUUID(),
    body('email').optional().isEmail(),
    body('name').optional().isString().trim().isLength({ min: 2 }),
    body('password').optional().isString().isLength({ min: 12 }),
    body('mfaEnabled').optional().isBoolean(),
    body('securityQuestions').optional().isArray(),
    body('isActive').optional().isBoolean()
  ],
  adminController.getRateLimiter(),
  adminController.updateAdmin
);

// DELETE /api/admin/users/:id - Delete admin user
router.delete('/users/:id',
  [
    param('id').isUUID()
  ],
  adminController.getRateLimiter(),
  adminController.deleteAdmin
);

// Apply error handling middleware
router.use(errorHandler);

export { router as adminRouter };