import { MetricType, MetricUnit, MetricTimeframe } from '../types/metric.types';

// Default values for metric calculations
export const DEFAULT_METRIC_TIMEFRAME = MetricTimeframe.MONTHLY;
export const DEFAULT_METRIC_UNIT = MetricUnit.CURRENCY;

// Validation rules for each metric type with comprehensive error handling
export const METRIC_VALIDATION_RULES = {
  NDR: {
    min: 0,
    max: 200,
    unit: MetricUnit.PERCENTAGE,
    errorMessage: 'Net Dollar Retention must be between 0% and 200%',
    warningThreshold: {
      low: 80,
      high: 150
    }
  },
  CAC_PAYBACK: {
    min: 0,
    max: 60,
    unit: MetricUnit.MONTHS,
    errorMessage: 'CAC Payback Period must be between 0 and 60 months',
    warningThreshold: {
      low: 6,
      high: 24
    }
  },
  MAGIC_NUMBER: {
    min: 0,
    max: 10,
    unit: MetricUnit.RATIO,
    errorMessage: 'Magic Number must be between 0 and 10',
    warningThreshold: {
      low: 0.5,
      high: 3
    }
  },
  PIPELINE_COVERAGE: {
    min: 0,
    max: 1000,
    unit: MetricUnit.PERCENTAGE,
    errorMessage: 'Pipeline Coverage must be between 0% and 1000%',
    warningThreshold: {
      low: 200,
      high: 800
    }
  },
  GROSS_MARGINS: {
    min: -100,
    max: 100,
    unit: MetricUnit.PERCENTAGE,
    errorMessage: 'Gross Margins must be between -100% and 100%',
    warningThreshold: {
      low: 40,
      high: 90
    }
  }
};

// Detailed metric definitions including formulas and descriptions
export const METRIC_DEFINITIONS = {
  NDR: {
    name: 'Net Dollar Retention',
    type: MetricType.RETENTION,
    description: 'Measures revenue retention and expansion from existing customers',
    formula: '(Starting ARR + Expansions - Contractions - Churn) / Starting ARR × 100',
    inputs: ['startingARR', 'expansions', 'contractions', 'churn'],
    timeframe: MetricTimeframe.ANNUAL,
    category: 'Core Metrics'
  },
  CAC_PAYBACK: {
    name: 'CAC Payback Period',
    type: MetricType.EFFICIENCY,
    description: 'Time required to recover customer acquisition cost',
    formula: 'CAC / (ARR × Gross Margin) × 12',
    inputs: ['cac', 'arr', 'grossMargin'],
    timeframe: MetricTimeframe.MONTHLY,
    category: 'Efficiency Metrics'
  },
  MAGIC_NUMBER: {
    name: 'Magic Number',
    type: MetricType.SALES,
    description: 'Measures sales efficiency',
    formula: 'Net New ARR / Previous Quarter S&M Spend',
    inputs: ['netNewARR', 'previousQuarterSMSpend'],
    timeframe: MetricTimeframe.QUARTERLY,
    category: 'Sales Metrics'
  },
  PIPELINE_COVERAGE: {
    name: 'Pipeline Coverage',
    type: MetricType.SALES,
    description: 'Ratio of pipeline value to revenue target',
    formula: 'Total Pipeline Value / Revenue Target × 100',
    inputs: ['pipelineValue', 'revenueTarget'],
    timeframe: MetricTimeframe.QUARTERLY,
    category: 'Sales Metrics'
  },
  GROSS_MARGINS: {
    name: 'Gross Margins',
    type: MetricType.FINANCIAL,
    description: 'Percentage of revenue retained after direct costs',
    formula: '(Revenue - COGS) / Revenue × 100',
    inputs: ['revenue', 'cogs'],
    timeframe: MetricTimeframe.QUARTERLY,
    category: 'Financial Metrics'
  }
};

// Display and formatting options for metrics
export const METRIC_DISPLAY_OPTIONS = {
  formatOptions: {
    [MetricUnit.PERCENTAGE]: {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      style: 'percent',
      multiplier: 0.01
    },
    [MetricUnit.CURRENCY]: {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    },
    [MetricUnit.RATIO]: {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    },
    [MetricUnit.MONTHS]: {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      suffix: ' months'
    }
  },
  chartOptions: {
    [MetricType.RETENTION]: {
      chartType: 'line',
      color: '#46608C',
      showTrend: true
    },
    [MetricType.EFFICIENCY]: {
      chartType: 'bar',
      color: '#168947',
      showTarget: true
    },
    [MetricType.SALES]: {
      chartType: 'column',
      color: '#151e2d',
      showForecast: true
    },
    [MetricType.FINANCIAL]: {
      chartType: 'area',
      color: '#0D3330',
      showBenchmarks: true
    }
  }
};

// Default calculation parameters for metrics
export const METRIC_CALCULATION_DEFAULTS = {
  timeframes: {
    [MetricType.RETENTION]: MetricTimeframe.ANNUAL,
    [MetricType.EFFICIENCY]: MetricTimeframe.MONTHLY,
    [MetricType.SALES]: MetricTimeframe.QUARTERLY,
    [MetricType.FINANCIAL]: MetricTimeframe.QUARTERLY
  },
  units: {
    [MetricType.RETENTION]: MetricUnit.PERCENTAGE,
    [MetricType.EFFICIENCY]: MetricUnit.MONTHS,
    [MetricType.SALES]: MetricUnit.RATIO,
    [MetricType.FINANCIAL]: MetricUnit.CURRENCY
  }
};