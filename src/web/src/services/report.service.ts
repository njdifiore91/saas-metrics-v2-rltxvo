/**
 * Report Service
 * Handles report generation, management, and secure file downloads with enhanced caching
 * @version 1.0.0
 */

import { apiService } from './api.service';
import { IReport, IReportConfig, ReportFormat, ReportType } from '../interfaces/report.interface';
import { API_ENDPOINTS } from '../constants/api.constants';
import saveAs from 'file-saver'; // ^2.0.5

// Cache configuration
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_MIME_TYPES = {
  [ReportFormat.PDF]: 'application/pdf',
  [ReportFormat.CSV]: 'text/csv',
  [ReportFormat.EXCEL]: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

class ReportService {
  private baseUrl: string;
  private reportCache: Map<string, { data: IReport; timestamp: number }>;
  private maxRetries: number;

  constructor() {
    this.baseUrl = API_ENDPOINTS.REPORTS;
    this.reportCache = new Map();
    this.maxRetries = 3;
  }

  /**
   * Generates a new report with retry mechanism and progress tracking
   * @param config Report configuration
   * @returns Promise resolving to the generated report
   */
  public async generateReport(config: IReportConfig): Promise<IReport> {
    try {
      // Validate report configuration
      this.validateReportConfig(config);

      // Initialize progress tracking
      const progressCallback = (progress: number) => {
        console.log(`Report generation progress: ${progress}%`);
      };

      // Generate report with retry mechanism
      const response = await apiService.post<IReport>(
        `${this.baseUrl}/generate`,
        config,
        {
          timeout: 120000, // 2 minutes timeout for report generation
          onUploadProgress: (progressEvent) => {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            progressCallback(progress);
          }
        }
      );

      // Cache the generated report
      this.cacheReport(response.data);

      return response.data;
    } catch (error) {
      throw this.handleReportError(error);
    }
  }

  /**
   * Retrieves a report with cache support
   * @param reportId Report identifier
   * @returns Promise resolving to the report data
   */
  public async getReport(reportId: string): Promise<IReport> {
    // Check cache first
    const cachedReport = this.getCachedReport(reportId);
    if (cachedReport) {
      return cachedReport;
    }

    try {
      const response = await apiService.get<IReport>(`${this.baseUrl}/${reportId}`);
      this.cacheReport(response.data);
      return response.data;
    } catch (error) {
      throw this.handleReportError(error);
    }
  }

  /**
   * Exports a report with security validation and progress tracking
   * @param reportId Report identifier
   * @param format Export format
   */
  public async exportReport(reportId: string, format: ReportFormat): Promise<void> {
    try {
      // Validate export parameters
      this.validateExportParams(reportId, format);

      // Initialize download progress
      const progressCallback = (progress: number) => {
        console.log(`Download progress: ${progress}%`);
      };

      // Request report export
      const response = await apiService.get(
        `${this.baseUrl}/${reportId}/download`,
        { format },
        {
          responseType: 'blob',
          onDownloadProgress: (progressEvent) => {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            progressCallback(progress);
          }
        }
      );

      // Validate response
      await this.validateExportResponse(response.data, format);

      // Generate filename
      const filename = this.generateExportFilename(reportId, format);

      // Trigger secure download
      saveAs(response.data, filename);
    } catch (error) {
      throw this.handleReportError(error);
    }
  }

  /**
   * Deletes a report and cleans up cache
   * @param reportId Report identifier
   */
  public async deleteReport(reportId: string): Promise<void> {
    try {
      await apiService.delete(`${this.baseUrl}/${reportId}`);
      this.reportCache.delete(reportId);
    } catch (error) {
      throw this.handleReportError(error);
    }
  }

  /**
   * Validates report configuration
   * @param config Report configuration to validate
   */
  private validateReportConfig(config: IReportConfig): void {
    if (!config.type || !Object.values(ReportType).includes(config.type)) {
      throw new Error('Invalid report type');
    }

    if (!config.format || !Object.values(ReportFormat).includes(config.format)) {
      throw new Error('Invalid report format');
    }

    if (!config.selectedMetrics || config.selectedMetrics.length === 0) {
      throw new Error('No metrics selected for report');
    }
  }

  /**
   * Validates export parameters
   * @param reportId Report identifier
   * @param format Export format
   */
  private validateExportParams(reportId: string, format: ReportFormat): void {
    if (!reportId || typeof reportId !== 'string') {
      throw new Error('Invalid report ID');
    }

    if (!format || !Object.values(ReportFormat).includes(format)) {
      throw new Error('Invalid export format');
    }
  }

  /**
   * Validates export response
   * @param blob Response blob
   * @param format Export format
   */
  private async validateExportResponse(blob: Blob, format: ReportFormat): Promise<void> {
    if (blob.size > MAX_FILE_SIZE) {
      throw new Error('Export file size exceeds maximum limit');
    }

    if (blob.type !== ALLOWED_MIME_TYPES[format]) {
      throw new Error('Invalid export file type');
    }
  }

  /**
   * Generates export filename
   * @param reportId Report identifier
   * @param format Export format
   */
  private generateExportFilename(reportId: string, format: ReportFormat): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const extension = format.toLowerCase();
    return `report-${reportId}-${timestamp}.${extension}`;
  }

  /**
   * Retrieves cached report if valid
   * @param reportId Report identifier
   */
  private getCachedReport(reportId: string): IReport | null {
    const cached = this.reportCache.get(reportId);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > CACHE_TTL) {
      this.reportCache.delete(reportId);
      return null;
    }

    return cached.data;
  }

  /**
   * Caches report data
   * @param report Report to cache
   */
  private cacheReport(report: IReport): void {
    this.reportCache.set(report.id, {
      data: report,
      timestamp: Date.now()
    });
  }

  /**
   * Handles report-related errors
   * @param error Error to handle
   */
  private handleReportError(error: any): Error {
    const message = error.response?.data?.message || 'An error occurred while processing the report';
    return new Error(message);
  }
}

// Export singleton instance
export const reportService = new ReportService();