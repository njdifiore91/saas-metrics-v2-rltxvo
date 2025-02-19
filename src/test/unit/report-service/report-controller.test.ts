import { Request, Response, NextFunction } from 'express'; // v4.18.2
import { ReportController } from '../../../backend/src/report-service/src/controllers/report.controller';
import { ReportService } from '../../../backend/src/report-service/src/services/report.service';
import { 
  IReportDefinition, 
  ReportType, 
  ExportFormat, 
  PageOrientation 
} from '../../../backend/src/shared/interfaces/report.interface';
import { HTTP_STATUS_CODES, DATA_ERRORS } from '../../../backend/src/shared/constants/error-codes';
import { Logger } from '../../../backend/src/shared/utils/logger';

// Mock dependencies
jest.mock('../../../backend/src/report-service/src/services/report.service');
jest.mock('../../../backend/src/shared/utils/logger');

describe('ReportController', () => {
  let reportController: ReportController;
  let mockReportService: jest.Mocked<ReportService>;
  let mockSecurityManager: any;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    // Initialize mocks
    mockReportService = {
      generateReport: jest.fn(),
      exportReport: jest.fn(),
      getReport: jest.fn(),
      updateReport: jest.fn(),
      deleteReport: jest.fn(),
      getExportCount: jest.fn()
    } as any;

    mockSecurityManager = {
      verifyAccess: jest.fn()
    };

    mockRequest = {
      user: { id: 'test-user-id' },
      body: {},
      params: {},
      protocol: 'https',
      get: jest.fn().mockReturnValue('test.host'),
      originalUrl: '/api/reports'
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn()
    };

    mockNext = jest.fn();

    // Initialize controller
    reportController = new ReportController(mockReportService, mockSecurityManager);
  });

  describe('generateReport', () => {
    const validReportData: IReportDefinition = {
      id: 'test-report-id',
      name: 'Test Report',
      description: 'Test Description',
      templateId: 'test-template-id',
      createdBy: 'test-user',
      createdAt: new Date(),
      lastModifiedAt: new Date(),
      lastModifiedBy: 'test-user',
      version: 1
    };

    it('should successfully generate a report with valid security classification', async () => {
      // Arrange
      mockRequest.body = validReportData;
      mockSecurityManager.verifyAccess.mockResolvedValue(true);
      mockReportService.generateReport.mockResolvedValue({
        ...validReportData,
        securityClassification: 'CONFIDENTIAL'
      });

      // Act
      await reportController.generateReport(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockSecurityManager.verifyAccess).toHaveBeenCalled();
      expect(mockReportService.generateReport).toHaveBeenCalledWith(
        validReportData,
        ReportType.BENCHMARK_COMPARISON,
        expect.any(String)
      );
      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS_CODES.CREATED);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            id: validReportData.id,
            securityClassification: 'CONFIDENTIAL'
          })
        })
      );
    });

    it('should return 400 for invalid report data', async () => {
      // Arrange
      mockRequest.body = { ...validReportData, id: undefined };

      // Act
      await reportController.generateReport(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: DATA_ERRORS.DATA002
        })
      );
    });

    it('should return 403 for insufficient permissions', async () => {
      // Arrange
      mockRequest.body = validReportData;
      mockSecurityManager.verifyAccess.mockRejectedValue(new Error('Insufficient permissions'));

      // Act
      await reportController.generateReport(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Insufficient permissions'
        })
      );
    });
  });

  describe('exportReport', () => {
    const validExportOptions = {
      format: ExportFormat.PDF,
      includeCharts: true,
      includeTables: true,
      orientation: PageOrientation.PORTRAIT,
      paperSize: 'A4',
      compression: true
    };

    it('should successfully export encrypted PDF report', async () => {
      // Arrange
      mockRequest.params = { reportId: 'test-report-id' };
      mockRequest.body = validExportOptions;
      mockReportService.getExportCount.mockResolvedValue(5);
      mockReportService.exportReport.mockResolvedValue({
        url: 'https://test-url.com/report.pdf',
        metadata: {
          format: ExportFormat.PDF,
          size: 1024,
          generatedAt: new Date()
        }
      });

      // Act
      await reportController.exportReport(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockReportService.exportReport).toHaveBeenCalledWith(
        'test-report-id',
        ExportFormat.PDF,
        expect.objectContaining(validExportOptions)
      );
      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS_CODES.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            url: expect.any(String),
            metadata: expect.any(Object)
          })
        })
      );
    });

    it('should return 429 when export rate limit is exceeded', async () => {
      // Arrange
      mockRequest.params = { reportId: 'test-report-id' };
      mockRequest.body = validExportOptions;
      mockReportService.getExportCount.mockResolvedValue(10);

      // Act
      await reportController.exportReport(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Export rate limit exceeded'
        })
      );
    });

    it('should return 400 for invalid export format', async () => {
      // Arrange
      mockRequest.params = { reportId: 'test-report-id' };
      mockRequest.body = { ...validExportOptions, format: 'INVALID' };

      // Act
      await reportController.exportReport(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid export format'
        })
      );
    });

    it('should validate password requirements for encrypted exports', async () => {
      // Arrange
      mockRequest.params = { reportId: 'test-report-id' };
      mockRequest.body = { ...validExportOptions, password: '123' };

      // Act
      await reportController.exportReport(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Password must be at least 8 characters'
        })
      );
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});