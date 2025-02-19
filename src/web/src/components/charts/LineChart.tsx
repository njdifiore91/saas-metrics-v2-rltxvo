// External imports
// d3 v7.0.0
import * as d3 from 'd3';
// react v18.2.0
import React, { useEffect, useRef, memo, useCallback } from 'react';

// Internal imports
import { ChartConfig, ChartData } from '../interfaces/chart.interface';
import { calculateChartDimensions, createChartScales, createChartTooltip } from '../utils/chart.utils';
import { CHART_COLORS, CHART_ANIMATION, CHART_TOOLTIP, CHART_AXIS } from '../constants/chart.constants';

interface LineChartProps {
  config: ChartConfig;
  data: ChartData[];
  onHover?: (event: MouseEvent, data: ChartData) => void;
  onClick?: (event: MouseEvent, data: ChartData) => void;
  onZoom?: (scale: number, translate: [number, number]) => void;
  onResize?: (dimensions: { width: number; height: number }) => void;
}

/**
 * LineChart Component - A highly interactive and accessible line chart
 * built with React and D3.js featuring responsive design and performance optimizations.
 */
const LineChart = memo(({
  config,
  data,
  onHover,
  onClick,
  onZoom,
  onResize
}: LineChartProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  /**
   * Initializes the chart with accessibility features and responsive design
   */
  const initializeChart = useCallback(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const dimensions = calculateChartDimensions(config);
    const { xScale, yScale } = createChartScales('LINE', data, dimensions);

    // Clear existing content
    svg.selectAll('*').remove();

    // Set up chart container with ARIA attributes
    svg
      .attr('width', dimensions.width)
      .attr('height', dimensions.height)
      .attr('role', 'img')
      .attr('aria-label', 'Line chart showing metric trends over time')
      .append('g')
      .attr('transform', `translate(${config.margin.left},${config.margin.top})`);

    // Create accessible axes
    const xAxis = d3.axisBottom(xScale)
      .tickSize(CHART_AXIS.TICK_SIZE)
      .tickPadding(CHART_AXIS.TICK_PADDING);

    const yAxis = d3.axisLeft(yScale)
      .tickSize(CHART_AXIS.TICK_SIZE)
      .tickPadding(CHART_AXIS.TICK_PADDING);

    // Add x-axis with labels
    svg.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${dimensions.innerHeight})`)
      .call(xAxis)
      .attr('aria-label', 'X axis')
      .selectAll('text')
      .style('font-family', CHART_AXIS.FONT_FAMILY)
      .style('font-size', CHART_AXIS.FONT_SIZE);

    // Add y-axis with labels
    svg.append('g')
      .attr('class', 'y-axis')
      .call(yAxis)
      .attr('aria-label', 'Y axis')
      .selectAll('text')
      .style('font-family', CHART_AXIS.FONT_FAMILY)
      .style('font-size', CHART_AXIS.FONT_SIZE);

    // Create line generator
    const line = d3.line<ChartData>()
      .x(d => xScale(d.timestamp))
      .y(d => yScale(d.value))
      .curve(d3.curveMonotoneX);

    // Add line path with animations
    const path = svg.append('path')
      .datum(data)
      .attr('class', 'line')
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', CHART_COLORS.PRIMARY)
      .attr('stroke-width', 2)
      .attr('role', 'presentation');

    // Add animation if enabled
    if (config.animate) {
      const pathLength = path.node()?.getTotalLength() || 0;
      path
        .attr('stroke-dasharray', `${pathLength} ${pathLength}`)
        .attr('stroke-dashoffset', pathLength)
        .transition()
        .duration(parseInt(CHART_ANIMATION.DURATION))
        .ease(d3.easeCubicInOut)
        .attr('stroke-dashoffset', 0);
    }

    // Add interactive data points
    svg.selectAll('.data-point')
      .data(data)
      .enter()
      .append('circle')
      .attr('class', 'data-point')
      .attr('cx', d => xScale(d.timestamp))
      .attr('cy', d => yScale(d.value))
      .attr('r', 4)
      .attr('fill', CHART_COLORS.PRIMARY)
      .attr('role', 'button')
      .attr('tabindex', 0)
      .attr('aria-label', d => `Data point: ${d.label}, Value: ${d.value}`);

    // Initialize tooltip
    const tooltip = createChartTooltip(svgRef.current.parentElement!, {
      announceToScreenReader: true,
      highContrastMode: false,
      reducedMotion: false
    });

    // Add event listeners
    svg.selectAll('.data-point')
      .on('mouseover', (event: MouseEvent, d: ChartData) => {
        d3.select(event.target as SVGCircleElement)
          .transition()
          .duration(150)
          .attr('r', 6);
        
        tooltip.show(event, d);
        onHover?.(event, d);
      })
      .on('mouseout', (event: MouseEvent) => {
        d3.select(event.target as SVGCircleElement)
          .transition()
          .duration(150)
          .attr('r', 4);
        
        tooltip.hide();
      })
      .on('click', (event: MouseEvent, d: ChartData) => {
        onClick?.(event, d);
      })
      .on('keydown', (event: KeyboardEvent, d: ChartData) => {
        if (event.key === 'Enter' || event.key === ' ') {
          onClick?.(event as unknown as MouseEvent, d);
        }
      });

    // Add zoom behavior if enabled
    if (onZoom) {
      const zoom = d3.zoom()
        .scaleExtent([1, 5])
        .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
          const { transform } = event;
          svg.selectAll('path, circle')
            .attr('transform', transform);
          svg.selectAll('.x-axis, .y-axis')
            .call(axis => axis.attr('transform', transform));
          onZoom(transform.k, [transform.x, transform.y]);
        });

      svg.call(zoom);
    }
  }, [config, data, onClick, onHover, onZoom]);

  /**
   * Sets up resize observer for responsive behavior
   */
  useEffect(() => {
    if (!config.responsive || !svgRef.current) return;

    resizeObserverRef.current = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      onResize?.({ width, height });
      initializeChart();
    });

    resizeObserverRef.current.observe(svgRef.current.parentElement!);

    return () => {
      resizeObserverRef.current?.disconnect();
    };
  }, [config.responsive, initializeChart, onResize]);

  /**
   * Initializes chart on mount and updates on data/config changes
   */
  useEffect(() => {
    initializeChart();
  }, [initializeChart, data, config]);

  return (
    <div className="line-chart-container" style={{ width: '100%', height: '100%' }}>
      <svg
        ref={svgRef}
        className="line-chart"
        style={{ overflow: 'visible' }}
      />
      <div ref={tooltipRef} className="line-chart-tooltip" />
    </div>
  );
});

LineChart.displayName = 'LineChart';

export default LineChart;