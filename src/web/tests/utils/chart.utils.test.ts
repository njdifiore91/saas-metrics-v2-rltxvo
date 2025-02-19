// External imports
import * as d3 from 'd3'; // v7.0.0
import '@testing-library/jest-dom'; // v5.16.0
import { performance } from 'jest-performance'; // v1.0.0

// Internal imports
import { 
  calculateChartDimensions, 
  createChartScales, 
  createChartTooltip 
} from '../../src/utils/chart.utils';
import { ChartType } from '../../src/types/chart.types';
import { CHART_COLORS, CHART_DIMENSIONS } from '../../src/constants/chart.constants';

describe('Chart Utilities - Accessibility and Performance Tests', () => {
  // Setup performance measurement
  beforeEach(() => {
    performance.mark('start');
  });

  afterEach(() => {
    performance.mark('end');
    const measure = performance.measure('test', 'start', 'end');
    expect(measure.duration).toBeLessThan(200); // Performance requirement: <200ms
  });

  describe('calculateChartDimensions', () => {
    test('should respect minimum accessible dimensions', () => {
      const config = {
        width: 100, // Below minimum
        height: 100, // Below minimum
        margin: { top: 20, right: 20, bottom: 30, left: 40 },
        type: ChartType.BAR,
        animate: true,
        responsive: true
      };

      const dimensions = calculateChartDimensions(config);

      expect(dimensions.width).toBeGreaterThanOrEqual(parseInt(CHART_DIMENSIONS.MIN_WIDTH));
      expect(dimensions.height).toBeGreaterThanOrEqual(parseInt(CHART_DIMENSIONS.MIN_HEIGHT));
    });

    test('should calculate correct inner dimensions for all breakpoints', () => {
      const breakpoints = Object.values(CHART_DIMENSIONS.BREAKPOINTS);
      
      breakpoints.forEach(breakpoint => {
        const config = {
          width: parseInt(breakpoint),
          height: Math.floor(parseInt(breakpoint) / 2),
          margin: { top: 20, right: 20, bottom: 30, left: 40 },
          type: ChartType.BAR,
          animate: true,
          responsive: true
        };

        const dimensions = calculateChartDimensions(config);
        
        expect(dimensions.innerWidth).toBe(config.width - config.margin.left - config.margin.right);
        expect(dimensions.innerHeight).toBe(config.height - config.margin.top - config.margin.bottom);
      });
    });

    test('should memoize calculations for performance', () => {
      const config = {
        width: 800,
        height: 400,
        margin: { top: 20, right: 20, bottom: 30, left: 40 },
        type: ChartType.BAR,
        animate: true,
        responsive: true
      };

      const firstCall = calculateChartDimensions(config);
      const secondCall = calculateChartDimensions(config);
      
      expect(firstCall).toBe(secondCall); // Same reference due to memoization
    });
  });

  describe('createChartScales', () => {
    const mockData = [
      { value: 100, label: 'A' },
      { value: 200, label: 'B' },
      { value: 300, label: 'C' }
    ];

    const dimensions = {
      innerWidth: 760,
      innerHeight: 350
    };

    test('should create accessible color scales with WCAG compliant contrast', () => {
      const { colorScale } = createChartScales(ChartType.BAR, mockData, dimensions);
      
      const colors = mockData.map(d => colorScale(d.label));
      
      // Test color contrast ratios meet WCAG 2.1 AA standard (4.5:1)
      colors.forEach(color => {
        const contrastRatio = getContrastRatio(color, '#FFFFFF');
        expect(contrastRatio).toBeGreaterThanOrEqual(4.5);
      });
    });

    test('should create appropriate scales for BAR charts', () => {
      const { xScale, yScale } = createChartScales(ChartType.BAR, mockData, dimensions);
      
      expect(xScale.bandwidth).toBeDefined(); // Band scale for categorical data
      expect(yScale.domain()[0]).toBe(0);
      expect(yScale.domain()[1]).toBe(300);
    });

    test('should create appropriate scales for LINE charts', () => {
      const { xScale, yScale } = createChartScales(ChartType.LINE, mockData, dimensions);
      
      expect(xScale.padding).toBeDefined(); // Point scale for line charts
      expect(yScale.domain()[0]).toBe(0);
      expect(yScale.domain()[1]).toBe(300);
    });

    test('should create appropriate scales for BENCHMARK charts', () => {
      const { xScale, yScale } = createChartScales(ChartType.BENCHMARK, mockData, dimensions);
      
      expect(xScale.domain()).toEqual([0, 100]); // Percentile scale
      expect(yScale.domain()[0]).toBe(0);
      expect(yScale.domain()[1]).toBe(300);
    });

    test('should handle empty or invalid data gracefully', () => {
      expect(() => {
        createChartScales(ChartType.BAR, [], dimensions);
      }).not.toThrow();
    });
  });

  describe('createChartTooltip', () => {
    let container: HTMLElement;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    afterEach(() => {
      document.body.removeChild(container);
    });

    test('should create accessible tooltip with ARIA attributes', () => {
      const tooltip = createChartTooltip(container, {
        announceToScreenReader: true,
        highContrastMode: false,
        reducedMotion: false
      });

      const tooltipElement = tooltip.node as HTMLElement;
      
      expect(tooltipElement).toHaveAttribute('role', 'tooltip');
      expect(tooltipElement).toHaveAttribute('aria-hidden', 'true');
    });

    test('should support keyboard navigation', () => {
      const tooltip = createChartTooltip(container, {
        announceToScreenReader: true,
        highContrastMode: false,
        reducedMotion: false
      });

      expect(container).toHaveAttribute('tabindex', '0');
      
      // Test Escape key handling
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      container.dispatchEvent(escapeEvent);
      
      expect(tooltip.node).toHaveStyle({ opacity: '0' });
    });

    test('should support high contrast mode', () => {
      const tooltip = createChartTooltip(container, {
        announceToScreenReader: true,
        highContrastMode: true,
        reducedMotion: false
      });

      expect(tooltip.node).toHaveStyle({
        background: '#000000',
        color: '#FFFFFF'
      });
    });

    test('should create screen reader announcements when enabled', () => {
      const tooltip = createChartTooltip(container, {
        announceToScreenReader: true,
        highContrastMode: false,
        reducedMotion: false
      });

      const mockData = { label: 'Test', value: 100 };
      const mockEvent = new MouseEvent('mousemove');
      
      tooltip.show(mockEvent, mockData);
      
      const liveRegion = document.getElementById('chart-live-region');
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
      expect(liveRegion?.textContent).toBe('Test: 100');
    });
  });
});

// Helper function to calculate color contrast ratio
function getContrastRatio(color1: string, color2: string): number {
  const getLuminance = (color: string) => {
    const rgb = d3.color(color)!;
    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const l1 = getLuminance(color1);
  const l2 = getLuminance(color2);
  const brightest = Math.max(l1, l2);
  const darkest = Math.min(l1, l2);
  return (brightest + 0.05) / (darkest + 0.05);
}