/**
 * Report interfaces for the Startup Metrics Benchmarking Platform
 * Defines core interfaces for report generation, templates, and export functionality
 * @version 1.0.0
 */

import { IMetricDefinition } from './metric.interface';
import { IBenchmarkData } from './benchmark.interface';

/**
 * Available report types in the platform
 */
export enum ReportType {
  BENCHMARK_COMPARISON = 'BENCHMARK_COMPARISON',
  METRIC_ANALYSIS = 'METRIC_ANALYSIS',
  PERFORMANCE_SUMMARY = 'PERFORMANCE_SUMMARY',
  CUSTOM = 'CUSTOM',
  TREND_ANALYSIS = 'TREND_ANALYSIS',
  COHORT_COMPARISON = 'COHORT_COMPARISON'
}

/**
 * Types of sections that can be included in a report
 */
export enum SectionType {
  CHART = 'CHART',
  TABLE = 'TABLE',
  TEXT = 'TEXT',
  METRIC_CARD = 'METRIC_CARD',
  BENCHMARK_COMPARISON = 'BENCHMARK_COMPARISON',
  TREND_VISUALIZATION = 'TREND_VISUALIZATION'
}

/**
 * Supported export formats for reports
 */
export enum ExportFormat {
  PDF = 'PDF',
  CSV = 'CSV',
  EXCEL = 'EXCEL',
  PNG = 'PNG',
  SVG = 'SVG',
  HTML = 'HTML'
}

/**
 * Page orientation options for exported reports
 */
export enum PageOrientation {
  PORTRAIT = 'PORTRAIT',
  LANDSCAPE = 'LANDSCAPE'
}

/**
 * Interface for report layout configuration
 */
export interface IReportLayout {
  /** Number of columns in the layout grid */
  columns: number;
  /** Margin settings in pixels */
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  /** Header configuration */
  header?: {
    height: number;
    showLogo: boolean;
    showDate: boolean;
  };
  /** Footer configuration */
  footer?: {
    height: number;
    showPageNumbers: boolean;
    customText?: string;
  };
}

/**
 * Interface for report styling options
 */
export interface IReportStyle {
  /** Font family for text elements */
  fontFamily?: string;
  /** Base font size in pixels */
  fontSize?: number;
  /** Text color in hex format */
  textColor?: string;
  /** Background color in hex format */
  backgroundColor?: string;
  /** Custom CSS classes to apply */
  customClasses?: string[];
}

/**
 * Interface for report content data
 */
export interface IReportContent {
  /** Metric definitions included in the report */
  metrics?: IMetricDefinition[];
  /** Benchmark data for comparisons */
  benchmarks?: IBenchmarkData[];
  /** Custom text content */
  text?: string;
  /** Chart configuration */
  chartConfig?: {
    type: string;
    data: any;
    options: any;
  };
  /** Table configuration */
  tableConfig?: {
    headers: string[];
    rows: any[];
    sortable: boolean;
  };
}

/**
 * Interface for report section definition
 */
export interface IReportSection {
  /** Unique identifier for the section */
  id: string;
  /** Section title */
  title: string;
  /** Type of section content */
  type: SectionType;
  /** Section content configuration */
  content: IReportContent;
  /** Display order in the report */
  order: number;
  /** Role-based visibility settings */
  visibility: string[];
  /** Section-specific styling */
  style: IReportStyle;
}

/**
 * Interface for report template definition
 */
export interface IReportTemplate {
  /** Unique identifier for the template */
  id: string;
  /** Template name */
  name: string;
  /** Type of report */
  type: ReportType;
  /** Layout configuration */
  layout: IReportLayout;
  /** Report sections */
  sections: IReportSection[];
  /** Flag for default template */
  isDefault: boolean;
  /** Template version number */
  version: number;
}

/**
 * Interface for report definition
 */
export interface IReportDefinition {
  /** Unique identifier for the report */
  id: string;
  /** Report name */
  name: string;
  /** Report description */
  description: string;
  /** Reference to the template used */
  templateId: string;
  /** User who created the report */
  createdBy: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last modification timestamp */
  lastModifiedAt: Date;
  /** User who last modified the report */
  lastModifiedBy: string;
  /** Report version number */
  version: number;
}

/**
 * Interface for report export options
 */
export interface IReportExportOptions {
  /** Export file format */
  format: ExportFormat;
  /** Include charts in export */
  includeCharts: boolean;
  /** Include tables in export */
  includeTables: boolean;
  /** Page orientation for PDF exports */
  orientation: PageOrientation;
  /** Paper size for PDF exports */
  paperSize: string;
  /** Enable file compression */
  compression: boolean;
  /** Optional password protection */
  password?: string;
}