import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { jest, describe, beforeEach, test, expect } from '@jest/globals';

// Component and hooks imports
import MetricComparison from '../../../../src/components/metrics/MetricComparison';
import { useBenchmark } from '../../../../src/hooks/useBenchmark';

// Mock the useBenchmark hook
jest.mock('../../../../src/hooks/useBenchmark');

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Test data constants
const mockMetric = {
  id: 'metric-001',
  name: 'Net Dollar Retention',
  description: 'Measures revenue retention including expansions',
  type: 'RETENTION',
  unit: 'PERCENTAGE',
  timeframe: 'ANNUAL',
  formula: '(End ARR / Start ARR) * 100',
  validationRules: []
};

const mockBenchmarkData = {
  id: 'benchmark-001',
  metricId: 'metric-001',
  revenueRangeId: 'revenue-001',
  p10Value: 85,
  p25Value: 95,
  p50Value: 105,
  p75Value: 115,
  p90Value: 125,
  source: 'Industry Data',
  collectedAt: new Date()
};

const mockComparison = {
  metric: mockMetric,
  benchmarkData: mockBenchmarkData,
  companyValue: 110,
  percentile: 65,
  revenueRange: {
    id: 'revenue-001',
    name: '$1M-$5M',
    minRevenue: 1000000,
    maxRevenue: 5000000
  }
};

