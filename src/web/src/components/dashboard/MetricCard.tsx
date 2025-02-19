import React, { useMemo, useCallback } from 'react';
import { styled } from '@mui/material/styles';
import { TrendingUp, TrendingDown } from '@mui/icons-material';
import Card from '../common/Card';
import Tooltip from '../common/Tooltip';
import { IMetricDefinition } from '../../interfaces/metric.interface';

// Props interface for the MetricCard component
export interface MetricCardProps {
  metric: IMetricDefinition;
  value: number;
  previousValue: number;
  benchmarkValue: number;
  onClick?: () => void;
  ariaLabel?: string;
}

// Styled components with theme integration
const StyledMetricCard = styled(Card)(({ theme }) => ({
  width: 300,
  height: 200,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  padding: theme.spacing(2),
  transition: 'transform 0.2s ease-in-out',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows[4]
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px'
  }
}));

const MetricHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: theme.spacing(2)
}));

const MetricTitle = styled('h3')(({ theme }) => ({
  margin: 0,
  fontSize: theme.typography.h6.fontSize,
  fontWeight: theme.typography.fontWeightMedium,
  color: theme.palette.text.primary
}));

const MetricValue = styled('div')(({ theme }) => ({
  fontFamily: theme.typography.fontFamilyMetrics,
  fontSize: theme.typography.h3.fontSize,
  fontWeight: 'bold',
  color: theme.palette.text.primary,
  textAlign: 'center',
  margin: `${theme.spacing(2)} 0`
}));

const TrendIndicator = styled('div')<{ trend: number }>(({ theme, trend }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  color: trend > 0 ? theme.palette.data.positive : theme.palette.data.negative,
  fontWeight: 500,
  fontSize: theme.typography.body2.fontSize
}));

const BenchmarkComparison = styled('div')(({ theme }) => ({
  fontSize: theme.typography.body2.fontSize,
  color: theme.palette.text.secondary,
  textAlign: 'center'
}));

// Memoized helper functions
const calculateTrend = (currentValue: number, previousValue: number): number => {
  if (!previousValue) return 0;
  return Number((((currentValue - previousValue) / previousValue) * 100).toFixed(2));
};

const formatMetricValue = (value: number, unit: MetricUnit): string => {
  switch (unit) {
    case MetricUnit.PERCENTAGE:
      return `${value.toFixed(1)}%`;
    case MetricUnit.CURRENCY:
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(value);
    case MetricUnit.RATIO:
      return value.toFixed(2);
    case MetricUnit.MONTHS:
      return `${value.toFixed(1)} mo`;
    default:
      return value.toString();
  }
};

const getBenchmarkComparison = (value: number, benchmark: number): string => {
  const diff = ((value - benchmark) / benchmark) * 100;
  return diff > 0 
    ? `${diff.toFixed(1)}% above benchmark`
    : `${Math.abs(diff).toFixed(1)}% below benchmark`;
};

export const MetricCard: React.FC<MetricCardProps> = React.memo(({
  metric,
  value,
  previousValue,
  benchmarkValue,
  onClick,
  ariaLabel
}) => {
  // Memoized calculations
  const trend = useMemo(() => 
    calculateTrend(value, previousValue), 
    [value, previousValue]
  );

  const formattedValue = useMemo(() => 
    formatMetricValue(value, metric.unit),
    [value, metric.unit]
  );

  const benchmarkComparison = useMemo(() => 
    getBenchmarkComparison(value, benchmarkValue),
    [value, benchmarkValue]
  );

  // Event handlers
  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (onClick && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onClick();
    }
  }, [onClick]);

  return (
    <StyledMetricCard
      onClick={onClick}
      role={onClick ? 'button' : 'article'}
      tabIndex={onClick ? 0 : undefined}
      onKeyPress={handleKeyPress}
      aria-label={ariaLabel || `${metric.name} metric card`}
    >
      <MetricHeader>
        <Tooltip
          content={metric.description}
          placement="top"
          ariaLabel={`${metric.name} description`}
        >
          <MetricTitle>{metric.name}</MetricTitle>
        </Tooltip>
      </MetricHeader>

      <MetricValue>
        {formattedValue}
      </MetricValue>

      <TrendIndicator trend={trend}>
        {trend > 0 ? <TrendingUp /> : <TrendingDown />}
        <span aria-label={`${Math.abs(trend)}% ${trend > 0 ? 'increase' : 'decrease'}`}>
          {Math.abs(trend)}%
        </span>
      </TrendIndicator>

      <Tooltip
        content={`Industry benchmark: ${formatMetricValue(benchmarkValue, metric.unit)}`}
        placement="bottom"
        ariaLabel="Benchmark comparison"
      >
        <BenchmarkComparison>
          {benchmarkComparison}
        </BenchmarkComparison>
      </Tooltip>
    </StyledMetricCard>
  );
});

MetricCard.displayName = 'MetricCard';

export default MetricCard;