import { MetricType } from '../types/metric.types';
import { ChartType } from '../types/chart.types';

/**
 * Interface defining the core report data structure
 */
export interface IReport {
  id: string;                  // Unique identifier for the report
  name: string;               // Report name/title
  description: string;        // Report description
  type: ReportType;          // Type of report
  format: ReportFormat;      // Export format
  createdAt: Date;           // Creation timestamp
  createdBy: string;         // User ID of creator
  config: IReportConfig;     // Report configuration
  version: string;           // Report schema version
}

/**
 * Interface defining report generation configuration
 */
export interface IReportConfig {
  type: ReportType;                  // Report type
  format: ReportFormat;             // Export format
  timeRange: IReportTimeRange;      // Time range for data
  selectedMetrics: string[];        // Array of metric IDs to include
  metricTypes: MetricType[];        // Types of metrics to include
  includeCharts: boolean;           // Whether to include visualizations
  chartTypes: ChartType[];          // Types of charts to include
  orientation: PageOrientation;      // Page orientation for export
  maxFileSize: number;              // Maximum file size in bytes
  securityOptions: IReportSecurity; // Security configuration
}

/**
 * Interface defining report security settings
 */
export interface IReportSecurity {
  enableEncryption: boolean;    // Whether to encrypt the report
  sanitizeContent: boolean;     // Whether to sanitize content
  allowedDomains: string[];     // Domains allowed to access report
}

/**
 * Interface defining report time range
 */
export interface IReportTimeRange {
  startDate: Date;             // Start date for report data
  endDate: Date;              // End date for report data
}

/**
 * Enum defining available report types
 */
export enum ReportType {
  BENCHMARK_COMPARISON = 'BENCHMARK_COMPARISON',
  METRIC_ANALYSIS = 'METRIC_ANALYSIS',
  PERFORMANCE_SUMMARY = 'PERFORMANCE_SUMMARY',
  CUSTOM = 'CUSTOM'
}

/**
 * Enum defining supported export formats
 */
export enum ReportFormat {
  PDF = 'PDF',
  CSV = 'CSV',
  EXCEL = 'EXCEL'
}

/**
 * Enum defining page orientation options
 */
export enum PageOrientation {
  PORTRAIT = 'PORTRAIT',
  LANDSCAPE = 'LANDSCAPE'
}