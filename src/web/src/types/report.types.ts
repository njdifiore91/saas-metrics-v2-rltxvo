import { MetricType } from './metric.types';
import { ChartType } from './chart.types';

/**
 * Enum defining available report types for the platform
 */
export enum ReportType {
  BENCHMARK_COMPARISON = 'BENCHMARK_COMPARISON',  // Compare metrics against industry benchmarks
  METRIC_ANALYSIS = 'METRIC_ANALYSIS',           // Detailed analysis of specific metrics
  PERFORMANCE_SUMMARY = 'PERFORMANCE_SUMMARY',    // Overall performance dashboard
  CUSTOM = 'CUSTOM'                              // User-defined custom report
}

/**
 * Enum defining supported export formats for reports
 */
export enum ReportFormat {
  PDF = 'PDF',       // Adobe PDF format
  CSV = 'CSV',       // Comma-separated values
  EXCEL = 'EXCEL'    // Microsoft Excel format
}

/**
 * Enum defining page orientation options for report exports
 */
export enum PageOrientation {
  PORTRAIT = 'PORTRAIT',    // Vertical orientation
  LANDSCAPE = 'LANDSCAPE'   // Horizontal orientation
}

/**
 * Type definition for report time range with date validation
 */
export type ReportTimeRange = {
  startDate: Date;    // Start date for report data
  endDate: Date;      // End date for report data
}

/**
 * Type definition for comprehensive report configuration
 */
export type ReportConfig = {
  type: ReportType;                // Type of report to generate
  format: ReportFormat;            // Export format
  timeRange: ReportTimeRange;      // Date range for report data
  selectedMetrics: string[];       // Array of metric IDs to include
  metricTypes: MetricType[];       // Types of metrics to include
  includeCharts: boolean;          // Whether to include visualizations
  chartTypes: ChartType[];         // Types of charts to include
  orientation: PageOrientation;     // Page orientation for export
}

/**
 * Type definition for complete report data structure
 */
export type Report = {
  id: string;                      // Unique identifier for the report
  name: string;                    // User-defined report name
  description: string;             // Report description
  type: ReportType;               // Type of report
  format: ReportFormat;           // Export format
  createdAt: Date;                // Report creation timestamp
  createdBy: string;              // User ID of report creator
  config: ReportConfig;           // Complete report configuration
}

/**
 * Type guard to check if a report is a benchmark comparison
 */
export function isBenchmarkReport(report: Report): boolean {
  return report.type === ReportType.BENCHMARK_COMPARISON;
}

/**
 * Type guard to check if a report includes charts
 */
export function hasCharts(config: ReportConfig): boolean {
  return config.includeCharts && config.chartTypes.length > 0;
}

/**
 * Type for report generation validation errors
 */
export type ReportValidationError = {
  field: keyof ReportConfig;      // Field that failed validation
  message: string;                // Error message
  code: string;                   // Error code for client handling
}

/**
 * Type for report generation progress status
 */
export type ReportGenerationStatus = {
  progress: number;               // Progress percentage (0-100)
  stage: string;                  // Current generation stage
  errors: ReportValidationError[]; // Any validation errors
  startedAt: Date;               // Generation start timestamp
  completedAt?: Date;            // Generation completion timestamp
}