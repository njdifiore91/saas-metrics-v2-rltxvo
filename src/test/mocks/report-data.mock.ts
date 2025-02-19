import { v4 as uuidv4 } from 'uuid'; // v8.3.2
import { 
  IReportDefinition, 
  IReportTemplate,
  ReportType,
  SectionType,
  ExportFormat,
  PageOrientation
} from '../../backend/src/shared/interfaces/report.interface';
import { IBenchmarkData } from '../../backend/src/shared/interfaces/benchmark.interface';
import { MetricType, MetricUnit } from '../../backend/src/shared/interfaces/metric-types';

/**
 * Generates a unique mock report ID with test prefix
 */
const generateMockReportId = (): string => `test_${uuidv4()}`;

/**
 * Creates mathematically consistent mock benchmark data
 * Ensures p10 < p25 < p50 < p75 < p90 for statistical validity
 */
const createMockBenchmarkData = (metricId: string, revenueRange: string): IBenchmarkData => {
  const p10Value = Math.round(Math.random() * 30);
  const p25Value = p10Value + Math.round(Math.random() * 20);
  const p50Value = p25Value + Math.round(Math.random() * 20);
  const p75Value = p50Value + Math.round(Math.random() * 20);
  const p90Value = p75Value + Math.round(Math.random() * 20);

  return {
    id: generateMockReportId(),
    benchmarkId: metricId,
    p10Value,
    p25Value,
    p50Value,
    p75Value,
    p90Value,
    sampleSize: 100 + Math.round(Math.random() * 900),
    confidenceLevel: 0.95
  };
};

/**
 * Mock report definitions covering all report types and edge cases
 */
export const mockReportDefinitions: IReportDefinition[] = [
  {
    id: generateMockReportId(),
    name: 'Benchmark Comparison Report',
    description: 'Comprehensive benchmark analysis across key metrics',
    templateId: generateMockReportId(),
    createdBy: 'test-user-1',
    createdAt: new Date('2023-01-01'),
    lastModifiedAt: new Date('2023-01-02'),
    lastModifiedBy: 'test-user-1',
    version: 1
  },
  {
    id: generateMockReportId(),
    name: 'Metric Analysis Report',
    description: 'Detailed analysis of individual metric performance',
    templateId: generateMockReportId(),
    createdBy: 'test-user-2',
    createdAt: new Date('2023-02-01'),
    lastModifiedAt: new Date('2023-02-02'),
    lastModifiedBy: 'test-user-2',
    version: 1
  },
  {
    id: generateMockReportId(),
    name: 'Performance Summary',
    description: 'Executive summary of key performance indicators',
    templateId: generateMockReportId(),
    createdBy: 'test-user-1',
    createdAt: new Date('2023-03-01'),
    lastModifiedAt: new Date('2023-03-02'),
    lastModifiedBy: 'test-user-1',
    version: 2
  }
];

/**
 * Mock report templates with various section combinations
 */
export const mockReportTemplates: IReportTemplate[] = [
  {
    id: generateMockReportId(),
    name: 'Standard Benchmark Template',
    type: ReportType.BENCHMARK_COMPARISON,
    layout: {
      columns: 2,
      margins: { top: 20, right: 20, bottom: 20, left: 20 },
      header: { height: 60, showLogo: true, showDate: true },
      footer: { height: 40, showPageNumbers: true }
    },
    sections: [
      {
        id: generateMockReportId(),
        title: 'Executive Summary',
        type: SectionType.TEXT,
        content: { text: 'Mock executive summary content' },
        order: 1,
        visibility: ['USER', 'ADMIN'],
        style: { fontFamily: 'Inter', fontSize: 14 }
      },
      {
        id: generateMockReportId(),
        title: 'Benchmark Comparison',
        type: SectionType.BENCHMARK_COMPARISON,
        content: {
          metrics: [],
          benchmarks: []
        },
        order: 2,
        visibility: ['USER', 'ADMIN'],
        style: { fontFamily: 'Inter', fontSize: 12 }
      }
    ],
    isDefault: true,
    version: 1
  }
];

/**
 * Mock benchmark data with realistic percentile distributions
 */
export const mockBenchmarkReportData: IBenchmarkData[] = [
  // Net Dollar Retention benchmark data
  createMockBenchmarkData('NDR_METRIC', '$1M-$5M'),
  createMockBenchmarkData('NDR_METRIC', '$5M-$10M'),
  
  // CAC Payback Period benchmark data
  createMockBenchmarkData('CAC_PAYBACK_METRIC', '$1M-$5M'),
  createMockBenchmarkData('CAC_PAYBACK_METRIC', '$5M-$10M'),
  
  // Gross Margin benchmark data
  createMockBenchmarkData('GROSS_MARGIN_METRIC', '$1M-$5M'),
  createMockBenchmarkData('GROSS_MARGIN_METRIC', '$5M-$10M')
];

/**
 * Mock export options for testing different export formats
 */
export const mockExportOptions = {
  pdf: {
    format: ExportFormat.PDF,
    includeCharts: true,
    includeTables: true,
    orientation: PageOrientation.LANDSCAPE,
    paperSize: 'A4',
    compression: true
  },
  csv: {
    format: ExportFormat.CSV,
    includeCharts: false,
    includeTables: true,
    compression: false
  },
  excel: {
    format: ExportFormat.EXCEL,
    includeCharts: true,
    includeTables: true,
    compression: true
  }
};