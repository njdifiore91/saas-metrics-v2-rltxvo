// @mui/material v5.0.0
// react v18.2.0
import React, { memo, useCallback } from 'react';
import { Typography, Box } from '@mui/material';
import Card from '../common/Card';
import BenchmarkChart from '../charts/BenchmarkChart';
import { IBenchmarkComparison } from '../../interfaces/benchmark.interface';
import { theme } from '../../assets/styles/theme';

// Props interface with accessibility and high contrast support
export interface BenchmarkCardProps {
  benchmarkData: IBenchmarkComparison;
  onClick?: () => void;
  className?: string;
  ariaLabel?: string;
  highContrastMode?: boolean;
}

/**
 * Formats percentile value for display with screen reader support
 */
const formatPercentile = (value: number): string => {
  const roundedValue = Math.round(value);
  return `${roundedValue}th percentile`;
};

/**
 * Determines color based on percentile performance with high contrast support
 */
const getPerformanceColor = (percentile: number, highContrastMode: boolean): string => {
  if (highContrastMode) {
    return percentile >= 75 ? '#000000' : '#333333';
  }

  if (percentile >= 75) return theme.palette.data.positive;
  if (percentile >= 50) return theme.palette.data.neutral;
  return theme.palette.data.negative;
};

/**
 * BenchmarkCard component displays benchmark comparison data with enhanced
 * accessibility and visualization features.
 */
const BenchmarkCard: React.FC<BenchmarkCardProps> = memo(({
  benchmarkData,
  onClick,
  className,
  ariaLabel,
  highContrastMode = false
}) => {
  const {
    metric,
    companyValue,
    percentile,
    benchmarkData: benchmarkValues,
    revenueRange
  } = benchmarkData;

  // Prepare chart data
  const chartData = {
    metric: metric.name,
    value: companyValue,
    percentile,
    benchmarkValues: {
      p25: benchmarkValues.p25Value,
      p50: benchmarkValues.p50Value,
      p75: benchmarkValues.p75Value,
      p90: benchmarkValues.p90Value
    },
    industry: 'All Industries', // Could be made dynamic if industry data is added
    revenueRange: revenueRange.name
  };

  // Chart configuration
  const chartConfig = {
    height: 120,
    margin: { top: 10, right: 20, bottom: 30, left: 20 },
    highContrast: highContrastMode
  };

  // Hover handler for chart interactions
  const handleChartHover = useCallback((value: number, hoverPercentile: number) => {
    // Implement hover logic if needed
  }, []);

  // Keyboard navigation handler
  const handleKeyboardNavigate = useCallback((direction: 'left' | 'right') => {
    // Implement keyboard navigation if needed
  }, []);

  const performanceColor = getPerformanceColor(percentile, highContrastMode);

  return (
    <Card
      onClick={onClick}
      className={className}
      elevation={2}
      ariaLabel={ariaLabel || `Benchmark card for ${metric.name}`}
      role="region"
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }}
      >
        {/* Metric Header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <Typography
            variant="h6"
            component="h3"
            sx={{ fontWeight: 600 }}
          >
            {metric.name}
          </Typography>
          <Typography
            variant="metric"
            sx={{ color: performanceColor }}
            aria-label={`Performance: ${formatPercentile(percentile)}`}
          >
            {formatPercentile(percentile)}
          </Typography>
        </Box>

        {/* Metric Value */}
        <Typography
          variant="metric"
          sx={{
            fontSize: '1.5rem',
            color: theme.palette.text.primary
          }}
          aria-label={`Current value: ${companyValue}`}
        >
          {metric.unit === 'PERCENTAGE' ? `${companyValue}%` : companyValue}
        </Typography>

        {/* Benchmark Chart */}
        <Box
          sx={{
            mt: 2,
            height: chartConfig.height,
            '&:focus-visible': {
              outline: `2px solid ${theme.palette.primary.main}`,
              outlineOffset: '2px'
            }
          }}
        >
          <BenchmarkChart
            data={chartData}
            config={chartConfig}
            onHover={handleChartHover}
            onKeyboardNavigate={handleKeyboardNavigate}
          />
        </Box>

        {/* Revenue Range Context */}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 1 }}
          aria-label={`Revenue range: ${revenueRange.name}`}
        >
          {revenueRange.name}
        </Typography>
      </Box>
    </Card>
  );
});

BenchmarkCard.displayName = 'BenchmarkCard';

export default BenchmarkCard;