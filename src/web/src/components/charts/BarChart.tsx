import React, { useEffect, useRef, useState, useCallback } from 'react';
// d3 v7.0.0
import * as d3 from 'd3';
import { ChartConfig, ChartData } from '../interfaces/chart.interface';

interface BarChartProps {
  config: ChartConfig;
  data: ChartData[];
  onClick?: (data: ChartData) => void;
  onHover?: (data: ChartData) => void;
  accessibility?: {
    description?: string;
    announceDataPoints?: boolean;
  };
  animation?: {
    duration: number;
    easing: string;
  };
}

export const BarChart: React.FC<BarChartProps> = ({
  config,
  data,
  onClick,
  onHover,
  accessibility = {},
  animation = { duration: 750, easing: 'cubic-out' }
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Create responsive container
  useEffect(() => {
    const resizeObserver = new ResizeObserver(entries => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        setDimensions({ width, height });
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // Chart rendering function
  const renderChart = useCallback(() => {
    if (!svgRef.current || !data.length) return;

    const svg = d3.select(svgRef.current);
    const { margin } = config;
    const width = dimensions.width - margin.left - margin.right;
    const height = dimensions.height - margin.top - margin.bottom;

    // Clear previous content
    svg.selectAll('*').remove();

    // Create accessible container
    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)
      .attr('role', 'graphics-document')
      .attr('aria-roledescription', 'bar chart');

    // Create scales
    const xScale = d3.scaleBand()
      .domain(data.map(d => d.label))
      .range([0, width])
      .padding(0.2);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.value) || 0])
      .range([height, 0])
      .nice();

    // Create axes with accessibility
    const xAxis = g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale))
      .attr('role', 'presentation')
      .attr('aria-label', 'X axis');

    const yAxis = g.append('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(yScale))
      .attr('role', 'presentation')
      .attr('aria-label', 'Y axis');

    // Add bars with animations and accessibility
    const bars = g.selectAll('.bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', d => xScale(d.label) || 0)
      .attr('width', xScale.bandwidth())
      .attr('y', height)
      .attr('height', 0)
      .attr('fill', d => d.color || '#4299e1')
      .attr('role', 'graphics-symbol')
      .attr('aria-roledescription', 'bar')
      .attr('aria-label', d => `${d.label}: ${d.value}`);

    // Animate bars
    bars.transition()
      .duration(animation.duration)
      .ease(d3[animation.easing])
      .attr('y', d => yScale(d.value))
      .attr('height', d => height - yScale(d.value));

    // Add interaction handlers
    bars
      .on('mouseenter', (event, d) => {
        handleHover(event, d, true);
      })
      .on('mouseleave', (event, d) => {
        handleHover(event, d, false);
      })
      .on('click', (event, d) => {
        if (onClick) onClick(d);
      })
      .on('focus', (event, d) => {
        handleHover(event, d, true);
      })
      .on('blur', (event, d) => {
        handleHover(event, d, false);
      });

    // Add keyboard navigation
    bars.attr('tabindex', 0);

  }, [config, data, dimensions, animation, onClick]);

  // Interaction handler
  const handleHover = useCallback((event: any, data: ChartData, isEnter: boolean) => {
    if (!tooltipRef.current) return;

    const tooltip = d3.select(tooltipRef.current);

    if (isEnter) {
      tooltip
        .style('opacity', 1)
        .style('left', `${event.pageX + 10}px`)
        .style('top', `${event.pageY - 10}px`)
        .html(`
          <strong>${data.label}</strong><br/>
          Value: ${data.value}
        `);

      if (onHover) onHover(data);

      // Announce for screen readers
      if (accessibility.announceDataPoints) {
        const liveRegion = document.getElementById('chart-live-region');
        if (liveRegion) {
          liveRegion.textContent = `${data.label}: ${data.value}`;
        }
      }
    } else {
      tooltip.style('opacity', 0);
    }
  }, [onHover, accessibility]);

  // Effect for initial render and updates
  useEffect(() => {
    renderChart();
  }, [renderChart]);

  return (
    <div 
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
      role="figure"
      aria-label={accessibility.description || 'Bar chart visualization'}
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{ overflow: 'visible' }}
      />
      <div
        ref={tooltipRef}
        style={{
          position: 'fixed',
          opacity: 0,
          background: 'white',
          padding: '8px',
          borderRadius: '4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          pointerEvents: 'none',
          zIndex: 1000
        }}
      />
      <div
        id="chart-live-region"
        role="status"
        aria-live="polite"
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}
      />
    </div>
  );
};

export default BarChart;