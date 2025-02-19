import React, { useRef, useEffect, useMemo, useCallback, memo } from 'react';
import * as d3 from 'd3'; // v7.0.0
import { debounce } from 'lodash'; // v4.17.21
import { ChartConfig, ChartData } from '../../interfaces/chart.interface';

interface AreaChartProps {
  config: ChartConfig;
  data: ChartData[];
  eventHandlers?: {
    onHover?: (event: MouseEvent, data: ChartData) => void;
    onClick?: (event: MouseEvent, data: ChartData) => void;
    onBrush?: (selection: [Date, Date]) => void;
  };
}

const AreaChart: React.FC<AreaChartProps> = memo(({ config, data, eventHandlers }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Memoized calculations for performance
  const dimensions = useMemo(() => {
    const { width, height, margin } = config;
    return {
      width,
      height,
      innerWidth: width - margin.left - margin.right,
      innerHeight: height - margin.top - margin.bottom,
    };
  }, [config]);

  // Memoized scales for performance
  const scales = useMemo(() => {
    const xScale = d3.scaleTime()
      .domain(d3.extent(data, d => d.timestamp) as [Date, Date])
      .range([0, dimensions.innerWidth]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.value) as number])
      .range([dimensions.innerHeight, 0])
      .nice();

    return { xScale, yScale };
  }, [data, dimensions]);

  // Memoized area generator
  const areaGenerator = useMemo(() => {
    return d3.area<ChartData>()
      .x(d => scales.xScale(d.timestamp))
      .y0(dimensions.innerHeight)
      .y1(d => scales.yScale(d.value))
      .curve(d3.curveMonotoneX);
  }, [scales, dimensions]);

  // Tooltip handler with debouncing for performance
  const handleMouseMove = useCallback(
    debounce((event: MouseEvent) => {
      if (!svgRef.current || !tooltipRef.current) return;

      const [xPos, yPos] = d3.pointer(event, svgRef.current);
      const xDate = scales.xScale.invert(xPos - config.margin.left);
      
      const bisect = d3.bisector<ChartData, Date>(d => d.timestamp).left;
      const index = bisect(data, xDate);
      const dataPoint = data[index];

      if (dataPoint) {
        const tooltip = d3.select(tooltipRef.current);
        tooltip
          .style('opacity', 1)
          .style('left', `${xPos + 10}px`)
          .style('top', `${yPos - 10}px`)
          .html(`
            <strong>${dataPoint.label}</strong><br/>
            Value: ${dataPoint.value}<br/>
            Date: ${dataPoint.timestamp.toLocaleDateString()}
          `);

        eventHandlers?.onHover?.(event, dataPoint);
      }
    }, 50),
    [data, scales, config.margin, eventHandlers]
  );

  // Chart rendering effect
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const g = svg.select<SVGGElement>('.chart-content');

    // Clear previous content
    g.selectAll('*').remove();

    // Add area path
    g.append('path')
      .datum(data)
      .attr('class', 'area')
      .attr('d', areaGenerator)
      .attr('fill', 'url(#area-gradient)')
      .attr('opacity', 0.7)
      .attr('role', 'img')
      .attr('aria-label', 'Area chart showing trend over time');

    // Add axes
    const xAxis = g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${dimensions.innerHeight})`)
      .call(d3.axisBottom(scales.xScale))
      .attr('aria-label', 'Time axis');

    const yAxis = g.append('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(scales.yScale))
      .attr('aria-label', 'Value axis');

    // Add grid lines for better readability
    g.append('g')
      .attr('class', 'grid-lines')
      .selectAll('line')
      .data(scales.yScale.ticks())
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', dimensions.innerWidth)
      .attr('y1', d => scales.yScale(d))
      .attr('y2', d => scales.yScale(d))
      .attr('stroke', '#e0e0e0')
      .attr('stroke-dasharray', '2,2');

    // Add interaction layer
    g.append('rect')
      .attr('class', 'interaction-layer')
      .attr('width', dimensions.innerWidth)
      .attr('height', dimensions.innerHeight)
      .attr('opacity', 0)
      .on('mousemove', handleMouseMove)
      .on('click', (event: MouseEvent) => {
        const [xPos] = d3.pointer(event, svgRef.current);
        const xDate = scales.xScale.invert(xPos - config.margin.left);
        const bisect = d3.bisector<ChartData, Date>(d => d.timestamp).left;
        const index = bisect(data, xDate);
        eventHandlers?.onClick?.(event, data[index]);
      });

  }, [data, dimensions, scales, areaGenerator, handleMouseMove, eventHandlers, config.margin.left]);

  // Resize observer effect
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(debounce(() => {
      // Implement responsive behavior here
    }, 250));

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="area-chart-container" role="figure">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        aria-label="Area chart visualization"
      >
        <defs>
          <linearGradient id="area-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#46608C" stopOpacity={0.8} />
            <stop offset="100%" stopColor="#46608C" stopOpacity={0.2} />
          </linearGradient>
        </defs>
        <g
          className="chart-content"
          transform={`translate(${config.margin.left},${config.margin.top})`}
        />
      </svg>
      <div
        ref={tooltipRef}
        className="chart-tooltip"
        role="tooltip"
        aria-live="polite"
        style={{
          position: 'absolute',
          opacity: 0,
          background: 'white',
          padding: '8px',
          borderRadius: '4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
});

AreaChart.displayName = 'AreaChart';

export default AreaChart;