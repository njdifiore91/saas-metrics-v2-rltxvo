import React, { useState, useCallback, useEffect } from 'react';
import { Box, Typography, Grid } from '@mui/material'; // v5.0.0
import MainLayout from '../components/layout/MainLayout';
import MetricComparison from '../components/metrics/MetricComparison';
import CompanyMetricsForm from '../components/forms/CompanyMetricsForm';
import { useMetrics } from '../hooks/useMetrics';
import { IMetricDefinition } from '../interfaces/metric.interface';
import { IBenchmarkComparison } from '../interfaces/benchmark.interface';
import ErrorBoundary from '../components/common/ErrorBoundary';

interface ComparisonPageState {
  selectedMetric: IMetricDefinition | null;
  companyValue: number | null;
  revenueRangeId: string;
  isLoading: boolean;
  error: Error | null;
}

const ComparisonPage: React.FC = () => {
  // State management
  const [state, setState] = useState<ComparisonPageState>({
    selectedMetric: null,
    companyValue: null,
    revenueRangeId: '',
    isLoading: false,
    error: null
  });

  // Custom hooks
  const { metricDefinitions, isLoading, error } = useMetrics('');

  // Handle metric submission
  const handleMetricSubmit = useCallback(async (metrics: Record<string, number>) => {
    try {
      setState(prev => ({
        ...prev,
        isLoading: true,
        error: null
      }));

      const [[metricId, value]] = Object.entries(metrics);
      const selectedMetric = metricDefinitions.find(m => m.id === metricId);

      if (!selectedMetric) {
        throw new Error('Selected metric not found');
      }

      setState(prev => ({
        ...prev,
        selectedMetric,
        companyValue: value,
        isLoading: false
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err as Error,
        isLoading: false
      }));
    }
  }, [metricDefinitions]);

  // Handle comparison completion
  const handleComparisonComplete = useCallback((comparison: IBenchmarkComparison) => {
    setState(prev => ({
      ...prev,
      revenueRangeId: comparison.revenueRange.id,
      isLoading: false
    }));
  }, []);

  // Handle error
  const handleError = useCallback((error: Error) => {
    setState(prev => ({
      ...prev,
      error,
      isLoading: false
    }));
  }, []);

  // Reset state when metric definitions change
  useEffect(() => {
    setState(prev => ({
      ...prev,
      selectedMetric: null,
      companyValue: null
    }));
  }, [metricDefinitions]);

  return (
    <MainLayout>
      <ErrorBoundary>
        <Box
          component="main"
          role="main"
          aria-label="Metric Comparison"
          sx={{ p: 3 }}
        >
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            sx={{ mb: 4 }}
          >
            Compare Your Metrics
          </Typography>

          <Grid container spacing={4}>
            <Grid item xs={12} md={6}>
              <CompanyMetricsForm
                companyId=""
                onSubmitSuccess={handleMetricSubmit}
                onSubmitError={handleError}
                onValidationChange={(isValid) => {
                  setState(prev => ({
                    ...prev,
                    error: isValid ? null : new Error('Validation failed')
                  }));
                }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              {state.selectedMetric && state.companyValue !== null && (
                <MetricComparison
                  metric={state.selectedMetric}
                  companyValue={state.companyValue}
                  revenueRangeId={state.revenueRangeId}
                  onComparisonComplete={handleComparisonComplete}
                  onError={handleError}
                />
              )}
            </Grid>
          </Grid>

          {isLoading && (
            <Box
              role="status"
              aria-label="Loading comparison data"
              sx={{ mt: 2 }}
            >
              <Typography>Loading comparison data...</Typography>
            </Box>
          )}

          {error && (
            <Box
              role="alert"
              aria-live="polite"
              sx={{ mt: 2, color: 'error.main' }}
            >
              <Typography color="error">
                Error: {error.message}
              </Typography>
            </Box>
          )}
        </Box>
      </ErrorBoundary>
    </MainLayout>
  );
};

export default ComparisonPage;