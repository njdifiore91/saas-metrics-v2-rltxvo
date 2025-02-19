import { test, expect } from '@playwright/test';
import { testServer } from '../../utils/test-server';
import { mockReportData } from '../../mocks/report-data.mock';
import { ExportFormat, PageOrientation } from '../../../backend/src/shared/interfaces/report.interface';
import { HTTP_STATUS_CODES } from '../../../backend/src/shared/constants/error-codes';

test.describe('Report Export E2E Tests', () => {
  let downloadPath: string;

  test.beforeEach(async () => {
    // Configure test environment
    downloadPath = await testServer.configureDownloads();
    await testServer.start();

    // Set up authentication and mock data
    await test.step('Setup test environment', async () => {
      await testServer.setAuthToken('admin-test-token');
      await testServer.setMockData(mockReportData);
    });
  });

  test.afterEach(async () => {
    await testServer.stop();
    await testServer.cleanupDownloads(downloadPath);
  });

  test('should export report as PDF with correct formatting', async ({ page }) => {
    const reportId = mockReportData.benchmarkReport.id;

    await test.step('Navigate to report page', async () => {
      await page.goto(`/reports/${reportId}`);
      await expect(page.locator('[data-testid="report-title"]')).toBeVisible();
    });

    await test.step('Initiate PDF export', async () => {
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="export-button"]');
      await page.click('[data-testid="export-pdf"]');
      const download = await downloadPromise;

      // Verify download started
      expect(download.suggestedFilename()).toMatch(/^report-.*\.pdf$/);

      // Save and verify file
      const filePath = await download.path();
      expect(filePath).toBeTruthy();

      // Verify PDF content and structure
      const pdfContent = await testServer.readPdfContent(filePath);
      expect(pdfContent).toContain(mockReportData.benchmarkReport.name);
      expect(pdfContent).toContain('Benchmark Comparison');
    });
  });

  test('should export report as Excel with all data points', async ({ page }) => {
    const reportId = mockReportData.comparisonReport.id;

    await test.step('Navigate to report page', async () => {
      await page.goto(`/reports/${reportId}`);
      await expect(page.locator('[data-testid="report-title"]')).toBeVisible();
    });

    await test.step('Initiate Excel export', async () => {
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="export-button"]');
      await page.click('[data-testid="export-excel"]');
      const download = await downloadPromise;

      // Verify download started
      expect(download.suggestedFilename()).toMatch(/^report-.*\.xlsx$/);

      // Save and verify file
      const filePath = await download.path();
      expect(filePath).toBeTruthy();

      // Verify Excel content and structure
      const excelContent = await testServer.readExcelContent(filePath);
      expect(excelContent.sheets).toHaveLength(mockReportData.comparisonReport.sections.length);
      expect(excelContent.metrics).toBeDefined();
      expect(excelContent.benchmarks).toBeDefined();
    });
  });

  test('should handle export errors gracefully', async ({ page }) => {
    const invalidReportId = 'invalid-id';

    await test.step('Navigate to invalid report', async () => {
      await page.goto(`/reports/${invalidReportId}`);
    });

    await test.step('Attempt export of invalid report', async () => {
      await page.click('[data-testid="export-button"]');
      await page.click('[data-testid="export-pdf"]');

      // Verify error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Report not found');
    });
  });

  test('should enforce export permissions', async ({ page }) => {
    // Set up unauthorized user
    await testServer.setAuthToken('guest-test-token');
    const reportId = mockReportData.benchmarkReport.id;

    await test.step('Navigate to report as unauthorized user', async () => {
      await page.goto(`/reports/${reportId}`);
    });

    await test.step('Verify export button is disabled', async () => {
      await expect(page.locator('[data-testid="export-button"]')).toBeDisabled();
      await expect(page.locator('[data-testid="permission-message"]')).toContainText('Export permission required');
    });
  });

  test('should handle concurrent export requests', async ({ page }) => {
    const reportId = mockReportData.benchmarkReport.id;

    await test.step('Navigate to report page', async () => {
      await page.goto(`/reports/${reportId}`);
    });

    await test.step('Initiate multiple concurrent exports', async () => {
      const exportPromises = [];
      const formats = [
        { button: '[data-testid="export-pdf"]', format: 'pdf' },
        { button: '[data-testid="export-excel"]', format: 'xlsx' }
      ];

      for (const format of formats) {
        await page.click('[data-testid="export-button"]');
        const downloadPromise = page.waitForEvent('download');
        await page.click(format.button);
        exportPromises.push(downloadPromise);
      }

      // Wait for all downloads to complete
      const downloads = await Promise.all(exportPromises);
      expect(downloads).toHaveLength(formats.length);

      // Verify each download
      for (let i = 0; i < downloads.length; i++) {
        expect(downloads[i].suggestedFilename()).toMatch(new RegExp(`^report-.*\\.${formats[i].format}$`));
      }
    });
  });

  test('should validate export options', async ({ page }) => {
    const reportId = mockReportData.benchmarkReport.id;

    await test.step('Navigate to report page', async () => {
      await page.goto(`/reports/${reportId}`);
    });

    await test.step('Test export options validation', async () => {
      await page.click('[data-testid="export-button"]');
      await page.click('[data-testid="export-options"]');

      // Test invalid page orientation
      await page.selectOption('[data-testid="orientation-select"]', 'INVALID');
      await expect(page.locator('[data-testid="orientation-error"]')).toBeVisible();

      // Test invalid paper size
      await page.selectOption('[data-testid="paper-size-select"]', 'INVALID');
      await expect(page.locator('[data-testid="paper-size-error"]')).toBeVisible();

      // Test valid options
      await page.selectOption('[data-testid="orientation-select"]', PageOrientation.LANDSCAPE);
      await page.selectOption('[data-testid="paper-size-select"]', 'A4');
      await expect(page.locator('[data-testid="export-submit"]')).toBeEnabled();
    });
  });
});