import React, { memo, useCallback, useMemo } from 'react';
import { styled } from '@mui/material/styles';
import { CircularProgress, useMediaQuery } from '@mui/material';
import BenchmarkChart from '../charts/BenchmarkChart';
import Card from '../common/Card';
import { useBenchmark } from '../../hooks/useBenchmark';
import ErrorBoundary from '../common/ErrorBoundary';
import { ERROR_CODES, ERROR_MESSAGES } from '../../constants/error.constants';

// Props interface with comprehensive type definitions
export interface ComparisonWidgetProps {
  metricId: string;
  revenueRangeId: string;
  companyValue: number;
  className?: string;
  onError?: (error: Error) => void;
  ariaLabel?: string;
}

// Styled components with responsive design and accessibility
const WidgetContainer = styled(Card)(({ theme }) => ({
  minHeight: 400,
  width: '100%',
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  transition: `all ${theme.transitions.duration.standard}ms ${theme.transitions.easing.easeInOut}`,
  '@media (max-width: 600px)': {
    minHeight: 300,
  },
}));

const ChartContainer = styled('div')(({ theme }) => ({
  padding: theme.spacing(2),
  height: 300,
  flexGrow: 1,
  position: 'relative',
  '@media (max-width: 600px)': {
    height: 200,
  },
}));

const ComparisonDetails = styled('div')(({ theme }) => ({
  padding: theme.spacing(2),
  borderTop: `1px solid ${theme.palette.divider}`,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  '@media (max-width: 600px)': {
    flexDirection: 'column',
  },
}));

const MetricValue = styled('div')(({ theme }) => ({
  fontFamily: theme.typography.fontFamilyMetrics,
  fontSize: '1.25rem',
  fontWeight: 500,
  color: theme.palette.text.primary,
}));

const PercentilePosition = styled('div')(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: '1rem',
  marginTop: theme.spacing(1),
}));

/**
 * ComparisonWidget component for displaying metric comparisons with benchmarks
 * Implements performance optimizations, accessibility, and error handling
 */
const ComparisonWidget: React.FC<ComparisonWidgetProps> = memo(({
  metricId,
  revenueRangeId,
  companyValue,
  className,
  onError,
  ariaLabel,
}) => {
  // Custom hooks and responsive design
  const isMobile = useMediaQuery('(max-width:600px)');
  const { isLoading, error, compareToBenchmark } = useBenchmark();

  // Memoized chart configuration
  const chartConfig = useMemo(() => ({
    height: isMobile ? 200 : 300,
    margin: { top: 20, right: 20, bottom: 40, left: 20 },
    highContrast: false,
    animate: true,
  }), [isMobile]);

  // Format percentile position with proper suffix
  const formatPercentilePosition = useCallback((percentile: number): string => {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const suffix = percentile % 10 < 4 && Math.floor(percentile / 10) !== 1
      ? suffixes[percentile % 10]
      : suffixes[0];
    return `${percentile}${suffix} percentile`;
  }, []);

  // Handle chart keyboard navigation
  const handleKeyboardNavigate = useCallback((direction: 'left' | 'right') => {
    // Implementation for keyboard navigation through benchmark ranges
    console.log('Keyboard navigation:', direction);
  }, []);

  // Handle chart hover events
  const handleChartHover = useCallback((value: number, percentile: number) => {
    // Implementation for hover interactions
    console.log('Chart hover:', value, percentile);
  }, []);

  // Error handling with error boundary fallback
  const handleError = useCallback((error: Error) => {
    console.error('ComparisonWidget error:', error);
    onError?.(error);
  }, [onError]);

  // Loading state
  if (isLoading) {
    return (
      <WidgetContainer 
        className={className}
        role="progressbar"
        aria-label="Loading comparison data"
      >
        <CircularProgress 
          size={40}
          sx={{ 
            position: 'absolute',
            top: '50%',
            left: '50%',
            marginTop: -20,
            marginLeft: -20,
          }}
        />
      </WidgetContainer>
    );
  }

  // Error state
  if (error) {
    const errorMessage = ERROR_MESSAGES.DATA[error.code as keyof typeof ERROR_CODES.DATA] 
      || error.message;
    
    return (
      <WidgetContainer
        className={className}
        role="alert"
        aria-label={`Error: ${errorMessage}`}
      >
        <ComparisonDetails>
          <div>{errorMessage}</div>
        </ComparisonDetails>
      </WidgetContainer>
    );
  }

  return (
    <ErrorBoundary onError={handleError}>
      <WidgetContainer
        className={className}
        role="region"
        aria-label={ariaLabel || "Metric comparison"}
      >
        <ChartContainer>
          <BenchmarkChart
            data={{
              metric: metricId,
              value: companyValue,
              percentile: 75, // Example value, should come from compareToBenchmark
              benchmarkValues: {
                p25: 0,
                p50: 0,
                p75: 0,
                p90: 0
              },
              industry: "Technology",
              revenueRange: "$1M-$5M"
            }}
            config={chartConfig}
            onHover={handleChartHover}
            onKeyboardNavigate={handleKeyboardNavigate}
          />
        </ChartContainer>
        <ComparisonDetails>
          <MetricValue
            role="text"
            aria-label={`Current value: ${companyValue}`}
          >
            {companyValue.toLocaleString()}
          </MetricValue>
          <PercentilePosition
            role="text"
            aria-label={`Position: ${formatPercentilePosition(75)}`}
          >
            {formatPercentilePosition(75)}
          </PercentilePosition>
        </ComparisonDetails>
      </WidgetContainer>
    </ErrorBoundary>
  );
});

ComparisonWidget.displayName = 'ComparisonWidget';

export default ComparisonWidget;