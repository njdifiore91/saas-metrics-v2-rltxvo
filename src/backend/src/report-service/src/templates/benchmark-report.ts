/**
 * Benchmark Report Template Definition
 * Provides enhanced template structure for generating benchmark comparison reports
 * with comprehensive visualization sections and accessibility features
 * @version 1.0.0
 */

import { 
  IReportTemplate, 
  IReportSection, 
  ReportType, 
  SectionType, 
  IReportLayout 
} from '../../../shared/interfaces/report.interface';
import { IBenchmarkData } from '../../../shared/interfaces/benchmark.interface';
import { IMetricDefinition, MetricUnit } from '../../../shared/interfaces/metric.interface';

/**
 * Configuration for accessibility features in report sections
 */
const ACCESSIBILITY_CONFIG = {
  charts: {
    ariaLabels: true,
    colorBlindFriendly: true,
    keyboardNavigation: true,
    textAlternatives: true
  },
  tables: {
    ariaSort: true,
    headerScope: true,
    captionText: true
  }
};

/**
 * Internationalization configuration for metric units and labels
 */
const I18N_CONFIG = {
  units: {
    [MetricUnit.PERCENTAGE]: '%',
    [MetricUnit.CURRENCY]: 'USD',
    [MetricUnit.RATIO]: 'x',
    [MetricUnit.MONTHS]: 'mo'
  },
  labels: {
    percentiles: {
      p10: '10th Percentile',
      p50: 'Median',
      p90: '90th Percentile'
    }
  }
};

/**
 * Enhanced chart layouts with accessibility features
 */
const CHART_LAYOUTS = {
  distribution: {
    type: 'boxplot',
    colorScheme: ['#46608C', '#168947', '#151e2d'],
    accessibility: {
      announceNewData: true,
      description: 'Benchmark distribution chart showing percentile ranges'
    }
  },
  trend: {
    type: 'line',
    colorScheme: ['#46608C', '#168947'],
    accessibility: {
      announceNewData: true,
      description: 'Trend analysis chart showing historical performance'
    }
  }
};

/**
 * Enhanced section configurations for benchmark reports
 */
const BENCHMARK_SECTIONS: IReportSection[] = [
  {
    id: 'header',
    title: 'Benchmark Comparison Report',
    type: SectionType.TEXT,
    content: {
      text: 'Comprehensive benchmark analysis with industry comparisons'
    },
    order: 1,
    visibility: ['all'],
    style: {
      fontFamily: 'Inter',
      fontSize: 24,
      textColor: '#151e2d'
    }
  },
  {
    id: 'metric-overview',
    title: 'Metric Overview',
    type: SectionType.METRIC_CARD,
    content: {
      metrics: []
    },
    order: 2,
    visibility: ['all'],
    style: {
      fontFamily: 'Inter',
      fontSize: 16,
      customClasses: ['metric-card-container']
    }
  },
  {
    id: 'distribution-chart',
    title: 'Benchmark Distribution',
    type: SectionType.CHART,
    content: {
      chartConfig: {
        type: CHART_LAYOUTS.distribution.type,
        options: CHART_LAYOUTS.distribution.accessibility
      }
    },
    order: 3,
    visibility: ['all'],
    style: {
      customClasses: ['chart-container']
    }
  },
  {
    id: 'percentile-table',
    title: 'Percentile Comparison',
    type: SectionType.TABLE,
    content: {
      tableConfig: {
        headers: ['Percentile', 'Value', 'Comparison'],
        sortable: true
      }
    },
    order: 4,
    visibility: ['all'],
    style: {
      customClasses: ['table-container']
    }
  },
  {
    id: 'trend-analysis',
    title: 'Historical Trend',
    type: SectionType.TREND_VISUALIZATION,
    content: {
      chartConfig: {
        type: CHART_LAYOUTS.trend.type,
        options: CHART_LAYOUTS.trend.accessibility
      }
    },
    order: 5,
    visibility: ['all'],
    style: {
      customClasses: ['trend-container']
    }
  }
];

/**
 * Default report layout configuration
 */
const DEFAULT_LAYOUT: IReportLayout = {
  columns: 12,
  margins: {
    top: 32,
    right: 32,
    bottom: 32,
    left: 32
  },
  header: {
    height: 80,
    showLogo: true,
    showDate: true
  },
  footer: {
    height: 48,
    showPageNumbers: true,
    customText: 'Confidential - For Internal Use Only'
  }
};

/**
 * Enhanced benchmark report template with accessibility features
 */
export const benchmarkReportTemplate: IReportTemplate = {
  id: 'benchmark-comparison-template',
  name: 'Benchmark Comparison Report',
  type: ReportType.BENCHMARK_COMPARISON,
  layout: DEFAULT_LAYOUT,
  sections: BENCHMARK_SECTIONS,
  isDefault: true,
  version: 1,
  accessibility: ACCESSIBILITY_CONFIG,
  i18n: I18N_CONFIG
};

/**
 * Generates an enhanced benchmark report with comprehensive visualization sections
 */
export function generateBenchmarkReport(
  benchmarkData: IBenchmarkData,
  metricDefinition: IMetricDefinition,
  visualOptions: any
): IReportTemplate {
  const template = { ...benchmarkReportTemplate };
  
  // Enhance sections with dynamic data and configurations
  template.sections = template.sections.map(section => {
    const enhancedSection = { ...section };
    
    switch (section.id) {
      case 'metric-overview':
        enhancedSection.content.metrics = [metricDefinition];
        break;
      case 'distribution-chart':
        enhancedSection.content.chartConfig.data = {
          p10: benchmarkData.p10Value,
          p50: benchmarkData.p50Value,
          p90: benchmarkData.p90Value
        };
        break;
      case 'percentile-table':
        enhancedSection.content.tableConfig.rows = [
          ['10th', benchmarkData.p10Value, 'Below Average'],
          ['50th', benchmarkData.p50Value, 'Average'],
          ['90th', benchmarkData.p90Value, 'Above Average']
        ];
        break;
      case 'trend-analysis':
        enhancedSection.content.chartConfig.data = benchmarkData.historicalData;
        break;
    }
    
    return enhancedSection;
  });
  
  return template;
}