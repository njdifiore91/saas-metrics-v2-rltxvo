// External imports
// d3 v7.0.0
import * as d3 from 'd3';
// lodash v4.17.21
import { memoize, debounce } from 'lodash';

// Internal imports
import { ChartConfig } from '../interfaces/chart.interface';
import { ChartType } from '../types/chart.types';
import { CHART_COLORS } from '../constants/chart.constants';

/**
 * Calculates optimized chart dimensions with accessibility considerations
 * @param config - Chart configuration object
 * @returns Calculated dimensions with inner width/height
 */
export const calculateChartDimensions = memoize((config: ChartConfig) => {
  // Validate minimum dimensions for accessibility
  const minWidth = 300;
  const minHeight = 200;

  const width = Math.max(config.width, minWidth);
  const height = Math.max(config.height, minHeight);

  // Calculate inner dimensions accounting for margins
  const innerWidth = width - config.margin.left - config.margin.right;
  const innerHeight = height - config.margin.top - config.margin.bottom;

  return {
    width,
    height,
    innerWidth,
    innerHeight
  };
}, (config: ChartConfig) => JSON.stringify(config));

/**
 * Creates D3 scales with accessibility-compliant ranges
 * @param type - Type of chart being rendered
 * @param data - Dataset for scale calculation
 * @param dimensions - Chart dimensions object
 * @returns Object containing configured scales
 */
export const createChartScales = (
  type: ChartType,
  data: Array<{ value: number; label: string }>,
  dimensions: { innerWidth: number; innerHeight: number }
): { xScale: d3.Scale; yScale: d3.Scale; colorScale: d3.ScaleOrdinal<string, string> } => {
  let xScale: d3.Scale;
  let yScale: d3.Scale;

  // Create appropriate scales based on chart type
  switch (type) {
    case ChartType.BAR:
      xScale = d3.scaleBand()
        .domain(data.map(d => d.label))
        .range([0, dimensions.innerWidth])
        .padding(0.1);

      yScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.value) || 0])
        .range([dimensions.innerHeight, 0])
        .nice();
      break;

    case ChartType.LINE:
      xScale = d3.scalePoint()
        .domain(data.map(d => d.label))
        .range([0, dimensions.innerWidth]);

      yScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.value) || 0])
        .range([dimensions.innerHeight, 0])
        .nice();
      break;

    case ChartType.BENCHMARK:
      xScale = d3.scaleLinear()
        .domain([0, 100])
        .range([0, dimensions.innerWidth]);

      yScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.value) || 0])
        .range([dimensions.innerHeight, 0])
        .nice();
      break;

    default:
      throw new Error(`Unsupported chart type: ${type}`);
  }

  // Create accessible color scale
  const colorScale = d3.scaleOrdinal<string>()
    .domain(data.map(d => d.label))
    .range([
      CHART_COLORS.PRIMARY,
      CHART_COLORS.SECONDARY,
      CHART_COLORS.ACCENT,
      CHART_COLORS.HIGH_CONTRAST
    ]);

  return { xScale, yScale, colorScale };
};

/**
 * Creates accessible and interactive chart tooltips
 * @param container - DOM element containing the chart
 * @param accessibilityConfig - Configuration for accessibility features
 * @returns Enhanced D3 tooltip with accessibility support
 */
export const createChartTooltip = (
  container: HTMLElement,
  accessibilityConfig: {
    announceToScreenReader: boolean;
    highContrastMode: boolean;
    reducedMotion: boolean;
  }
) => {
  // Create tooltip element with ARIA attributes
  const tooltip = d3.select(container)
    .append('div')
    .attr('class', 'chart-tooltip')
    .attr('role', 'tooltip')
    .attr('aria-hidden', 'true')
    .style('opacity', 0)
    .style('position', 'absolute')
    .style('pointer-events', 'none')
    .style('background', accessibilityConfig.highContrastMode ? '#000000' : 'rgba(255, 255, 255, 0.95)')
    .style('color', accessibilityConfig.highContrastMode ? '#FFFFFF' : '#000000')
    .style('padding', '8px')
    .style('border-radius', '4px')
    .style('font-size', '12px')
    .style('z-index', '100');

  // Debounced show/hide functions for performance
  const showTooltip = debounce((event: MouseEvent, data: any) => {
    tooltip
      .style('opacity', 1)
      .style('left', `${event.pageX + 10}px`)
      .style('top', `${event.pageY - 10}px`)
      .attr('aria-hidden', 'false');

    if (accessibilityConfig.announceToScreenReader) {
      // Create live region for screen reader announcements
      const announcement = `${data.label}: ${data.value}`;
      const liveRegion = document.getElementById('chart-live-region') || 
        document.createElement('div');
      liveRegion.id = 'chart-live-region';
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.textContent = announcement;
    }
  }, 50);

  const hideTooltip = debounce(() => {
    tooltip
      .style('opacity', 0)
      .attr('aria-hidden', 'true');
  }, 50);

  // Add keyboard navigation support
  container.setAttribute('tabindex', '0');
  container.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      hideTooltip();
    }
  });

  return {
    show: showTooltip,
    hide: hideTooltip,
    node: tooltip.node(),
    update: (content: string) => {
      tooltip.html(content);
    }
  };
};