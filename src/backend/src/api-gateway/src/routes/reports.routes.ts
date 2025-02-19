import { Router } from 'express'; // v4.18.2
import helmet from 'helmet'; // v7.0.0
import rateLimit from 'express-rate-limit'; // v6.7.0
import { authenticate, authorize } from '../middleware/auth.middleware';
import { ReportController } from '../../../report-service/src/controllers/report.controller';
import { errorHandler } from '../../shared/middleware/error-handler';
import { HTTP_STATUS_CODES, DATA_ERRORS } from '../../../shared/constants/error-codes';
import { ExportFormat, PageOrientation } from '../../../shared/interfaces/report.interface';

/**
 * Configure report routes with enhanced security and validation
 * @param reportController Initialized ReportController instance
 * @returns Configured Express router
 */
const configureReportRoutes = (reportController: ReportController): Router => {
  const router = Router();

  // Apply security headers
  router.use(helmet({
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
    crossOriginResourcePolicy: { policy: 'same-site' }
  }));

  // Configure rate limiting for report generation
  const reportRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // 50 requests per hour
    message: {
      status: HTTP_STATUS_CODES.RATE_LIMIT,
      code: 'SYS001',
      message: 'Report generation rate limit exceeded',
      details: { windowMs: '1h', limit: 50 }
    }
  });

  // Configure rate limiting for report exports
  const exportRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100, // 100 exports per hour
    message: {
      status: HTTP_STATUS_CODES.RATE_LIMIT,
      code: 'SYS001',
      message: 'Report export rate limit exceeded',
      details: { windowMs: '1h', limit: 100 }
    }
  });

  /**
   * POST /reports - Generate new report
   * Protected: Requires authentication and authorization
   */
  router.post(
    '/',
    authenticate,
    authorize(['admin', 'analyst', 'user']),
    reportRateLimit,
    validateReportRequest,
    async (req, res, next) => {
      try {
        const report = await reportController.generateReport(req, res, next);
        res.status(HTTP_STATUS_CODES.CREATED).json({
          success: true,
          data: report
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /reports/:id - Retrieve specific report
   * Protected: Requires authentication and authorization
   */
  router.get(
    '/:id',
    authenticate,
    authorize(['admin', 'analyst', 'user']),
    cacheControl({ maxAge: 300 }), // 5 minutes cache
    async (req, res, next) => {
      try {
        const report = await reportController.getReport(req, res, next);
        res.status(HTTP_STATUS_CODES.OK).json({
          success: true,
          data: report
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /reports/:id/export - Export report
   * Protected: Requires authentication and authorization
   */
  router.post(
    '/:id/export',
    authenticate,
    authorize(['admin', 'analyst', 'user']),
    exportRateLimit,
    validateExportRequest,
    async (req, res, next) => {
      try {
        const exportResult = await reportController.exportReport(req, res, next);
        res.status(HTTP_STATUS_CODES.OK).json({
          success: true,
          data: exportResult
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * PUT /reports/:id - Update existing report
   * Protected: Requires authentication and elevated privileges
   */
  router.put(
    '/:id',
    authenticate,
    authorize(['admin', 'analyst']),
    validateReportUpdate,
    async (req, res, next) => {
      try {
        const updatedReport = await reportController.updateReport(req, res, next);
        res.status(HTTP_STATUS_CODES.OK).json({
          success: true,
          data: updatedReport
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * DELETE /reports/:id - Delete report
   * Protected: Requires admin privileges
   */
  router.delete(
    '/:id',
    authenticate,
    authorize(['admin']),
    auditLog('report_deletion'),
    async (req, res, next) => {
      try {
        await reportController.deleteReport(req, res, next);
        res.status(HTTP_STATUS_CODES.NO_CONTENT).send();
      } catch (error) {
        next(error);
      }
    }
  );

  // Apply error handling middleware
  router.use(errorHandler);

  return router;
};

/**
 * Middleware to validate report generation request
 */
const validateReportRequest = (req: any, res: any, next: any) => {
  const { name, templateId, metrics } = req.body;

  if (!name || !templateId || !metrics) {
    return next({
      status: HTTP_STATUS_CODES.BAD_REQUEST,
      code: DATA_ERRORS.DATA002,
      message: 'Missing required fields',
      details: { required: ['name', 'templateId', 'metrics'] }
    });
  }

  next();
};

/**
 * Middleware to validate report export request
 */
const validateExportRequest = (req: any, res: any, next: any) => {
  const { format, orientation } = req.body;

  if (format && !Object.values(ExportFormat).includes(format)) {
    return next({
      status: HTTP_STATUS_CODES.BAD_REQUEST,
      code: DATA_ERRORS.DATA003,
      message: 'Invalid export format',
      details: { validFormats: Object.values(ExportFormat) }
    });
  }

  if (orientation && !Object.values(PageOrientation).includes(orientation)) {
    return next({
      status: HTTP_STATUS_CODES.BAD_REQUEST,
      code: DATA_ERRORS.DATA003,
      message: 'Invalid page orientation',
      details: { validOrientations: Object.values(PageOrientation) }
    });
  }

  next();
};

/**
 * Middleware to validate report update request
 */
const validateReportUpdate = (req: any, res: any, next: any) => {
  const { name, metrics } = req.body;

  if (!name && !metrics) {
    return next({
      status: HTTP_STATUS_CODES.BAD_REQUEST,
      code: DATA_ERRORS.DATA002,
      message: 'No valid update fields provided',
      details: { updateable: ['name', 'metrics'] }
    });
  }

  next();
};

/**
 * Middleware for cache control headers
 */
const cacheControl = ({ maxAge }: { maxAge: number }) => {
  return (req: any, res: any, next: any) => {
    res.set('Cache-Control', `private, max-age=${maxAge}`);
    next();
  };
};

/**
 * Middleware for audit logging
 */
const auditLog = (action: string) => {
  return (req: any, res: any, next: any) => {
    // Implement audit logging logic here
    next();
  };
};

export default configureReportRoutes;