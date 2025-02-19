import { setupTestServer, teardownTestServer, getTestAgent } from '../../utils/test-server';
import { ExportFormat, PageOrientation } from '../../../backend/src/shared/interfaces/report.interface';
import { HTTP_STATUS_CODES, DATA_ERRORS } from '../../../backend/src/shared/constants/error-codes';
import { generateTestDataSet } from '../../utils/test-data-generator';

describe('Report Generation E2E Tests', () => {
  let testAgent: any;
  let testData: any;

  beforeAll(async () => {
    // Initialize test environment with isolated database
    await setupTestServer();
    testAgent = getTestAgent();

    // Generate test data
    testData = generateTestDataSet({
      userCount: 5,
      metricsPerUser: 3,
      includeHistorical: true
    });
  });

  afterAll(async () => {
    await teardownTestServer();
  });

  describe('Benchmark Report Generation', () => {
    it('should generate a benchmark report with statistical validation', async () => {
      const reportData = {
        name: 'Benchmark Analysis Report',
        templateId: 'benchmark-template-1',
        metrics: testData.metrics.map(m => m.id),
        revenueRangeId: 'revenue-range-1',
        timeframe: 'QUARTERLY',
        includeCharts: true,
        includeTables: true
      };

      const response = await testAgent
        .post('/api/v1/reports')
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN}`)
        .send(reportData)
        .expect(HTTP_STATUS_CODES.CREATED);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: expect.any(String),
          name: reportData.name,
          templateId: reportData.templateId,
          createdAt: expect.any(String),
          status: 'COMPLETED'
        }
      });

      // Verify report content
      expect(response.body.data.sections).toHaveLength(testData.metrics.length);
      expect(response.body.data.metadata).toMatchObject({
        generatedAt: expect.any(String),
        dataTimestamp: expect.any(String),
        metricsCount: testData.metrics.length
      });
    });

    it('should handle invalid metric IDs with proper error response', async () => {
      const reportData = {
        name: 'Invalid Metrics Report',
        templateId: 'benchmark-template-1',
        metrics: ['invalid-metric-id'],
        revenueRangeId: 'revenue-range-1'
      };

      const response = await testAgent
        .post('/api/v1/reports')
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN}`)
        .send(reportData)
        .expect(HTTP_STATUS_CODES.BAD_REQUEST);

      expect(response.body).toMatchObject({
        type: 'https://api.startup-metrics.com/errors/validation',
        status: HTTP_STATUS_CODES.BAD_REQUEST,
        code: DATA_ERRORS.DATA003,
        message: 'Invalid metric IDs provided'
      });
    });
  });

  describe('Report Export Functionality', () => {
    let reportId: string;

    beforeAll(async () => {
      // Create a report for export tests
      const response = await testAgent
        .post('/api/v1/reports')
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN}`)
        .send({
          name: 'Export Test Report',
          templateId: 'benchmark-template-1',
          metrics: testData.metrics.map(m => m.id),
          revenueRangeId: 'revenue-range-1'
        });

      reportId = response.body.data.id;
    });

    it('should export report as PDF with proper formatting', async () => {
      const exportOptions = {
        format: ExportFormat.PDF,
        orientation: PageOrientation.LANDSCAPE,
        includeCharts: true,
        includeTables: true,
        paperSize: 'A4',
        compression: true
      };

      const response = await testAgent
        .post(`/api/v1/reports/${reportId}/export`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN}`)
        .send(exportOptions)
        .expect(HTTP_STATUS_CODES.OK);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          url: expect.any(String),
          metadata: {
            format: ExportFormat.PDF,
            size: expect.any(Number),
            generatedAt: expect.any(String),
            expiresAt: expect.any(String)
          }
        }
      });

      // Verify URL is accessible and content is correct
      const fileResponse = await testAgent
        .get(response.body.data.url)
        .expect(HTTP_STATUS_CODES.OK)
        .expect('Content-Type', 'application/pdf');

      expect(fileResponse.headers['content-length']).toBeGreaterThan(0);
    });

    it('should export report as Excel with data integrity', async () => {
      const exportOptions = {
        format: ExportFormat.EXCEL,
        includeCharts: true,
        includeTables: true,
        compression: true
      };

      const response = await testAgent
        .post(`/api/v1/reports/${reportId}/export`)
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN}`)
        .send(exportOptions)
        .expect(HTTP_STATUS_CODES.OK);

      expect(response.body.data.metadata.format).toBe(ExportFormat.EXCEL);
      expect(response.body.data.url).toMatch(/\.xlsx$/);
    });
  });

  describe('Report Security Controls', () => {
    it('should enforce authentication for report generation', async () => {
      const response = await testAgent
        .post('/api/v1/reports')
        .send({
          name: 'Unauthorized Report',
          templateId: 'benchmark-template-1',
          metrics: []
        })
        .expect(HTTP_STATUS_CODES.UNAUTHORIZED);

      expect(response.body.code).toBe('AUTH001');
    });

    it('should validate CSRF token for report generation', async () => {
      const response = await testAgent
        .post('/api/v1/reports')
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN}`)
        .set('X-CSRF-Token', 'invalid-token')
        .send({
          name: 'CSRF Test Report',
          templateId: 'benchmark-template-1',
          metrics: []
        })
        .expect(HTTP_STATUS_CODES.FORBIDDEN);

      expect(response.body.code).toBe('AUTH003');
    });

    it('should enforce rate limiting for report generation', async () => {
      const requests = Array(101).fill(null).map(() => 
        testAgent
          .post('/api/v1/reports')
          .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN}`)
          .send({
            name: 'Rate Limit Test',
            templateId: 'benchmark-template-1',
            metrics: []
          })
      );

      const responses = await Promise.all(requests);
      const rateLimitedResponse = responses[responses.length - 1];

      expect(rateLimitedResponse.status).toBe(HTTP_STATUS_CODES.RATE_LIMIT);
      expect(rateLimitedResponse.body.code).toBe('SYS001');
    });
  });

  describe('Report Performance Validation', () => {
    it('should generate report within performance SLA', async () => {
      const startTime = Date.now();

      await testAgent
        .post('/api/v1/reports')
        .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN}`)
        .send({
          name: 'Performance Test Report',
          templateId: 'benchmark-template-1',
          metrics: testData.metrics.slice(0, 3).map(m => m.id),
          revenueRangeId: 'revenue-range-1'
        })
        .expect(HTTP_STATUS_CODES.CREATED);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000); // 2 second SLA
    });

    it('should handle concurrent report generation requests', async () => {
      const concurrentRequests = 5;
      const requests = Array(concurrentRequests).fill(null).map((_, index) => 
        testAgent
          .post('/api/v1/reports')
          .set('Authorization', `Bearer ${process.env.TEST_AUTH_TOKEN}`)
          .send({
            name: `Concurrent Report ${index}`,
            templateId: 'benchmark-template-1',
            metrics: testData.metrics.slice(0, 2).map(m => m.id),
            revenueRangeId: 'revenue-range-1'
          })
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(HTTP_STATUS_CODES.CREATED);
        expect(response.body.success).toBe(true);
      });
    });
  });
});