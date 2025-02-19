/**
 * Comparison Report Template
 * Defines template structure and layout for generating benchmark comparison reports
 * with interactive visualizations and accessibility features
 * @version 1.0.0
 */

import { 
  IReportTemplate, 
  IReportSection, 
  SectionType, 
  ExportFormat,
  PageOrientation
} from '../../../shared/interfaces/report.interface';
import { IBenchmarkData } from '../../../shared/interfaces/benchmark.interface';
import { 
  IMetricDefinition, 
  IMetricValidationRule 
} from '../../../shared/interfaces/metric.interface';
import { MetricUnit } from '../../../shared/types/metric-types';

// Template version and configuration constants
const TEMPLATE_VERSION = '1.0.0';
const DEFAULT_CHART_HEIGHT = 400;
const DEFAULT_CHART_WIDTH = 800;
const CHART_ANIMATION_DURATION = 300;

// Accessibility configuration
const ACCESSIBILITY_CONFIG = {
  ariaLabels: true,
  keyboardNav: true,
  highContrast: true,
  screenReaderText: true
};

/**
 * Interface for report generation options
 */
interface IReportOptions {
  includeCharts: boolean;
  includeTables: boolean;
  orientation: PageOrientation;
  exportFormat: ExportFormat;
  accessibility: typeof ACCESSIBILITY_CONFIG;
}

/**
 * Interface for metric value formatting options
 */
interface IFormatOptions {
  locale: string;
  precision: number;
  showUnit: boolean;
  useGrouping: boolean;
}

/**
 * Interface for visualization options
 */
interface IVisualizationOptions {
  width: number;
  height: number;
  animationDuration: number;
  showTooltips: boolean;
  interactive: boolean;
}

/**
 * Formats metric values according to their unit and locale settings
 */
const formatMetricValue = (
  value: number,
  unit: MetricUnit,
  options: IFormatOptions = {
    locale: 'en-US',
    precision: 2,
    showUnit: true,
    useGrouping: true
  }
): string => {
  const { locale, precision, showUnit, useGrouping } = options;
  
  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
    useGrouping
  });

  let formattedValue = formatter.format(value);

  switch (unit) {
    case MetricUnit.PERCENTAGE:
      return `${formattedValue}${showUnit ? '%' : ''}`;
    case MetricUnit.CURRENCY:
      return `$${formattedValue}`;
    case MetricUnit.MONTHS:
      return `${formattedValue}${showUnit ? ' months' : ''}`;
    case MetricUnit.RATIO:
      return formattedValue;
    default:
      return formattedValue;
  }
};

/**
 * Generates interactive percentile visualization with accessibility support
 */
const generatePercentileVisualization = (
  benchmarkData: IBenchmarkData,
  companyValue: number,
  options: IVisualizationOptions = {
    width: DEFAULT_CHART_WIDTH,
    height: DEFAULT_CHART_HEIGHT,
    animationDuration: CHART_ANIMATION_DURATION,
    showTooltips: true,
    interactive: true
  }
): IReportSection => {
  const { width, height, animationDuration, showTooltips, interactive } = options;

  return {
    id: `visualization-${Date.now()}`,
    title: 'Percentile Comparison',
    type: SectionType.BENCHMARK_COMPARISON,
    order: 1,
    visibility: ['all'],
    style: {
      fontFamily: 'Inter, sans-serif',
      fontSize: 14,
      textColor: '#151e2d',
      backgroundColor: '#ffffff'
    },
    content: {
      chartConfig: {
        type: 'percentile',
        data: {
          benchmarks: {
            p10: benchmarkData.p10Value,
            p50: benchmarkData.p50Value,
            p90: benchmarkData.p90Value
          },
          companyValue
        },
        options: {
          width,
          height,
          animationDuration,
          showTooltips,
          interactive,
          accessibility: ACCESSIBILITY_CONFIG
        }
      }
    }
  };
};

/**
 * Generates comparison report template with interactive visualizations
 */
const generateComparisonReport = (
  benchmarkData: IBenchmarkData,
  metricDefinition: IMetricDefinition,
  companyValue: number,
  options: IReportOptions
): IReportTemplate => {
  // Validate company value against metric rules
  metricDefinition.validationRules.forEach((rule: IMetricValidationRule) => {
    if (companyValue < rule.minValue || companyValue > rule.maxValue) {
      throw new Error(`Company value ${companyValue} is outside valid range: ${rule.errorMessage}`);
    }
  });

  const formattedCompanyValue = formatMetricValue(
    companyValue,
    metricDefinition.unit
  );

  return {
    id: `report-${Date.now()}`,
    name: `${metricDefinition.name} Benchmark Comparison`,
    type: 'BENCHMARK_COMPARISON',
    version: Number(TEMPLATE_VERSION.split('.')[0]),
    isDefault: false,
    layout: {
      columns: 12,
      margins: {
        top: 40,
        right: 40,
        bottom: 40,
        left: 40
      },
      header: {
        height: 80,
        showLogo: true,
        showDate: true
      },
      footer: {
        height: 60,
        showPageNumbers: true,
        customText: `Generated on ${new Date().toLocaleDateString()}`
      }
    },
    sections: [
      // Header Section
      {
        id: 'header',
        title: metricDefinition.name,
        type: SectionType.TEXT,
        order: 0,
        visibility: ['all'],
        style: {
          fontFamily: 'Inter, sans-serif',
          fontSize: 24,
          textColor: '#151e2d'
        },
        content: {
          text: `${metricDefinition.description}\nYour Value: ${formattedCompanyValue}`
        }
      },
      // Visualization Section
      options.includeCharts ? generatePercentileVisualization(
        benchmarkData,
        companyValue
      ) : null,
      // Data Table Section
      options.includeTables ? {
        id: 'data-table',
        title: 'Benchmark Data',
        type: SectionType.TABLE,
        order: 2,
        visibility: ['all'],
        style: {
          fontFamily: 'Inter, sans-serif',
          fontSize: 14
        },
        content: {
          tableConfig: {
            headers: ['Percentile', 'Value', 'Your Position'],
            rows: [
              ['10th', formatMetricValue(benchmarkData.p10Value, metricDefinition.unit), ''],
              ['50th', formatMetricValue(benchmarkData.p50Value, metricDefinition.unit), ''],
              ['90th', formatMetricValue(benchmarkData.p90Value, metricDefinition.unit), '']
            ],
            sortable: true
          }
        }
      } : null
    ].filter(Boolean) as IReportSection[]
  };
};

// Export template generation functions
export const comparisonReportTemplate = {
  generateComparisonReport,
  formatMetricValue,
  generatePercentileVisualization
};