import * as d3 from 'd3'; // v7.0.0
import { ChartType } from '../types/chart.types';
import { CHART_COLORS } from '../constants/chart.constants';

/**
 * Default chart configuration with comprehensive settings for accessibility,
 * responsiveness, and interactive features
 */
export const DEFAULT_CHART_CONFIG = {
  dimensions: {
    width: 800,
    height: 400,
    margin: {
      top: 20,
      right: 20,
      bottom: 30,
      left: 40
    },
    responsive: {
      mobile: {
        width: 320,
        height: 240,
        margin: {
          top: 15,
          right: 15,
          bottom: 25,
          left: 35
        }
      },
      tablet: {
        width: 600,
        height: 350,
        margin: {
          top: 20,
          right: 20,
          bottom: 30,
          left: 40
        }
      },
      desktop: {
        width: 800,
        height: 400,
        margin: {
          top: 20,
          right: 20,
          bottom: 30,
          left: 40
        }
      }
    }
  },
  accessibility: {
    ariaLabels: true,
    keyboardNav: true,
    reducedMotion: 'respects-user-preference',
    colorContrast: 'WCAG-AA',
    screenReader: {
      announcements: true,
      descriptions: true,
      focus: {
        outline: true,
        indicatorColor: CHART_COLORS.ACCENT
      }
    },
    patterns: {
      enabled: true,
      types: ['solid', 'dashed', 'dotted', 'dash-dot']
    }
  },
  animation: {
    duration: 300,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    reducedMotion: {
      duration: 0,
      enabled: false
    }
  },
  tooltip: {
    enabled: true,
    interactive: true,
    followCursor: true,
    delay: 200,
    offset: {
      x: 10,
      y: 10
    },
    styles: {
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: 'rgba(0, 0, 0, 0.1)',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      borderRadius: '4px',
      padding: '8px',
      fontSize: '12px',
      fontFamily: 'Inter, -apple-system, sans-serif'
    }
  },
  grid: {
    enabled: true,
    style: {
      stroke: '#e0e0e0',
      strokeWidth: 1,
      strokeDasharray: '4'
    },
    responsive: {
      mobile: { density: 0.5 },
      tablet: { density: 0.75 },
      desktop: { density: 1 }
    }
  },
  colors: {
    primary: CHART_COLORS.PRIMARY,
    secondary: CHART_COLORS.SECONDARY,
    accent: CHART_COLORS.ACCENT,
    background: CHART_COLORS.BACKGROUND,
    text: CHART_COLORS.TEXT
  }
};

/**
 * Returns chart configuration based on chart type and custom options
 * with enhanced validation and responsive adaptations
 */
export const getChartConfig = (
  chartType: ChartType,
  customOptions: Record<string, any> = {},
  viewport: { width: number; height: number }
): Record<string, any> => {
  // Determine responsive configuration based on viewport
  const responsiveConfig = (() => {
    if (viewport.width <= 320) return DEFAULT_CHART_CONFIG.dimensions.responsive.mobile;
    if (viewport.width <= 768) return DEFAULT_CHART_CONFIG.dimensions.responsive.tablet;
    return DEFAULT_CHART_CONFIG.dimensions.responsive.desktop;
  })();

  // Get chart type specific defaults
  const typeSpecificConfig = (() => {
    switch (chartType) {
      case ChartType.BAR:
        return {
          padding: 0.1,
          cornerRadius: 2,
          orientation: 'vertical'
        };
      case ChartType.LINE:
        return {
          curve: d3.curveMonotoneX,
          strokeWidth: 2,
          pointRadius: 4
        };
      case ChartType.AREA:
        return {
          curve: d3.curveMonotoneX,
          fillOpacity: 0.2,
          strokeWidth: 1.5
        };
      case ChartType.PIE:
        return {
          innerRadius: 0,
          padAngle: 0.02,
          cornerRadius: 2
        };
      case ChartType.BENCHMARK:
        return {
          percentileColors: {
            p25: '#e5e5e5',
            p50: '#b3b3b3',
            p75: '#808080',
            p90: '#4d4d4d'
          },
          lineThickness: 2,
          pointRadius: 4
        };
      default:
        return {};
    }
  })();

  // Merge configurations with proper precedence
  return {
    ...DEFAULT_CHART_CONFIG,
    ...typeSpecificConfig,
    dimensions: {
      ...responsiveConfig
    },
    ...customOptions,
    // Ensure accessibility settings are always applied
    accessibility: {
      ...DEFAULT_CHART_CONFIG.accessibility,
      ...customOptions.accessibility
    }
  };
};

/**
 * Configures D3 scales based on data type and range with enhanced options
 */
export const getScaleConfig = (
  scaleType: string,
  domain: any[],
  range: number[],
  options: Record<string, any> = {}
): d3.ScaleLinear<number, number> | d3.ScaleTime<number, number> | d3.ScaleOrdinal<string, unknown> => {
  switch (scaleType) {
    case 'linear':
      return d3.scaleLinear()
        .domain(domain)
        .range(range)
        .nice();
    
    case 'time':
      return d3.scaleTime()
        .domain(domain)
        .range(range)
        .nice();
    
    case 'ordinal':
      return d3.scaleOrdinal()
        .domain(domain)
        .range(range);
    
    default:
      return d3.scaleLinear()
        .domain(domain)
        .range(range)
        .nice();
  }
};

// Export chart configuration utilities
export const chartConfig = {
  getChartConfig,
  getScaleConfig,
  DEFAULT_CHART_CONFIG
};

export default chartConfig;