describe('MetricComparison', () => {
  // Setup performance measurement
  let performanceTimer: number;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock useBenchmark implementation
    (useBenchmark as jest.Mock).mockReturnValue({
      compareToBenchmark: jest.fn().mockResolvedValue(mockComparison),
      isLoading: false,
      error: null
    });

    // Start performance timer
    performanceTimer = performance.now();
  });

  describe('Rendering States', () => {
    test('renders loading skeleton initially', async () => {
      (useBenchmark as jest.Mock).mockReturnValue({
        compareToBenchmark: jest.fn(),
        isLoading: true,
        error: null
      });

      render(
        <MetricComparison
          metric={mockMetric}
          companyValue={110}
          revenueRangeId="revenue-001"
        />
      );

      expect(screen.getByRole('region', { name: /loading metric comparison/i })).toBeInTheDocument();
      expect(screen.getByTestId('skeleton-loader')).toBeInTheDocument();
    });

    test('renders error state with retry button', async () => {
      const mockError = {
        code: 'DATA003',
        message: 'Failed to compare metrics'
      };

      (useBenchmark as jest.Mock).mockReturnValue({
        compareToBenchmark: jest.fn(),
        isLoading: false,
        error: mockError
      });

      render(
        <MetricComparison
          metric={mockMetric}
          companyValue={110}
          revenueRangeId="revenue-001"
        />
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(mockError.message)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    test('renders comparison results successfully', async () => {
      render(
        <MetricComparison
          metric={mockMetric}
          companyValue={110}
          revenueRangeId="revenue-001"
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('region', { name: new RegExp(mockMetric.name, 'i') })).toBeInTheDocument();
        expect(screen.getByText(`Your value: ${mockComparison.companyValue} ${mockMetric.unit}`)).toBeInTheDocument();
        expect(screen.getByText(new RegExp(`${Math.round(mockComparison.percentile)}th percentile`, 'i'))).toBeInTheDocument();
      });
    });
  });

  describe('Metric Comparison Functionality', () => {
    test('calls compareToBenchmark with correct parameters', async () => {
      const compareToBenchmarkMock = jest.fn().mockResolvedValue(mockComparison);
      (useBenchmark as jest.Mock).mockReturnValue({
        compareToBenchmark: compareToBenchmarkMock,
        isLoading: false,
        error: null
      });

      render(
        <MetricComparison
          metric={mockMetric}
          companyValue={110}
          revenueRangeId="revenue-001"
        />
      );

      await waitFor(() => {
        expect(compareToBenchmarkMock).toHaveBeenCalledWith(
          110,
          mockMetric.id,
          'revenue-001'
        );
      });
    });

    test('updates comparison when inputs change', async () => {
      const compareToBenchmarkMock = jest.fn().mockResolvedValue(mockComparison);
      (useBenchmark as jest.Mock).mockReturnValue({
        compareToBenchmark: compareToBenchmarkMock,
        isLoading: false,
        error: null
      });

      const { rerender } = render(
        <MetricComparison
          metric={mockMetric}
          companyValue={110}
          revenueRangeId="revenue-001"
        />
      );

      // Update props
      rerender(
        <MetricComparison
          metric={mockMetric}
          companyValue={120}
          revenueRangeId="revenue-001"
        />
      );

      await waitFor(() => {
        expect(compareToBenchmarkMock).toHaveBeenCalledTimes(2);
        expect(compareToBenchmarkMock).toHaveBeenLastCalledWith(
          120,
          mockMetric.id,
          'revenue-001'
        );
      });
    });
  });

  describe('Accessibility Compliance', () => {
    test('meets WCAG 2.1 AA standards', async () => {
      const { container } = render(
        <MetricComparison
          metric={mockMetric}
          companyValue={110}
          revenueRangeId="revenue-001"
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('supports keyboard navigation', async () => {
      render(
        <MetricComparison
          metric={mockMetric}
          companyValue={110}
          revenueRangeId="revenue-001"
        />
      );

      const chart = await screen.findByRole('img', { name: new RegExp(`Interactive benchmark visualization for ${mockMetric.name}`, 'i') });
      
      // Test keyboard focus
      chart.focus();
      expect(document.activeElement).toBe(chart);

      // Test keyboard interactions
      fireEvent.keyDown(chart, { key: 'ArrowRight' });
      fireEvent.keyDown(chart, { key: 'ArrowLeft' });
    });

    test('provides appropriate ARIA labels', async () => {
      render(
        <MetricComparison
          metric={mockMetric}
          companyValue={110}
          revenueRangeId="revenue-001"
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('region', { name: new RegExp(mockMetric.name, 'i') })).toBeInTheDocument();
        expect(screen.getByLabelText(new RegExp(`Your value: ${mockComparison.companyValue}`, 'i'))).toBeInTheDocument();
        expect(screen.getByLabelText(new RegExp(`${Math.round(mockComparison.percentile)}th percentile`, 'i'))).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    test('handles API errors gracefully', async () => {
      const mockError = {
        code: 'API001',
        message: 'API request failed'
      };

      (useBenchmark as jest.Mock).mockReturnValue({
        compareToBenchmark: jest.fn().mockRejectedValue(mockError),
        isLoading: false,
        error: mockError
      });

      render(
        <MetricComparison
          metric={mockMetric}
          companyValue={110}
          revenueRangeId="revenue-001"
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(mockError.message)).toBeInTheDocument();
      });
    });

    test('implements retry mechanism', async () => {
      const mockError = {
        code: 'SYS002',
        message: 'Service unavailable'
      };

      const compareToBenchmarkMock = jest.fn()
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce(mockComparison);

      (useBenchmark as jest.Mock).mockReturnValue({
        compareToBenchmark: compareToBenchmarkMock,
        isLoading: false,
        error: mockError
      });

      render(
        <MetricComparison
          metric={mockMetric}
          companyValue={110}
          revenueRangeId="revenue-001"
        />
      );

      const retryButton = await screen.findByRole('button', { name: /retry/i });
      await userEvent.click(retryButton);

      await waitFor(() => {
        expect(compareToBenchmarkMock).toHaveBeenCalledTimes(2);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });
  });

  describe('Performance', () => {
    test('renders within performance budget', async () => {
      render(
        <MetricComparison
          metric={mockMetric}
          companyValue={110}
          revenueRangeId="revenue-001"
        />
      );

      const renderTime = performance.now() - performanceTimer;
      expect(renderTime).toBeLessThan(200); // 200ms performance budget
    });

    test('debounces comparison updates', async () => {
      const compareToBenchmarkMock = jest.fn().mockResolvedValue(mockComparison);
      (useBenchmark as jest.Mock).mockReturnValue({
        compareToBenchmark: compareToBenchmarkMock,
        isLoading: false,
        error: null
      });

      const { rerender } = render(
        <MetricComparison
          metric={mockMetric}
          companyValue={110}
          revenueRangeId="revenue-001"
        />
      );

      // Rapid updates
      for (let i = 0; i < 5; i++) {
        rerender(
          <MetricComparison
            metric={mockMetric}
            companyValue={110 + i}
            revenueRangeId="revenue-001"
          />
        );
      }

      await waitFor(() => {
        expect(compareToBenchmarkMock).toHaveBeenCalledTimes(1);
      }, { timeout: 500 });
    });
  });
});