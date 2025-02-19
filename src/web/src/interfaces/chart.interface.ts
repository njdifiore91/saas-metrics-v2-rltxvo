// External imports
// d3 v7.0.0 - Core D3.js type definitions for chart components and visualization utilities
import * as d3 from 'd3';

/**
 * Enum defining supported chart types for visualization components
 */
export enum ChartType {
    LINE = 'line',
    BAR = 'bar',
    SCATTER = 'scatter',
    BENCHMARK = 'benchmark'
}

/**
 * Configuration interface for chart dimensions, layout, and behavior settings
 */
export interface ChartConfig {
    width: number;
    height: number;
    margin: {
        top: number;
        right: number;
        bottom: number;
        left: number;
    };
    type: ChartType;
    animate: boolean;
    responsive: boolean;
}

/**
 * Interface for chart data points with comprehensive metadata support
 */
export interface ChartData {
    id: string;
    label: string;
    value: number;
    timestamp: Date;
    metadata: Record<string, any>;
}

/**
 * Interface for benchmark comparison chart data with industry and revenue range context
 */
export interface BenchmarkChartData {
    metric: string;
    value: number;
    percentile: number;
    benchmarkValues: {
        p25: number;
        p50: number;
        p75: number;
        p90: number;
    };
    industry: string;
    revenueRange: string;
}

/**
 * Interface for comprehensive chart interaction event handlers
 */
export interface ChartEventHandlers {
    onClick: (event: MouseEvent, data: ChartData) => void;
    onHover: (event: MouseEvent, data: ChartData) => void;
    onZoom: (scale: number, translate: [number, number]) => void;
    onBrush: (selection: [Date, Date]) => void;
    onLegendClick: (series: string, active: boolean) => void;
}

/**
 * Interface for D3 scale configurations with extended options
 */
export interface ChartScale {
    type: 'linear' | 'log' | 'time' | 'ordinal' | 'band';
    domain: any[];
    range: any[];
    padding: number;
    nice: boolean;
}

/**
 * Interface for customizable chart tooltip configuration
 */
export interface ChartTooltipConfig {
    offset: {
        x: number;
        y: number;
    };
    format: (value: any) => string;
    styles: {
        [key: string]: string;
    };
    content: (data: ChartData) => string | HTMLElement;
    position: 'top' | 'right' | 'bottom' | 'left';
}