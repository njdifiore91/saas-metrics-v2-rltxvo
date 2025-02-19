/**
 * Enhanced Report Controller for the Startup Metrics Benchmarking Platform
 * Handles HTTP requests for report generation, management, and export operations
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express';  // v4.18.2
import { ReportService } from '../services/report.service';
import { 
  IReportDefinition, 
  IReportExportOptions,
  ReportType,
  ExportFormat,
  PageOrientation 
} from '../../shared/interfaces/report.interface';
import { errorHandler } from '../../shared/middleware/error-handler';
import { Logger } from '../../shared/utils/logger';
import { HTTP_STATUS_CODES, DATA_ERRORS } from '../../shared/constants/error-codes';

/**
 * Enhanced Express controller class handling HTTP requests for secure report operations
 */
export class ReportController {
  private readonly logger: Logger;

  constructor(
    private readonly reportService: ReportService,
    private readonly securityManager: any
  ) {
    this.logger = new Logger('ReportController');
  }

  /**
   * Handles POST request to generate a new report with enhanced security
   * @param req Express request object
   * @param res Express response object
   * @param next Express next function
   */
  public generateReport = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const correlationId = `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Validate request body
      const reportData: IReportDefinition = req.body;
      if (!this.validateReportData(reportData)) {
        throw new Error(DATA_ERRORS.DATA002);
      }

      // Verify security classification
      await this.securityManager.verifyAccess(req.user, reportData.securityClassification);

      // Generate report with security context
      const report = await this.reportService.generateReport(
        reportData,
        ReportType.BENCHMARK_COMPARISON,
        reportData.securityClassification
      );

      // Log successful generation
      this.logger.info('Report generated successfully', {
        reportId: report.id,
        userId: req.user?.id,
        correlationId
      });

      // Set security headers
      this.setSecurityHeaders(res);

      res.status(HTTP_STATUS_CODES.CREATED).json({
        success: true,
        data: report,
        metadata: {
          correlationId,
          generatedAt: new Date(),
          securityClassification: report.securityClassification
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Handles POST request to export a report with enhanced security features
   * @param req Express request object
   * @param res Express response object
   * @param next Express next function
   */
  public exportReport = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { reportId } = req.params;
      const exportOptions: IReportExportOptions = {
        format: req.body.format || ExportFormat.PDF,
        includeCharts: req.body.includeCharts ?? true,
        includeTables: req.body.includeTables ?? true,
        orientation: req.body.orientation || PageOrientation.PORTRAIT,
        paperSize: req.body.paperSize || 'A4',
        compression: req.body.compression ?? true,
        password: req.body.password
      };

      // Validate export options
      this.validateExportOptions(exportOptions);

      // Check rate limits
      await this.checkRateLimits(req.user?.id);

      // Export report with security features
      const exportResult = await this.reportService.exportReport(
        reportId,
        exportOptions.format,
        exportOptions
      );

      // Log export operation
      this.logger.info('Report exported successfully', {
        reportId,
        userId: req.user?.id,
        format: exportOptions.format,
        timestamp: new Date()
      });

      // Set security headers
      this.setSecurityHeaders(res);

      res.status(HTTP_STATUS_CODES.OK).json({
        success: true,
        data: exportResult,
        metadata: {
          exportedAt: new Date(),
          expiresAt: new Date(Date.now() + 3600000) // 1 hour expiry
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Validates report data against schema
   * @param reportData Report data to validate
   * @returns Validation result
   */
  private validateReportData(reportData: IReportDefinition): boolean {
    return !!(
      reportData &&
      reportData.id &&
      reportData.name &&
      reportData.templateId &&
      reportData.createdBy
    );
  }

  /**
   * Validates export options
   * @param options Export options to validate
   */
  private validateExportOptions(options: IReportExportOptions): void {
    if (!Object.values(ExportFormat).includes(options.format)) {
      throw new Error('Invalid export format');
    }

    if (options.password && options.password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }
  }

  /**
   * Checks rate limits for export operations
   * @param userId User identifier
   */
  private async checkRateLimits(userId: string): Promise<void> {
    // Implement rate limiting logic
    const limit = 10; // 10 exports per hour
    const current = await this.reportService.getExportCount(userId);
    
    if (current >= limit) {
      throw new Error('Export rate limit exceeded');
    }
  }

  /**
   * Sets security headers for responses
   * @param res Express response object
   */
  private setSecurityHeaders(res: Response): void {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'");
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  }
}