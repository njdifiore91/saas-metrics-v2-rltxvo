import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import BenchmarkChart from '../../../../src/components/charts/BenchmarkChart';
import { BenchmarkChartData, ChartConfig } from '../../../../src/interfaces/chart.interface';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock ResizeObserver
const mockResizeObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));
window.ResizeObserver = mockResizeObserver;

// Mock sample data
const mockBenchmarkData: BenchmarkChartData = {
  metric: 'Annual Recurring Revenue',
  value: 1200000,
  percentile: 75,
  benchmarkValues: {
    p25: 800000,
    p50: 1000000,
    p75: 1200000,
    p90: 1500000
  },
  industry: 'SaaS',
  revenueRange: '$1M-$5M'
};

const mockChartConfig: ChartConfig = {
  width: 800,
  height: 400,
  margin: {
    top: 20,
    right: 20,
    bottom: 30,
    left: 40
  },
  type: 'benchmark',
  animate: true,
  responsive: true
};

describe('BenchmarkChart', () => {
  // Mock handlers
  const mockOnHover = jest.fn();
  const mockOnKeyboardNavigate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the chart container with correct ARIA attributes', () => {
      render(
        <BenchmarkChart
          data={mockBenchmarkData}
          config={mockChartConfig}
          onHover={mockOnHover}
          onKeyboardNavigate={mockOnKeyboardNavigate}
        />
      );

      const container = screen.getByRole('figure');
      expect(container).toHaveAttribute('aria-label', `Benchmark chart for ${mockBenchmarkData.metric}`);
    });

    it('should render SVG element with correct dimensions', () => {
      render(<BenchmarkChart data={mockBenchmarkData} config={mockChartConfig} />);
      
      const svg = screen.getByRole('img');
      expect(svg).toHaveAttribute('width', '100%');
      expect(svg).toHaveAttribute('height', mockChartConfig.height.toString());
    });

    it('should render benchmark ranges with correct ARIA labels', async () => {
      render(<BenchmarkChart data={mockBenchmarkData} config={mockChartConfig} />);
      
      await waitFor(() => {
        const ranges = screen.getAllByRole('graphics-symbol');
        expect(ranges).toHaveLength(7); // 3 ranges + 4 percentile markers
      });
    });

    it('should render company value marker', async () => {
      render(<BenchmarkChart data={mockBenchmarkData} config={mockChartConfig} />);
      
      await waitFor(() => {
        const marker = screen.getByRole('graphics-symbol', {
          name: `Company value: ${mockBenchmarkData.value}`
        });
        expect(marker).toBeInTheDocument();
      });
    });
  });

  describe('Interactions', () => {
    it('should call onHover when hovering over benchmark ranges', async () => {
      const user = userEvent.setup();
      render(
        <BenchmarkChart
          data={mockBenchmarkData}
          config={mockChartConfig}
          onHover={mockOnHover}
        />
      );

      const ranges = await screen.findAllByRole('graphics-symbol');
      await user.hover(ranges[0]);
      
      expect(mockOnHover).toHaveBeenCalled();
    });

    it('should handle keyboard navigation', () => {
      render(
        <BenchmarkChart
          data={mockBenchmarkData}
          config={mockChartConfig}
          onKeyboardNavigate={mockOnKeyboardNavigate}
        />
      );

      const svg = screen.getByRole('img');
      fireEvent.keyDown(svg, { key: 'ArrowLeft' });
      expect(mockOnKeyboardNavigate).toHaveBeenCalledWith('left');

      fireEvent.keyDown(svg, { key: 'ArrowRight' });
      expect(mockOnKeyboardNavigate).toHaveBeenCalledWith('right');
    });

    it('should show tooltip on hover', async () => {
      render(<BenchmarkChart data={mockBenchmarkData} config={mockChartConfig} />);
      
      const marker = await screen.findByRole('graphics-symbol', {
        name: `Company value: ${mockBenchmarkData.value}`
      });
      
      await userEvent.hover(marker);
      const tooltip = document.querySelector('.benchmark-tooltip');
      expect(tooltip).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <BenchmarkChart data={mockBenchmarkData} config={mockChartConfig} />
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should provide descriptive chart title and description', () => {
      render(<BenchmarkChart data={mockBenchmarkData} config={mockChartConfig} />);
      
      const svg = screen.getByRole('img');
      expect(svg).toHaveAttribute(
        'aria-label',
        `Interactive benchmark visualization for ${mockBenchmarkData.metric}`
      );
    });

    it('should maintain focus management', async () => {
      const user = userEvent.setup();
      render(<BenchmarkChart data={mockBenchmarkData} config={mockChartConfig} />);
      
      const svg = screen.getByRole('img');
      await user.tab();
      expect(svg).toHaveFocus();
    });
  });

  describe('Updates', () => {
    it('should update visualization when data changes', async () => {
      const { rerender } = render(
        <BenchmarkChart data={mockBenchmarkData} config={mockChartConfig} />
      );

      const updatedData = {
        ...mockBenchmarkData,
        value: 1300000,
        percentile: 80
      };

      rerender(<BenchmarkChart data={updatedData} config={mockChartConfig} />);

      await waitFor(() => {
        const marker = screen.getByRole('graphics-symbol', {
          name: `Company value: ${updatedData.value}`
        });
        expect(marker).toBeInTheDocument();
      });
    });

    it('should handle resize events', async () => {
      const { container } = render(
        <BenchmarkChart data={mockBenchmarkData} config={mockChartConfig} />
      );

      // Trigger resize observer
      const resizeCallback = mockResizeObserver.mock.calls[0][0];
      resizeCallback([{ contentRect: { width: 1000, height: 500 } }]);

      await waitFor(() => {
        const svg = container.querySelector('svg');
        expect(svg).toHaveAttribute('width', '100%');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing data gracefully', () => {
      const incompleteData = {
        ...mockBenchmarkData,
        benchmarkValues: {
          p25: null,
          p50: 1000000,
          p75: 1200000,
          p90: 1500000
        }
      };

      render(<BenchmarkChart data={incompleteData} config={mockChartConfig} />);
      
      // Should not crash and render basic structure
      expect(screen.getByRole('figure')).toBeInTheDocument();
    });

    it('should handle invalid configuration gracefully', () => {
      const invalidConfig = {
        ...mockChartConfig,
        height: -100 // Invalid height
      };

      render(<BenchmarkChart data={mockBenchmarkData} config={invalidConfig} />);
      
      // Should not crash and render with fallback dimensions
      expect(screen.getByRole('figure')).toBeInTheDocument();
    });
  });
});