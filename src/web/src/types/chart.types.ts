// External imports
// d3 v7.0.0
import * as d3 from 'd3';

/**
 * Enumeration of supported chart types for metric visualization
 */
export enum ChartType {
  BAR = 'BAR',
  LINE = 'LINE',
  AREA = 'AREA',
  PIE = 'PIE',
  BENCHMARK = 'BENCHMARK'
}

/**
 * Enumeration of possible legend positions for chart layout configuration
 */
export enum LegendPosition {
  TOP = 'TOP',
  RIGHT = 'RIGHT',
  BOTTOM = 'BOTTOM',
  LEFT = 'LEFT'
}

/**
 * Type definition for D3 scale types used in chart axis configuration
 */
export type ScaleType = 'LINEAR' | 'LOG' | 'TIME' | 'ORDINAL';

/**
 * Interface defining chart margin configuration for proper spacing and layout
 */
export interface ChartMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Interface defining chart dimensions including responsive behavior
 */
export interface ChartDimensions {
  width: number;
  height: number;
  margin: ChartMargin;
  responsive: boolean;
}

/**
 * Interface defining structure for individual chart data points with metadata support
 */
export interface ChartDataPoint {
  label: string;
  value: number;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

/**
 * Interface defining structure for benchmark comparison data points with percentile information
 */
export interface BenchmarkDataPoint {
  metric: string;
  value: number;
  percentile: number;
  benchmarkValues: {
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
  revenueRange: string;
}

/**
 * Interface defining chart interaction event handlers with comprehensive event typing
 */
export interface ChartEventHandler {
  onClick: (event: MouseEvent, data: ChartDataPoint) => void;
  onHover: (event: MouseEvent, data: ChartDataPoint) => void;
  onZoom: (scale: number, translate: [number, number]) => void;
  onBrush: (selection: [Date, Date]) => void;
}

/**
 * Type guard to check if a data point is a benchmark data point
 */
export function isBenchmarkDataPoint(data: ChartDataPoint | BenchmarkDataPoint): data is BenchmarkDataPoint {
  return 'benchmarkValues' in data;
}

/**
 * Type for D3 scale functions used in chart rendering
 */
export type ChartScale = d3.ScaleLinear<number, number> | 
                         d3.ScaleLogarithmic<number, number> |
                         d3.ScaleTime<number, number> |
                         d3.ScaleOrdinal<string, unknown>;

/**
 * Interface for chart axis configuration
 */
export interface ChartAxis {
  scale: ScaleType;
  label: string;
  tickFormat?: string;
  tickCount?: number;
  domain?: [number | Date, number | Date];
}

/**
 * Interface for chart tooltip configuration
 */
export interface ChartTooltip {
  enabled: boolean;
  format?: (value: number) => string;
  content?: (data: ChartDataPoint) => string;
}

/**
 * Interface for chart legend configuration
 */
export interface ChartLegend {
  position: LegendPosition;
  enabled: boolean;
  title?: string;
}

/**
 * Interface for chart animation configuration
 */
export interface ChartAnimation {
  enabled: boolean;
  duration: number;
  easing: string;
}

/**
 * Interface for complete chart configuration
 */
export interface ChartConfig {
  type: ChartType;
  dimensions: ChartDimensions;
  axis: {
    x: ChartAxis;
    y: ChartAxis;
  };
  tooltip: ChartTooltip;
  legend: ChartLegend;
  animation: ChartAnimation;
  eventHandlers?: ChartEventHandler;
}