import React, { memo, useCallback, useEffect } from 'react';
import { Grid, Typography, Skeleton } from '@mui/material'; // v5.0.0
import Card from '../common/Card';
import { useMetrics } from '../../hooks/useMetrics';
import { IMetricDefinition } from '../../interfaces/metric.interface';
import { MetricUnit, MetricType } from '../../types/metric.types';

// Props interface for QuickStats component
export interface QuickStatsProps {
  companyId: string;
  className?: string;
  onError?: (error: Error) => void;
}

// Utility function to format metric values with proper units
const formatMetricValue = (value: number | null, unit: MetricUnit, format?: string): string => {
  if (value === null || isNaN(value)) return '—';

  switch (unit) {
    case MetricUnit.CURRENCY:
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: 'compact',
        maximumFractionDigits: 1
      }).format(value);

    case MetricUnit.PERCENTAGE:
      return `${value.toFixed(1)}%`;

    case MetricUnit.RATIO:
      return value.toFixed(2);

    case MetricUnit.MONTHS:
      return `${value.toFixed(1)} mo`;

    default:
      return value.toString();
  }
};

// Quick stats metric configuration
const QUICK_STATS_CONFIG = [
  {
    type: MetricType.FINANCIAL,
    name: 'Annual Recurring Revenue',
    unit: MetricUnit.CURRENCY,
    id: 'arr'
  },
  {
    type: MetricType.FINANCIAL,
    name: 'Growth Rate',
    unit: MetricUnit.PERCENTAGE,
    id: 'growth_rate'
  },
  {
    type: MetricType.RETENTION,
    name: 'Net Dollar Retention',
    unit: MetricUnit.PERCENTAGE,
    id: 'ndr'
  },
  {
    type: MetricType.EFFICIENCY,
    name: 'CAC Payback Period',
    unit: MetricUnit.MONTHS,
    id: 'cac_payback'
  }
];

const QuickStats: React.FC<QuickStatsProps> = memo(({ companyId, className, onError }) => {
  // Fetch metrics data using the enhanced useMetrics hook
  const {
    metricDefinitions,
    companyMetrics,
    isLoading,
    error,
    calculateMetrics,
    validateMetrics
  } = useMetrics(companyId);

  // Handle metric calculation and validation
  const processMetrics = useCallback(async () => {
    if (!metricDefinitions.length) return;

    try {
      // Validate metrics before calculation
      const metricsToValidate = QUICK_STATS_CONFIG.map(stat => ({
        metricId: stat.id,
        value: companyMetrics[stat.id] || 0
      }));

      const validationResults = await validateMetrics(metricsToValidate);
      const hasErrors = Object.values(validationResults).some(result => !result.isValid);

      if (hasErrors) {
        throw new Error('One or more metrics failed validation');
      }

      // Calculate metrics
      await calculateMetrics(metricsToValidate);
    } catch (err) {
      onError?.(err as Error);
    }
  }, [metricDefinitions, companyMetrics, calculateMetrics, validateMetrics, onError]);

  // Process metrics when definitions are loaded
  useEffect(() => {
    if (metricDefinitions.length > 0) {
      processMetrics();
    }
  }, [metricDefinitions, processMetrics]);

  // Error handling
  useEffect(() => {
    if (error) {
      onError?.(new Error(error.message));
    }
  }, [error, onError]);

  // Render loading skeleton
  if (isLoading) {
    return (
      <Grid container spacing={3} className={className}>
        {QUICK_STATS_CONFIG.map((stat) => (
          <Grid item xs={12} sm={6} md={3} key={stat.id}>
            <Card>
              <Skeleton variant="text" width="60%" height={24} />
              <Skeleton variant="text" width="80%" height={32} />
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  }

  return (
    <Grid container spacing={3} className={className}>
      {QUICK_STATS_CONFIG.map((stat) => {
        const metricDef = metricDefinitions.find(
          (def: IMetricDefinition) => def.id === stat.id
        );
        const value = companyMetrics[stat.id];

        return (
          <Grid item xs={12} sm={6} md={3} key={stat.id}>
            <Card>
              <Typography
                variant="body2"
                color="textSecondary"
                gutterBottom
                sx={{ fontWeight: 500 }}
              >
                {stat.name}
              </Typography>
              <Typography
                variant="metric"
                color={value < 0 ? 'error.main' : 'text.primary'}
                sx={{
                  fontFamily: 'theme.typography.fontFamilyMetrics',
                  fontSize: '1.5rem',
                  fontWeight: 600
                }}
              >
                {formatMetricValue(value, stat.unit)}
              </Typography>
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );
});

QuickStats.displayName = 'QuickStats';

export default QuickStats;