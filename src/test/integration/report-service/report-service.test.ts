import { describe, it, beforeAll, afterAll, beforeEach, afterEach, expect } from 'jest';
import { S3Client } from '@aws-sdk/client-s3';
import supertest from 'supertest';
import { faker } from '@faker-js/faker';

import { ReportService } from '../../../backend/src/report-service/src/services/report.service';
import { mockReportDefinitions } from '../../mocks/report-data.mock';
import { setupTestServer, teardownTestServer, getTestAgent } from '../../utils/test-server';
import { 
  ReportType, 
  ExportFormat, 
  PageOrientation,
  SectionType 
} from '../../../backend/src/shared/interfaces/report.interface';

describe('Report Service Integration Tests', () => {
  let reportService: ReportService;
  let mockS3Client: S3Client;

  beforeAll(async () => {
    // Initialize test environment
    await setupTestServer({
      enableSecurity: true,
      enableCompression: true,
      timeoutMs: 30000
    });

    // Configure mock S3 client
    mockS3Client = new S3Client({
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test'
      }
    });

    // Initialize report service with test configuration
    reportService = new ReportService(
      mockS3Client,
      'test-bucket',
      'test-encryption-key'
    );
  });

  afterAll(async () => {
    await teardownTestServer();
  });

  describe('Report Generation Tests', () => {
    beforeEach(async () => {
      // Clear any existing test reports
      await clearTestReports();
    });

    it('should generate benchmark comparison report with 99.9% accuracy', async () => {
      const reportDefinition = {
        ...mockReportDefinitions[0],
        id: faker.string.uuid(),
        type: ReportType.BENCHMARK_COMPARISON,
        sections: [
          {
            id: faker.string.uuid(),
            type: SectionType.BENCHMARK_COMPARISON,
            title: 'Benchmark Analysis',
            content: {
              metrics: ['NDR_METRIC', 'CAC_PAYBACK_METRIC'],
              benchmarks: []
            },
            order: 1,
            visibility: ['USER', 'ADMIN'],
            style: { fontFamily: 'Inter', fontSize: 12 }
          }
        ]
      };

      const startTime = Date.now();
      const report = await reportService.generateReport(
        reportDefinition,
        ReportType.BENCHMARK_COMPARISON,
        'CONFIDENTIAL'
      );

      // Verify response time
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000); // Under 2 seconds

      // Verify report structure
      expect(report).toHaveProperty('id');
      expect(report.type).toBe(ReportType.BENCHMARK_COMPARISON);
      expect(report.sections).toHaveLength(1);

      // Verify calculation accuracy
      const benchmarkSection = report.sections[0];
      expect(benchmarkSection.content.benchmarks).toBeDefined();
      expect(benchmarkSection.content.benchmarks[0].confidenceLevel).toBeGreaterThanOrEqual(0.999);
    });

    it('should handle concurrent report generation requests', async () => {
      const concurrentRequests = 5;
      const reportPromises = Array(concurrentRequests).fill(null).map(() => 
        reportService.generateReport(
          mockReportDefinitions[1],
          ReportType.METRIC_ANALYSIS,
          'INTERNAL'
        )
      );

      const reports = await Promise.all(reportPromises);
      
      // Verify all reports were generated successfully
      expect(reports).toHaveLength(concurrentRequests);
      reports.forEach(report => {
        expect(report).toHaveProperty('id');
        expect(report.createdAt).toBeDefined();
      });
    });
  });

  describe('Report Export Tests', () => {
    it('should export report in multiple formats with security validation', async () => {
      // Generate test report
      const report = await reportService.generateReport(
        mockReportDefinitions[0],
        ReportType.BENCHMARK_COMPARISON,
        'CONFIDENTIAL'
      );

      // Test PDF export
      const pdfExport = await reportService.exportReport(
        report.id,
        ExportFormat.PDF,
        {
          format: ExportFormat.PDF,
          includeCharts: true,
          includeTables: true,
          orientation: PageOrientation.LANDSCAPE,
          paperSize: 'A4',
          compression: true,
          password: 'test-password'
        }
      );

      expect(pdfExport.url).toMatch(/^https:\/\//);
      expect(pdfExport.metadata.format).toBe(ExportFormat.PDF);

      // Test Excel export
      const excelExport = await reportService.exportReport(
        report.id,
        ExportFormat.EXCEL,
        {
          format: ExportFormat.EXCEL,
          includeCharts: true,
          includeTables: true,
          compression: true
        }
      );

      expect(excelExport.url).toMatch(/^https:\/\//);
      expect(excelExport.metadata.format).toBe(ExportFormat.EXCEL);

      // Verify security headers
      const response = await getTestAgent()
        .get(pdfExport.url)
        .expect(200);

      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should handle large report exports within performance requirements', async () => {
      const largeReport = {
        ...mockReportDefinitions[2],
        sections: Array(20).fill(null).map(() => ({
          id: faker.string.uuid(),
          type: SectionType.BENCHMARK_COMPARISON,
          title: faker.lorem.sentence(),
          content: {
            metrics: ['NDR_METRIC', 'CAC_PAYBACK_METRIC', 'GROSS_MARGIN_METRIC'],
            benchmarks: []
          },
          order: 1,
          visibility: ['USER', 'ADMIN'],
          style: { fontFamily: 'Inter', fontSize: 12 }
        }))
      };

      const startTime = Date.now();
      const exportResult = await reportService.exportReport(
        largeReport.id,
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

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000); // Under 2 seconds
      expect(exportResult.metadata.size).toBeDefined();
    });
  });

  describe('Report Management Tests', () => {
    it('should manage report lifecycle with proper cleanup', async () => {
      // Create report
      const report = await reportService.generateReport(
        mockReportDefinitions[0],
        ReportType.BENCHMARK_COMPARISON,
        'CONFIDENTIAL'
      );

      // Update report
      const updatedReport = await reportService.updateReport(report.id, {
        name: 'Updated Report Name',
        description: 'Updated description'
      });
      expect(updatedReport.name).toBe('Updated Report Name');

      // Delete report
      await reportService.deleteReport(report.id);

      // Verify deletion
      await expect(reportService.getReport(report.id))
        .rejects
        .toThrow('Report not found');
    });
  });
});

// Helper function to clear test reports
async function clearTestReports(): Promise<void> {
  // Implementation would depend on your test database setup
  // This is just a placeholder
  console.log('Clearing test reports...');
}