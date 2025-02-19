import React, { useState, useCallback, useEffect } from 'react';
import { Container, Grid, Typography, Skeleton } from '@mui/material'; // v5.0.0
import { useQueryClient } from 'react-query'; // v4.0.0

// Internal imports
import BenchmarkForm from '../components/forms/BenchmarkForm';
import MetricComparison from '../components/metrics/MetricComparison';
import { useBenchmark } from '../hooks/useBenchmark';
import ErrorBoundary from '../components/common/ErrorBoundary';
import useNotification from '../hooks/useNotification';
import { IBenchmarkComparison } from '../interfaces/benchmark.interface';
import { ERROR_CODES, ERROR_MESSAGES } from '../constants/error.constants';

// Enhanced interface for page state
interface BenchmarkPageState {
  currentMetricId: string | null;
  currentRevenueRangeId: string | null;
  companyValue: number | null;
  isLoading: boolean;
  error: Error | null;
  retryCount: number;
}

/**
 * BenchmarkPage component providing comprehensive metric comparison functionality
 * Implements WCAG 2.1 AA compliance with enhanced error handling and performance optimization
 */
const BenchmarkPage: React.FC = () => {
  // Initialize state with enhanced error handling
  const [state, setState] = useState<BenchmarkPageState>({
    currentMetricId: null,
    currentRevenueRangeId: null,
    companyValue: null,
    isLoading: false,
    error: null,
    retryCount: 0
  });

  // Initialize hooks
  const { showNotification } = useNotification();
  const { compareToBenchmark, error: benchmarkError } = useBenchmark();
  const queryClient = useQueryClient();

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Reset form state
        setState(prev => ({
          ...prev,
          currentMetricId: null,
          currentRevenueRangeId: null,
          companyValue: null
        }));
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  /**
   * Handles benchmark comparison submission with enhanced error handling
   * @param comparisonData Benchmark comparison data from form
   */
  const handleBenchmarkSubmit = useCallback(async (comparisonData: IBenchmarkComparison) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Update state with submitted values
      setState(prev => ({
        ...prev,
        currentMetricId: comparisonData.metric.id,
        currentRevenueRangeId: comparisonData.revenueRange.id,
        companyValue: comparisonData.companyValue
      }));

      // Attempt comparison with retry logic
      const result = await compareToBenchmark(
        comparisonData.companyValue,
        comparisonData.metric.id,
        comparisonData.revenueRange.id
      );

      if (result) {
        // Update cache with new comparison results
        queryClient.setQueryData(
          ['benchmark', comparisonData.metric.id, comparisonData.revenueRange.id],
          result
        );

        showNotification({
          type: 'success',
          message: 'Benchmark comparison completed successfully',
          duration: 3000
        });
      }
    } catch (error: any) {
      const errorCode = error.code || ERROR_CODES.DATA.VALIDATION_ERROR;
      
      setState(prev => ({
        ...prev,
        error: new Error(ERROR_MESSAGES.DATA[errorCode] || error.message),
        retryCount: prev.retryCount + 1
      }));

      showNotification({
        type: 'error',
        message: ERROR_MESSAGES.DATA[errorCode] || error.message,
        duration: 5000
      });
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [compareToBenchmark, queryClient, showNotification]);

  return (
    <ErrorBoundary>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Grid container spacing={4}>
          {/* Page Header */}
          <Grid item xs={12}>
            <Typography
              variant="h1"
              component="h1"
              gutterBottom
              aria-label="Benchmark Comparison Tool"
            >
              Benchmark Comparison
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              paragraph
              aria-label="Page description"
            >
              Compare your company's metrics against industry benchmarks to understand your performance.
            </Typography>
          </Grid>

          {/* Benchmark Form Section */}
          <Grid item xs={12} md={6}>
            <BenchmarkForm
              onSubmit={handleBenchmarkSubmit}
              initialMetricId={state.currentMetricId || undefined}
              validationContext={{
                retryCount: state.retryCount,
                previousValue: state.companyValue
              }}
            />
          </Grid>

          {/* Comparison Results Section */}
          <Grid item xs={12} md={6}>
            {state.isLoading ? (
              <Skeleton
                variant="rectangular"
                height={400}
                sx={{ borderRadius: 1 }}
                aria-label="Loading comparison results"
              />
            ) : state.currentMetricId && state.currentRevenueRangeId && state.companyValue ? (
              <MetricComparison
                metric={{
                  id: state.currentMetricId,
                  name: 'Current Metric', // This will be updated with actual metric name from API
                  type: 'FINANCIAL',
                  unit: 'currency'
                }}
                companyValue={state.companyValue}
                revenueRangeId={state.currentRevenueRangeId}
                onComparisonComplete={(comparison) => {
                  // Handle successful comparison
                  showNotification({
                    type: 'success',
                    message: `Your ${comparison.metric.name} is in the ${Math.round(comparison.percentile)}th percentile`,
                    duration: 5000
                  });
                }}
                onError={(error) => {
                  // Handle comparison error
                  showNotification({
                    type: 'error',
                    message: error.message,
                    duration: 5000
                  });
                }}
              />
            ) : (
              <Typography
                variant="body1"
                color="text.secondary"
                align="center"
                sx={{ mt: 4 }}
                aria-label="No comparison results"
              >
                Enter your metrics to see the comparison results.
              </Typography>
            )}
          </Grid>
        </Grid>
      </Container>
    </ErrorBoundary>
  );
};

export default BenchmarkPage;