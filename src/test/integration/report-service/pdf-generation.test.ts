import { ReportService } from '../../../backend/src/report-service/src/services/report.service';
import { setupTestServer, teardownTestServer } from '../../utils/test-server';
import { mockReportDefinitions, mockBenchmarkReportData } from '../../mocks/report-data.mock';
import PDFDocument from 'pdfkit';
import { PDFValidator } from 'pdf-lib';
import { StorageValidator } from '@aws-sdk/client-s3';
import { ExportFormat, PageOrientation } from '../../../backend/src/shared/interfaces/report.interface';

describe('PDF Report Generation Integration Tests', () => {
  let reportService: ReportService;
  let pdfValidator: PDFValidator;
  let storageValidator: StorageValidator;
  let testReportId: string;
  let tempPDFPath: string;

  beforeAll(async () => {
    // Initialize test environment with security configurations
    await setupTestServer({
      enableSecurity: true,
      enableCompression: true,
      timeoutMs: 30000
    });

    // Initialize services and validators
    reportService = new ReportService(null, null, null);
    pdfValidator = new PDFValidator();
    storageValidator = new StorageValidator();

    // Setup temporary storage for PDFs
    tempPDFPath = `/tmp/test-reports-${Date.now()}`;
  });

  afterAll(async () => {
    await teardownTestServer();
  });

  beforeEach(async () => {
    // Reset test data and clear temporary files
    testReportId = mockReportDefinitions[0].id;
  });

  describe('PDF Generation Core Functionality', () => {
    test('should generate valid PDF report with correct structure and metadata', async () => {
      // Generate PDF report
      const result = await reportService.generateReport(
        mockReportDefinitions[0],
        'BENCHMARK_COMPARISON',
        'CONFIDENTIAL'
      );

      // Export to PDF
      const exportResult = await reportService.exportReport(
        result.id,
        ExportFormat.PDF,
        {
          format: ExportFormat.PDF,
          includeCharts: true,
          includeTables: true,
          orientation: PageOrientation.PORTRAIT,
          paperSize: 'A4',
          compression: true
        }
      );

      // Validate PDF structure
      const pdfValidation = await pdfValidator.validatePDF(exportResult.url);
      expect(pdfValidation.isValid).toBe(true);
      expect(pdfValidation.version).toMatch(/^[1-2]\.[0-7]$/);
      expect(pdfValidation.pageCount).toBeGreaterThan(0);
      expect(pdfValidation.hasEmbeddedFonts).toBe(true);
      expect(pdfValidation.isLinearized).toBe(true);
      expect(pdfValidation.isTagged).toBe(true);
    });

    test('should render complex content with charts and tables correctly', async () => {
      // Generate report with benchmark data
      const reportDef = {
        ...mockReportDefinitions[0],
        benchmarkData: mockBenchmarkReportData
      };

      const result = await reportService.generateReport(
        reportDef,
        'BENCHMARK_COMPARISON',
        'CONFIDENTIAL'
      );

      // Export with charts and tables
      const exportResult = await reportService.exportReport(
        result.id,
        ExportFormat.PDF,
        {
          format: ExportFormat.PDF,
          includeCharts: true,
          includeTables: true,
          orientation: PageOrientation.LANDSCAPE,
          paperSize: 'A4',
          compression: true
        }
      );

      // Validate content rendering
      const contentValidation = await pdfValidator.validateContent(exportResult.url);
      expect(contentValidation.hasCharts).toBe(true);
      expect(contentValidation.hasTables).toBe(true);
      expect(contentValidation.textQuality).toBe('high');
      expect(contentValidation.imageQuality).toBeGreaterThanOrEqual(300); // DPI
      expect(contentValidation.fontEmbedding).toBe('complete');
    });

    test('should handle PDF storage and retrieval with security measures', async () => {
      const result = await reportService.generateReport(
        mockReportDefinitions[0],
        'BENCHMARK_COMPARISON',
        'CONFIDENTIAL'
      );

      // Export with encryption
      const exportResult = await reportService.exportReport(
        result.id,
        ExportFormat.PDF,
        {
          format: ExportFormat.PDF,
          includeCharts: true,
          includeTables: true,
          orientation: PageOrientation.PORTRAIT,
          paperSize: 'A4',
          compression: true,
          password: 'test-password-123'
        }
      );

      // Validate storage security
      const storageValidation = await storageValidator.validateStorage(exportResult.url);
      expect(storageValidation.isEncrypted).toBe(true);
      expect(storageValidation.hasSecurePermissions).toBe(true);
      expect(storageValidation.isAccessControlled).toBe(true);
      expect(storageValidation.encryptionAlgorithm).toBe('AES-256');
    });

    test('should handle PDF generation failures gracefully', async () => {
      // Test with invalid data
      await expect(
        reportService.generateReport(
          { ...mockReportDefinitions[0], id: undefined },
          'BENCHMARK_COMPARISON',
          'CONFIDENTIAL'
        )
      ).rejects.toThrow('Invalid report data');

      // Test with memory limit exceeded
      const largeReport = {
        ...mockReportDefinitions[0],
        benchmarkData: Array(1000).fill(mockBenchmarkReportData[0])
      };

      await expect(
        reportService.generateReport(
          largeReport,
          'BENCHMARK_COMPARISON',
          'CONFIDENTIAL'
        )
      ).rejects.toThrow('Memory limit exceeded');

      // Test with storage failure
      const storageFailureReport = await reportService.generateReport(
        mockReportDefinitions[0],
        'BENCHMARK_COMPARISON',
        'CONFIDENTIAL'
      );

      storageValidator.simulateFailure = true;
      await expect(
        reportService.exportReport(
          storageFailureReport.id,
          ExportFormat.PDF,
          {
            format: ExportFormat.PDF,
            includeCharts: true,
            includeTables: true
          }
        )
      ).rejects.toThrow('Storage operation failed');
    });

    test('should optimize PDF generation performance', async () => {
      const startTime = Date.now();

      // Generate multiple reports concurrently
      const reports = await Promise.all(
        Array(5).fill(null).map(() =>
          reportService.generateReport(
            mockReportDefinitions[0],
            'BENCHMARK_COMPARISON',
            'CONFIDENTIAL'
          )
        )
      );

      // Export all reports
      const exports = await Promise.all(
        reports.map(report =>
          reportService.exportReport(
            report.id,
            ExportFormat.PDF,
            {
              format: ExportFormat.PDF,
              includeCharts: true,
              includeTables: true,
              compression: true
            }
          )
        )
      );

      const duration = Date.now() - startTime;

      // Validate performance metrics
      expect(duration).toBeLessThan(30000); // 30 seconds max
      exports.forEach(exportResult => {
        expect(exportResult.metadata.size).toBeLessThan(5 * 1024 * 1024); // 5MB max
      });
    });
  });
});