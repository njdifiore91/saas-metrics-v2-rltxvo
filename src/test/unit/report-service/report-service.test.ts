import { ReportService } from '../../../backend/src/report-service/src/services/report.service';
import { 
  mockReportDefinitions, 
  mockReportTemplates, 
  mockBenchmarkReportData,
  mockExportOptions 
} from '../../mocks/report-data.mock';
import { 
  ReportType, 
  ExportFormat, 
  PageOrientation 
} from '../../../backend/src/shared/interfaces/report.interface';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import winston from 'winston';
import { createClient } from 'cache-manager';
import CryptoJS from 'crypto-js';

// Mock implementations
jest.mock('@aws-sdk/client-s3');
jest.mock('winston');
jest.mock('cache-manager');
jest.mock('crypto-js');

describe('ReportService', () => {
  let reportService: ReportService;
  let mockS3Client: jest.Mocked<S3Client>;
  let mockLogger: jest.Mocked<winston.Logger>;
  let mockCache: jest.Mocked<any>;
  let mockSecurityManager: jest.Mocked<any>;

  beforeAll(async () => {
    // Initialize mocks
    mockS3Client = new S3Client({}) as jest.Mocked<S3Client>;
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    } as unknown as jest.Mocked<winston.Logger>;
    mockCache = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn()
    };
    mockSecurityManager = {
      validateAccess: jest.fn(),
      encryptData: jest.fn(),
      decryptData: jest.fn()
    };

    // Initialize ReportService with mocks
    reportService = new ReportService(
      mockS3Client,
      mockLogger,
      mockCache,
      mockSecurityManager
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
  });

  describe('generateReport', () => {
    it('should successfully generate a report with valid data', async () => {
      const reportData = mockReportDefinitions[0];
      const type = ReportType.BENCHMARK_COMPARISON;
      const classification = 'CONFIDENTIAL';

      mockSecurityManager.validateAccess.mockResolvedValue(true);
      mockCache.set.mockResolvedValue(undefined);

      const result = await reportService.generateReport(reportData, type, classification);

      expect(result).toBeDefined();
      expect(result.id).toBe(reportData.id);
      expect(result.securityClassification).toBe(classification);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Report generated',
        expect.objectContaining({
          reportId: reportData.id,
          type,
          classification
        })
      );
    });

    it('should handle report generation with benchmark data', async () => {
      const reportData = {
        ...mockReportDefinitions[0],
        benchmarkData: mockBenchmarkReportData
      };

      const result = await reportService.generateReport(
        reportData,
        ReportType.BENCHMARK_COMPARISON,
        'CONFIDENTIAL'
      );

      expect(result.benchmarkData).toBeDefined();
      expect(result.benchmarkData.length).toBeGreaterThan(0);
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should throw error for invalid report data', async () => {
      const invalidReportData = { ...mockReportDefinitions[0], id: undefined };

      await expect(
        reportService.generateReport(invalidReportData, ReportType.BENCHMARK_COMPARISON, 'CONFIDENTIAL')
      ).rejects.toThrow('Invalid report data');
    });

    it('should encrypt sensitive data in report', async () => {
      const reportData = mockReportDefinitions[0];
      mockSecurityManager.encryptData.mockReturnValue('encrypted-data');

      const result = await reportService.generateReport(
        reportData,
        ReportType.BENCHMARK_COMPARISON,
        'CONFIDENTIAL'
      );

      expect(mockSecurityManager.encryptData).toHaveBeenCalled();
      expect(result.description).toBe('encrypted-data');
    });
  });

  describe('exportReport', () => {
    it('should successfully export report to PDF', async () => {
      const reportId = mockReportDefinitions[0].id;
      const options = mockExportOptions.pdf;

      mockCache.get.mockResolvedValue(mockReportDefinitions[0]);
      mockS3Client.send.mockResolvedValue({});

      const result = await reportService.exportReport(reportId, ExportFormat.PDF, options);

      expect(result).toBeDefined();
      expect(result.url).toContain(reportId);
      expect(result.metadata.format).toBe(ExportFormat.PDF);
      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.any(PutObjectCommand)
      );
    });

    it('should handle Excel export with data protection', async () => {
      const reportId = mockReportDefinitions[0].id;
      const options = {
        ...mockExportOptions.excel,
        password: 'test-password'
      };

      mockCache.get.mockResolvedValue(mockReportDefinitions[0]);

      const result = await reportService.exportReport(reportId, ExportFormat.EXCEL, options);

      expect(result.metadata.format).toBe(ExportFormat.EXCEL);
      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Metadata: expect.objectContaining({
              'x-amz-password': 'test-password'
            })
          })
        })
      );
    });

    it('should throw error for non-existent report', async () => {
      mockCache.get.mockResolvedValue(null);

      await expect(
        reportService.exportReport('invalid-id', ExportFormat.PDF, mockExportOptions.pdf)
      ).rejects.toThrow('Report not found');
    });

    it('should handle compression for large reports', async () => {
      const reportId = mockReportDefinitions[0].id;
      const options = {
        ...mockExportOptions.pdf,
        compression: true
      };

      mockCache.get.mockResolvedValue(mockReportDefinitions[0]);

      const result = await reportService.exportReport(reportId, ExportFormat.PDF, options);

      expect(result.metadata.size).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Report exported',
        expect.objectContaining({
          reportId,
          format: ExportFormat.PDF
        })
      );
    });
  });

  describe('validateBenchmarkData', () => {
    it('should validate benchmark data accuracy', async () => {
      const benchmarkData = mockBenchmarkReportData[0];

      const result = await reportService.validateBenchmarkData(benchmarkData);

      expect(result).toBe(true);
      expect(benchmarkData.p10Value).toBeLessThan(benchmarkData.p90Value);
      expect(benchmarkData.confidenceLevel).toBeGreaterThanOrEqual(0.95);
    });

    it('should reject invalid benchmark data', async () => {
      const invalidBenchmarkData = {
        ...mockBenchmarkReportData[0],
        p90Value: 0,
        p10Value: 100
      };

      await expect(
        reportService.validateBenchmarkData(invalidBenchmarkData)
      ).rejects.toThrow('Invalid benchmark data distribution');
    });
  });

  describe('verifyReportAccess', () => {
    it('should verify user access to report', async () => {
      const reportId = mockReportDefinitions[0].id;
      const userId = 'test-user-1';

      mockSecurityManager.validateAccess.mockResolvedValue(true);

      const result = await reportService.verifyReportAccess(reportId, userId);

      expect(result).toBe(true);
      expect(mockSecurityManager.validateAccess).toHaveBeenCalledWith(
        reportId,
        userId
      );
    });

    it('should deny access for unauthorized user', async () => {
      mockSecurityManager.validateAccess.mockResolvedValue(false);

      const result = await reportService.verifyReportAccess(
        mockReportDefinitions[0].id,
        'unauthorized-user'
      );

      expect(result).toBe(false);
    });
  });

  describe('performance metrics', () => {
    it('should track report generation time', async () => {
      const startTime = Date.now();
      
      await reportService.generateReport(
        mockReportDefinitions[0],
        ReportType.BENCHMARK_COMPARISON,
        'CONFIDENTIAL'
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Report generation time',
        expect.objectContaining({
          duration: expect.any(Number)
        })
      );
    });

    it('should monitor cache performance', async () => {
      const reportId = mockReportDefinitions[0].id;

      // First call - cache miss
      mockCache.get.mockResolvedValueOnce(null);
      await reportService.exportReport(reportId, ExportFormat.PDF, mockExportOptions.pdf);

      // Second call - cache hit
      mockCache.get.mockResolvedValueOnce(mockReportDefinitions[0]);
      await reportService.exportReport(reportId, ExportFormat.PDF, mockExportOptions.pdf);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Cache performance',
        expect.objectContaining({
          hit: true,
          reportId
        })
      );
    });
  });
});