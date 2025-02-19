import { ChartType } from '../types/chart.types';

/**
 * Brand color constants for chart components
 * @version 1.0.0
 */
export const CHART_COLORS = {
  PRIMARY: '#151e2d',
  PRIMARY_HOVER: 'rgba(21, 30, 45, 0.8)',
  SECONDARY: '#46608C',
  SECONDARY_HOVER: 'rgba(70, 96, 140, 0.8)',
  ACCENT: '#168947',
  ACCENT_HOVER: 'rgba(22, 137, 71, 0.8)',
  BACKGROUND: '#DBEAAC',
  TEXT: '#0D3330',
  METRIC_COLORS: {
    REVENUE: '#168947',
    GROWTH: '#46608C',
    EFFICIENCY: '#8B4513',
    RETENTION: '#4B0082'
  }
} as const;

/**
 * Chart dimension constants with responsive breakpoints
 * @version 1.0.0
 */
export const CHART_DIMENSIONS = {
  BREAKPOINTS: {
    MOBILE: '320',
    TABLET: '768',
    DESKTOP: '1024',
    WIDE: '1440'
  },
  DEFAULT_WIDTH: '800',
  DEFAULT_HEIGHT: '400',
  MIN_WIDTH: '300',
  MIN_HEIGHT: '200',
  MARGIN: {
    TOP: '20',
    RIGHT: '20',
    BOTTOM: '30',
    LEFT: '40'
  },
  RESPONSIVE_RATIOS: {
    MOBILE: '1.2',
    TABLET: '1.5',
    DESKTOP: '2'
  }
} as const;

/**
 * Animation constants with accessibility considerations
 * @version 1.0.0
 */
export const CHART_ANIMATION = {
  DURATION: '300',
  DURATION_SLOW: '500',
  DURATION_FAST: '150',
  EASING: 'cubic-bezier(0.4, 0, 0.2, 1)',
  REDUCED_MOTION: {
    DURATION: '0',
    EASING: 'linear'
  }
} as const;

/**
 * Legend styling and positioning constants
 * @version 1.0.0
 */
export const CHART_LEGEND = {
  POSITION: {
    TOP: 'top',
    RIGHT: 'right',
    BOTTOM: 'bottom',
    LEFT: 'left'
  },
  FONT_SIZE: '12',
  FONT_FAMILY: 'Inter, -apple-system, sans-serif',
  PADDING: '10',
  ITEM_SPACING: '8',
  SYMBOL_SIZE: '16',
  INTERACTIVE: {
    HOVER_OPACITY: '0.8',
    DISABLED_OPACITY: '0.4'
  }
} as const;

/**
 * Tooltip styling and behavior constants
 * @version 1.0.0
 */
export const CHART_TOOLTIP = {
  OFFSET_X: '10',
  OFFSET_Y: '10',
  PADDING: '8',
  BORDER_RADIUS: '4',
  BACKGROUND_COLOR: 'rgba(255, 255, 255, 0.95)',
  BORDER_COLOR: 'rgba(0, 0, 0, 0.1)',
  FONT_SIZE: '12',
  FONT_FAMILY: 'Inter, -apple-system, sans-serif',
  BOX_SHADOW: '0 2px 4px rgba(0, 0, 0, 0.1)',
  Z_INDEX: '1000',
  MAX_WIDTH: '200',
  TRANSITION: 'opacity 150ms ease-in-out'
} as const;

/**
 * Benchmark chart specific styling with accessibility support
 * @version 1.0.0
 */
export const BENCHMARK_CHART = {
  PERCENTILE_COLORS: {
    P25: '#e5e5e5',
    P50: '#b3b3b3',
    P75: '#808080',
    P90: '#4d4d4d'
  },
  YOUR_POSITION_COLOR: '#168947',
  LINE_THICKNESS: '2',
  POINT_RADIUS: '4',
  HOVER_EFFECTS: {
    POINT_RADIUS_EXPANDED: '6',
    LINE_THICKNESS_EXPANDED: '3',
    TRANSITION: 'all 150ms ease-in-out'
  },
  ACCESSIBILITY: {
    PATTERN_TYPES: ['solid', 'dashed', 'dotted', 'dash-dot'],
    HIGH_CONTRAST_COLORS: {
      P25: '#000000',
      P50: '#404040',
      P75: '#808080',
      P90: '#FFFFFF'
    }
  }
} as const;

/**
 * Grid styling constants with responsive support
 * @version 1.0.0
 */
export const CHART_GRID = {
  STROKE_COLOR: 'rgba(0, 0, 0, 0.1)',
  STROKE_WIDTH: '1',
  STROKE_DASHARRAY: '4',
  BACKGROUND_OPACITY: '0.02',
  RESPONSIVE: {
    MOBILE_DENSITY: '0.5',
    TABLET_DENSITY: '0.75',
    DESKTOP_DENSITY: '1'
  }
} as const;

/**
 * Axis styling and formatting constants
 * @version 1.0.0
 */
export const CHART_AXIS = {
  TICK_SIZE: '6',
  TICK_PADDING: '3',
  FONT_SIZE: '12',
  FONT_FAMILY: 'Inter, -apple-system, sans-serif',
  FONT_COLOR: '#666666',
  LINE_COLOR: '#cccccc',
  LABEL_PADDING: '12',
  FORMAT: {
    CURRENCY: '$0,0.00',
    PERCENTAGE: '0.0%',
    NUMBER: '0,0',
    DATE: 'MMM YYYY'
  }
} as const;