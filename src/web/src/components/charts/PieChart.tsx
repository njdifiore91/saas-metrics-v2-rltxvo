// React 18.2.0 - Core React library for component development
import React, { useEffect, useRef, useMemo, useCallback } from 'react';
// D3.js 7.0.0 - Data visualization library
import * as d3 from 'd3';

import { ChartConfig, ChartData, ChartEventHandlers } from '../interfaces/chart.interface';

interface PieChartProps {
  data: ChartData[];
  config: ChartConfig;
  eventHandlers?: ChartEventHandlers;
  ariaLabel?: string;
}

interface PieArcDatum extends d3.PieArcDatum<ChartData> {
  data: ChartData;
}

const PieChart: React.FC<PieChartProps> = ({
  data,
  config,
  eventHandlers,
  ariaLabel = 'Pie Chart'
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const pieRef = useRef<d3.Pie<any, ChartData>>();
  const arcRef = useRef<d3.Arc<any, PieArcDatum>>();

  // Memoize chart dimensions for performance
  const dimensions = useMemo(() => {
    const { width, height, margin } = config;
    return {
      width,
      height,
      radius: Math.min(width - margin.left - margin.right, 
                      height - margin.top - margin.bottom) / 2
    };
  }, [config]);

  // Memoize color scale with high contrast support
  const colorScale = useMemo(() => {
    return d3.scaleOrdinal<string>()
      .domain(data.map(d => d.id))
      .range(config.highContrastMode 
        ? d3.schemeCategory10 
        : d3.interpolateSpectral(data.length));
  }, [data, config.highContrastMode]);

  // Create accessible tooltip
  const createTooltip = useCallback(() => {
    if (!tooltipRef.current) {
      const tooltip = d3.select('body')
        .append('div')
        .attr('class', 'pie-chart-tooltip')
        .attr('role', 'tooltip')
        .style('opacity', 0)
        .style('position', 'absolute')
        .style('pointer-events', 'none')
        .style('background', 'rgba(0, 0, 0, 0.8)')
        .style('color', 'white')
        .style('padding', '8px')
        .style('border-radius', '4px');
      
      tooltipRef.current = tooltip.node() as HTMLDivElement;
    }
  }, []);

  // Memoize pie layout generator
  const createPieGenerator = useCallback(() => {
    if (!pieRef.current) {
      pieRef.current = d3.pie<ChartData>()
        .value(d => d.value)
        .sort(null);
    }
    return pieRef.current;
  }, []);

  // Memoize arc generator
  const createArcGenerator = useCallback(() => {
    if (!arcRef.current) {
      arcRef.current = d3.arc<PieArcDatum>()
        .innerRadius(0)
        .outerRadius(dimensions.radius);
    }
    return arcRef.current;
  }, [dimensions.radius]);

  // Handle mouse/touch interactions
  const handleInteraction = useCallback((
    event: MouseEvent | TouchEvent,
    d: PieArcDatum
  ) => {
    const tooltip = d3.select(tooltipRef.current);
    const percentage = (d.data.value / d3.sum(data, d => d.value) * 100).toFixed(1);
    
    tooltip
      .style('opacity', 1)
      .html(`
        <strong>${d.data.label}</strong><br/>
        ${d.data.value} (${percentage}%)
      `)
      .style('left', `${event instanceof MouseEvent ? event.pageX : 
        (event as TouchEvent).touches[0].pageX}px`)
      .style('top', `${event instanceof MouseEvent ? event.pageY : 
        (event as TouchEvent).touches[0].pageY}px`);
  }, [data]);

  // Handle keyboard navigation
  const handleKeyboardNavigation = useCallback((event: KeyboardEvent) => {
    const segments = d3.selectAll('.pie-segment');
    const currentIndex = Number(d3.select(document.activeElement).attr('data-index'));
    
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        const nextIndex = (currentIndex + 1) % segments.size();
        segments.filter(`[data-index="${nextIndex}"]`).node()?.focus();
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        const prevIndex = (currentIndex - 1 + segments.size()) % segments.size();
        segments.filter(`[data-index="${prevIndex}"]`).node()?.focus();
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        const segment = d3.select(document.activeElement);
        const datum = segment.datum() as PieArcDatum;
        eventHandlers?.onClick?.(event, datum.data);
        break;
    }
  }, [eventHandlers]);

  // Create or update chart
  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    // Setup SVG container
    const svg = d3.select(svgRef.current)
      .attr('width', dimensions.width)
      .attr('height', dimensions.height)
      .attr('role', 'img')
      .attr('aria-label', ariaLabel);

    const g = svg.select('.pie-container');
    const pie = createPieGenerator();
    const arc = createArcGenerator();
    const pieData = pie(data);

    // Create or update pie segments
    const segments = g.selectAll<SVGPathElement, PieArcDatum>('.pie-segment')
      .data(pieData)
      .join(
        enter => enter.append('path')
          .attr('class', 'pie-segment')
          .attr('role', 'button')
          .attr('tabindex', 0)
          .attr('data-index', (_, i) => i)
          .attr('d', arc)
          .style('fill', d => colorScale(d.data.id))
          .style('stroke', 'white')
          .style('stroke-width', 2)
          .attr('aria-label', d => {
            const percentage = (d.data.value / d3.sum(data, d => d.value) * 100).toFixed(1);
            return `${d.data.label}: ${d.data.value} (${percentage}%)`;
          }),
        update => update
          .transition()
          .duration(config.animationDuration || 750)
          .attrTween('d', function(d) {
            const interpolate = d3.interpolate(this._current || d, d);
            this._current = interpolate(0);
            return (t: number) => arc(interpolate(t));
          })
      );

    // Setup event listeners
    segments
      .on('mouseover touchstart', handleInteraction)
      .on('mouseout touchend', () => {
        d3.select(tooltipRef.current).style('opacity', 0);
      })
      .on('click', (event, d) => eventHandlers?.onClick?.(event, d.data))
      .on('keydown', handleKeyboardNavigation);

    // Create tooltip
    createTooltip();

    // Cleanup
    return () => {
      if (tooltipRef.current) {
        d3.select(tooltipRef.current).remove();
        tooltipRef.current = null;
      }
    };
  }, [
    data,
    dimensions,
    config,
    colorScale,
    createPieGenerator,
    createArcGenerator,
    handleInteraction,
    handleKeyboardNavigation,
    createTooltip,
    ariaLabel,
    eventHandlers
  ]);

  return (
    <div className="pie-chart-container" role="group" aria-label={ariaLabel}>
      <svg 
        ref={svgRef}
        className="pie-chart"
        style={{ overflow: 'visible' }}
      >
        <g 
          className="pie-container"
          transform={`translate(${dimensions.width/2},${dimensions.height/2})`}
        />
      </svg>
    </div>
  );
};

export default PieChart;