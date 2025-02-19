import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { describe, it, expect, beforeEach } from '@jest/globals';
import { MetricCard, MetricCardProps } from '../../src/components/dashboard/MetricCard';
import theme from '../../src/assets/styles/theme';
import { IMetricDefinition } from '../../src/interfaces/metric.interface';
import { MetricType, MetricUnit } from '../../src/types/metric.types';

// Helper function to render components with theme
const renderWithTheme = (ui: React.ReactNode) => {
  return render(
    <ThemeProvider theme={theme}>
      {ui}
    </ThemeProvider>
  );
};

// Mock metric data factory
const createMockMetric = (overrides?: Partial<IMetricDefinition>): IMetricDefinition => ({
  id: 'test-metric-id',
  name: 'Annual Recurring Revenue',
  description: 'Total yearly subscription revenue',
  type: MetricType.FINANCIAL,
  unit: MetricUnit.CURRENCY,
  timeframe: 'ANNUAL',
  formula: 'MRR * 12',
  validationRules: [],
  ...overrides
});

describe('MetricCard Component', () => {
  let defaultProps: MetricCardProps;

  beforeEach(() => {
    defaultProps = {
      metric: createMockMetric(),
      value: 1000000,
      previousValue: 800000,
      benchmarkValue: 950000,
      onClick: jest.fn(),
      ariaLabel: 'ARR metric card'
    };
  });

  describe('Visual Rendering', () => {
    it('renders with correct dimensions and styling', () => {
      const { container } = renderWithTheme(<MetricCard {...defaultProps} />);
      const card = container.firstChild as HTMLElement;
      
      expect(card).toHaveStyle({
        width: '300px',
        height: '200px'
      });
      expect(card).toHaveStyle({
        boxShadow: theme.shadows[1]
      });
    });

    it('displays metric name and value correctly', () => {
      renderWithTheme(<MetricCard {...defaultProps} />);
      
      expect(screen.getByText('Annual Recurring Revenue')).toBeInTheDocument();
      expect(screen.getByText('$1,000,000')).toBeInTheDocument();
    });

    it('shows appropriate trend indicator', () => {
      renderWithTheme(<MetricCard {...defaultProps} />);
      
      const trendValue = screen.getByText('25%');
      const trendIcon = screen.getByTestId('TrendingUpIcon');
      
      expect(trendValue).toHaveStyle({
        color: theme.palette.data.positive
      });
      expect(trendIcon).toBeInTheDocument();
    });

    it('maintains responsive layout on different screen sizes', () => {
      const { container } = renderWithTheme(<MetricCard {...defaultProps} />);
      const card = container.firstChild as HTMLElement;

      // Test mobile viewport
      window.innerWidth = 320;
      fireEvent(window, new Event('resize'));
      expect(card).toHaveStyle({
        width: '300px'
      });

      // Test desktop viewport
      window.innerWidth = 1024;
      fireEvent(window, new Event('resize'));
      expect(card).toHaveStyle({
        width: '300px'
      });
    });
  });

  describe('Accessibility', () => {
    it('includes proper ARIA labels', () => {
      renderWithTheme(<MetricCard {...defaultProps} />);
      
      const card = screen.getByRole('button');
      expect(card).toHaveAttribute('aria-label', 'ARR metric card');
      
      const trend = screen.getByLabelText('25% increase');
      expect(trend).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const onClick = jest.fn();
      renderWithTheme(<MetricCard {...defaultProps} onClick={onClick} />);
      
      const card = screen.getByRole('button');
      card.focus();
      expect(card).toHaveFocus();

      await userEvent.keyboard('{Enter}');
      expect(onClick).toHaveBeenCalled();

      await userEvent.keyboard(' ');
      expect(onClick).toHaveBeenCalledTimes(2);
    });

    it('announces changes to screen readers', () => {
      const { rerender } = renderWithTheme(<MetricCard {...defaultProps} />);
      
      const updatedProps = {
        ...defaultProps,
        value: 1200000,
        previousValue: 1000000
      };
      
      rerender(<MetricCard {...updatedProps} />);
      
      const newTrend = screen.getByLabelText('20% increase');
      expect(newTrend).toBeInTheDocument();
    });
  });

  describe('Data Formatting', () => {
    it('formats currency values correctly', () => {
      renderWithTheme(<MetricCard {...defaultProps} />);
      expect(screen.getByText('$1,000,000')).toBeInTheDocument();
    });

    it('displays percentages properly', () => {
      const percentageMetric = createMockMetric({
        unit: MetricUnit.PERCENTAGE,
        name: 'Gross Margin'
      });
      
      renderWithTheme(
        <MetricCard
          {...defaultProps}
          metric={percentageMetric}
          value={75.5}
          previousValue={70}
          benchmarkValue={72}
        />
      );
      
      expect(screen.getByText('75.5%')).toBeInTheDocument();
    });

    it('handles null/undefined values gracefully', () => {
      renderWithTheme(
        <MetricCard
          {...defaultProps}
          previousValue={0}
          benchmarkValue={0}
        />
      );
      
      expect(screen.getByText('$1,000,000')).toBeInTheDocument();
      expect(screen.getByText('0%')).toBeInTheDocument();
    });
  });

  describe('Interaction Handling', () => {
    it('handles click events correctly', async () => {
      const onClick = jest.fn();
      renderWithTheme(<MetricCard {...defaultProps} onClick={onClick} />);
      
      const card = screen.getByRole('button');
      await userEvent.click(card);
      
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('shows hover states', async () => {
      const { container } = renderWithTheme(<MetricCard {...defaultProps} />);
      const card = container.firstChild as HTMLElement;
      
      await userEvent.hover(card);
      expect(card).toHaveStyle({
        transform: 'translateY(-2px)'
      });
      
      await userEvent.unhover(card);
      expect(card).not.toHaveStyle({
        transform: 'translateY(-2px)'
      });
    });

    it('displays tooltip on hover', async () => {
      renderWithTheme(<MetricCard {...defaultProps} />);
      
      const title = screen.getByText('Annual Recurring Revenue');
      await userEvent.hover(title);
      
      expect(screen.getByText('Total yearly subscription revenue')).toBeInTheDocument();
    });
  });
});