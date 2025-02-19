import React, { memo, useRef, useEffect, useCallback, useMemo } from 'react';
import * as d3 from 'd3'; // v7.0.0
import useResizeObserver from 'use-resize-observer'; // v9.1.0
import { BenchmarkChartData, ChartConfig } from '../../interfaces/chart.interface';

interface BenchmarkChartProps {
  data: BenchmarkChartData;
  config: ChartConfig;
  onHover?: (value: number, percentile: number) => void;
  onKeyboardNavigate?: (direction: 'left' | 'right') => void;
}

const BenchmarkChart = memo(({ data, config, onHover, onKeyboardNavigate }: BenchmarkChartProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const { width: containerWidth = 600 } = useResizeObserver<HTMLDivElement>({ ref: svgRef });

  // Memoized chart dimensions
  const dimensions = useMemo(() => {
    const { margin } = config;
    return {
      width: containerWidth - margin.left - margin.right,
      height: config.height - margin.top - margin.bottom,
      margin
    };
  }, [containerWidth, config]);

  // Memoized scales
  const scales = useMemo(() => {
    const { width, height } = dimensions;
    const valueExtent = [
      Math.min(data.benchmarkValues.p25, data.value),
      Math.max(data.benchmarkValues.p90, data.value)
    ];

    return {
      x: d3.scaleLinear()
        .domain(valueExtent)
        .range([0, width])
        .nice(),
      y: d3.scaleLinear()
        .domain([0, 100])
        .range([height, 0])
    };
  }, [dimensions, data]);

  // Draw chart function
  const drawChart = useCallback(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const { margin, width, height } = dimensions;
    const { x } = scales;

    // Clear previous content
    svg.selectAll('*').remove();

    // Create chart group
    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Draw benchmark ranges
    const benchmarkGroup = g.append('g')
      .attr('class', 'benchmark-ranges')
      .attr('role', 'group')
      .attr('aria-label', 'Benchmark ranges');

    // Draw percentile bands
    const percentiles = [
      { start: data.benchmarkValues.p25, end: data.benchmarkValues.p50, label: '25th-50th' },
      { start: data.benchmarkValues.p50, end: data.benchmarkValues.p75, label: '50th-75th' },
      { start: data.benchmarkValues.p75, end: data.benchmarkValues.p90, label: '75th-90th' }
    ];

    percentiles.forEach(({ start, end, label }) => {
      benchmarkGroup
        .append('rect')
        .attr('x', x(start))
        .attr('y', 0)
        .attr('width', x(end) - x(start))
        .attr('height', height)
        .attr('fill', config.highContrast ? '#000' : '#e0e0e0')
        .attr('opacity', 0.2)
        .attr('role', 'graphics-symbol')
        .attr('aria-label', `${label} percentile range`);
    });

    // Draw company value marker
    const companyMarker = g.append('g')
      .attr('class', 'company-marker')
      .attr('role', 'graphics-symbol')
      .attr('aria-label', `Company value: ${data.value}`);

    companyMarker
      .append('line')
      .attr('x1', x(data.value))
      .attr('x2', x(data.value))
      .attr('y1', 0)
      .attr('y2', height)
      .attr('stroke', config.highContrast ? '#000' : '#ff4081')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '4,4');

    // Add axis
    const xAxis = d3.axisBottom(x)
      .ticks(5)
      .tickFormat(d => d3.format(',.0f')(d as number));

    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${height})`)
      .call(xAxis)
      .attr('role', 'graphics-document')
      .attr('aria-label', 'X axis');

    // Add labels for percentiles
    const percentileLabels = [
      { value: data.benchmarkValues.p25, label: 'P25' },
      { value: data.benchmarkValues.p50, label: 'P50' },
      { value: data.benchmarkValues.p75, label: 'P75' },
      { value: data.benchmarkValues.p90, label: 'P90' }
    ];

    percentileLabels.forEach(({ value, label }) => {
      g.append('text')
        .attr('x', x(value))
        .attr('y', height + 25)
        .attr('text-anchor', 'middle')
        .attr('fill', config.highContrast ? '#000' : '#666')
        .attr('font-size', '12px')
        .text(label)
        .attr('role', 'graphics-symbol')
        .attr('aria-label', `${label} marker`);
    });

  }, [data, dimensions, scales, config.highContrast]);

  // Initialize tooltip
  useEffect(() => {
    if (!tooltipRef.current) {
      const tooltip = d3.select('body')
        .append('div')
        .attr('class', 'benchmark-tooltip')
        .style('position', 'absolute')
        .style('visibility', 'hidden')
        .style('background', 'white')
        .style('padding', '8px')
        .style('border-radius', '4px')
        .style('box-shadow', '0 2px 4px rgba(0,0,0,0.1)');
      
      tooltipRef.current = tooltip.node() as HTMLDivElement;
    }

    return () => {
      if (tooltipRef.current) {
        d3.select(tooltipRef.current).remove();
      }
    };
  }, []);

  // Draw chart on data or dimension changes
  useEffect(() => {
    drawChart();
  }, [drawChart]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (onKeyboardNavigate) {
      switch (e.key) {
        case 'ArrowLeft':
          onKeyboardNavigate('left');
          break;
        case 'ArrowRight':
          onKeyboardNavigate('right');
          break;
      }
    }
  }, [onKeyboardNavigate]);

  return (
    <div
      className="benchmark-chart-container"
      role="figure"
      aria-label={`Benchmark chart for ${data.metric}`}
    >
      <svg
        ref={svgRef}
        width="100%"
        height={config.height}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        role="img"
        aria-label={`Interactive benchmark visualization for ${data.metric}`}
      >
        <title>{`Benchmark comparison for ${data.metric}`}</title>
        <desc>
          {`Visual representation of ${data.metric} benchmarks. 
          Your value: ${data.value} (${data.percentile}th percentile).
          Industry: ${data.industry}. Revenue Range: ${data.revenueRange}`}
        </desc>
      </svg>
    </div>
  );
});

BenchmarkChart.displayName = 'BenchmarkChart';

export default BenchmarkChart;