import React, { memo, useCallback, useEffect, useState } from 'react';
import { Card, Typography, Skeleton, Alert } from '@mui/material'; // v5.0.0
import { debounce } from 'lodash'; // v4.17.21

// Internal imports
import { IMetricDefinition } from '../../interfaces/metric.interface';
import BenchmarkChart from '../charts/BenchmarkChart';
import { useBenchmark } from '../../hooks/useBenchmark';
import ErrorBoundary from '../common/ErrorBoundary';
import { IBenchmarkComparison } from '../../interfaces/benchmark.interface';
import { ERROR_CODES, ERROR_MESSAGES } from '../../constants/error.constants';

interface MetricComparisonProps {
  metric: IMetricDefinition;
  companyValue: number;
  revenueRangeId: string;
  onComparisonComplete?: (comparison: IBenchmarkComparison) => void;
  onError?: (error: Error) => void;
}

interface IError {
  code: string;
  message: string;
}

const MetricComparison = memo(({
  metric,
  companyValue,
  revenueRangeId,
  onComparisonComplete,
  onError
}: MetricComparisonProps) => {
  // State management
  const [comparison, setComparison] = useState<IBenchmarkComparison | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<IError | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  // Custom hook for benchmark operations
  const { compareToBenchmark } = useBenchmark();

  // Debounced comparison handler
  const debouncedCompare = useCallback(
    debounce(async () => {
      try {
        setIsLoading(true);
        setError(null);

        const result = await compareToBenchmark(
          companyValue,
          metric.id,
          revenueRangeId
        );

        if (result) {
          setComparison(result);
          onComparisonComplete?.(result);
        }
      } catch (err: any) {
        const errorCode = err.code || ERROR_CODES.DATA.VALIDATION_ERROR;
        setError({
          code: errorCode,
          message: ERROR_MESSAGES.DATA[errorCode] || err.message
        });
        onError?.(err);
      } finally {
        setIsLoading(false);
        setIsRetrying(false);
      }
    }, 300),
    [companyValue, metric.id, revenueRangeId, onComparisonComplete, onError]
  );

  // Handle retry logic
  const handleRetry = useCallback(async () => {
    if (retryCount >= 3) {
      setError({
        code: ERROR_CODES.SYS.SERVICE_UNAVAILABLE,
        message: ERROR_MESSAGES.SYS[ERROR_CODES.SYS.SERVICE_UNAVAILABLE]
      });
      return;
    }

    setIsRetrying(true);
    setRetryCount(prev => prev + 1);
    await debouncedCompare();
  }, [retryCount, debouncedCompare]);

  // Load comparison data on mount or when inputs change
  useEffect(() => {
    debouncedCompare();
    return () => {
      debouncedCompare.cancel();
    };
  }, [debouncedCompare]);

  // Render loading state
  if (isLoading) {
    return (
      <Card
        sx={{ p: 3 }}
        role="region"
        aria-label="Loading metric comparison"
      >
        <Skeleton variant="text" width="60%" height={32} />
        <Skeleton variant="rectangular" height={200} sx={{ mt: 2 }} />
      </Card>
    );
  }

  // Render error state
  if (error) {
    return (
      <Card
        sx={{ p: 3 }}
        role="alert"
        aria-live="polite"
      >
        <Alert 
          severity="error"
          action={
            retryCount < 3 && (
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                aria-label="Retry comparison"
              >
                {isRetrying ? 'Retrying...' : 'Retry'}
              </button>
            )
          }
        >
          {error.message}
        </Alert>
      </Card>
    );
  }

  // Render comparison results
  return (
    <ErrorBoundary
      onError={(error) => {
        setError({
          code: ERROR_CODES.SYS.SERVICE_UNAVAILABLE,
          message: error.message
        });
        onError?.(error);
      }}
    >
      <Card
        sx={{ p: 3 }}
        role="region"
        aria-label={`Metric comparison for ${metric.name}`}
      >
        <Typography
          variant="h6"
          component="h2"
          gutterBottom
          aria-label={`${metric.name} comparison results`}
        >
          {metric.name} Comparison
        </Typography>

        {comparison && (
          <>
            <Typography
              variant="metric"
              component="div"
              sx={{ mb: 2 }}
              aria-label={`Your value: ${companyValue} ${metric.unit}`}
            >
              Your value: {companyValue} {metric.unit}
              <Typography
                component="span"
                color={comparison.percentile >= 50 ? "success.main" : "error.main"}
                sx={{ ml: 2 }}
                aria-label={`Percentile: ${Math.round(comparison.percentile)}th`}
              >
                ({Math.round(comparison.percentile)}th percentile)
              </Typography>
            </Typography>

            <BenchmarkChart
              data={{
                metric: metric.name,
                value: companyValue,
                percentile: comparison.percentile,
                benchmarkValues: {
                  p25: comparison.benchmarkData.p25Value,
                  p50: comparison.benchmarkData.p50Value,
                  p75: comparison.benchmarkData.p75Value,
                  p90: comparison.benchmarkData.p90Value
                },
                industry: 'All',
                revenueRange: comparison.revenueRange.name
              }}
              config={{
                height: 200,
                margin: { top: 20, right: 20, bottom: 40, left: 20 },
                type: 'benchmark',
                animate: true,
                responsive: true
              }}
              onHover={(value, percentile) => {
                // Handle hover interactions
              }}
              onKeyboardNavigate={(direction) => {
                // Handle keyboard navigation
              }}
            />
          </>
        )}
      </Card>
    </ErrorBoundary>
  );
});

MetricComparison.displayName = 'MetricComparison';

export default MetricComparison;