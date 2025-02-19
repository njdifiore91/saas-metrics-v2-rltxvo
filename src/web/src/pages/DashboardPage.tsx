import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Grid, Box, CircularProgress, Alert, Skeleton } from '@mui/material';
import { useVirtualizer } from '@tanstack/react-virtual';

// Internal imports
import MainLayout from '../components/layout/MainLayout';
import QuickStats from '../components/dashboard/QuickStats';
import MetricCard from '../components/dashboard/MetricCard';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { useMetrics } from '../hooks/useMetrics';
import { useAppSelector } from '../store';
import { selectBenchmarkData } from '../store/benchmark.slice';
import { MetricType } from '../types/metric.types';
import { ERROR_CODES, ERROR_MESSAGES } from '../constants/error.constants';

// Props interface
export interface DashboardPageProps {
  companyId: string;
  onError?: (error: Error) => void;
}

const DashboardPage: React.FC<DashboardPageProps> = ({ companyId, onError }) => {
  // State for revenue range filter
  const [selectedRevenueRange, setSelectedRevenueRange] = useState<string>('');
  
  // Fetch metrics data using enhanced hook
  const {
    metricDefinitions,
    companyMetrics,
    isLoading,
    error,
    progress,
    retryFetch,
    calculateMetrics,
    validateMetrics
  } = useMetrics(companyId, {
    autoRefresh: true,
    validateOnChange: true,
    cacheTimeout: 15 * 60 * 1000 // 15 minutes
  });

  // Get benchmark data from store
  const benchmarkData = useAppSelector(state => 
    selectBenchmarkData(state, selectedRevenueRange)
  );

  // Memoized filtered metrics by type
  const filteredMetrics = useMemo(() => 
    metricDefinitions.filter(metric => 
      !selectedRevenueRange || metric.type === MetricType.FINANCIAL
    ),
    [metricDefinitions, selectedRevenueRange]
  );

  // Virtual list setup for performance
  const parentRef = React.useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredMetrics.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200,
    overscan: 5
  });

  // Handle revenue range changes with debouncing
  const handleRevenueRangeChange = useCallback((range: string) => {
    setSelectedRevenueRange(range);
    // Update URL query parameters
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set('range', range);
    window.history.replaceState(null, '', `?${searchParams.toString()}`);
    // Announce change to screen readers
    const announcement = `Revenue range changed to ${range}`;
    const ariaLive = document.getElementById('aria-live-region');
    if (ariaLive) {
      ariaLive.textContent = announcement;
    }
  }, []);

  // Handle retry attempts for failed data fetches
  const handleRetry = useCallback(async () => {
    try {
      await retryFetch();
    } catch (error) {
      onError?.(error as Error);
    }
  }, [retryFetch, onError]);

  // Effect to initialize revenue range from URL
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const rangeParam = searchParams.get('range');
    if (rangeParam) {
      setSelectedRevenueRange(rangeParam);
    }
  }, []);

  // Error handling effect
  useEffect(() => {
    if (error) {
      onError?.(new Error(ERROR_MESSAGES.DATA[error.code as keyof typeof ERROR_CODES.DATA] || error.message));
    }
  }, [error, onError]);

  return (
    <ErrorBoundary
      onError={onError}
      fallback={
        <Alert 
          severity="error"
          action={
            <button onClick={handleRetry}>Retry</button>
          }
        >
          Failed to load dashboard data. Please try again.
        </Alert>
      }
    >
      <MainLayout>
        {/* Accessibility announcement region */}
        <div
          id="aria-live-region"
          className="sr-only"
          aria-live="polite"
          aria-atomic="true"
        />

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            padding: 3,
            overflow: 'hidden'
          }}
        >
          {/* Quick Stats Section */}
          <QuickStats
            companyId={companyId}
            onError={onError}
          />

          {/* Metrics Grid */}
          {isLoading ? (
            <Grid container spacing={3} sx={{ mt: 3 }}>
              {[...Array(8)].map((_, index) => (
                <Grid item xs={12} sm={6} md={3} key={index}>
                  <Skeleton
                    variant="rectangular"
                    height={200}
                    sx={{ borderRadius: 1 }}
                  />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Box
              ref={parentRef}
              style={{
                height: '600px',
                overflow: 'auto',
                marginTop: '24px'
              }}
            >
              <Grid
                container
                spacing={3}
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  position: 'relative'
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const metric = filteredMetrics[virtualRow.index];
                  const value = companyMetrics[metric.id] || 0;
                  const previousValue = companyMetrics[`${metric.id}_previous`] || 0;
                  const benchmarkValue = benchmarkData?.[metric.id]?.p50Value || 0;

                  return (
                    <Grid
                      item
                      xs={12}
                      sm={6}
                      md={3}
                      key={metric.id}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`
                      }}
                    >
                      <MetricCard
                        metric={metric}
                        value={value}
                        previousValue={previousValue}
                        benchmarkValue={benchmarkValue}
                        onClick={() => {
                          // Handle metric card click
                          window.location.href = `/metrics/${metric.id}`;
                        }}
                        ariaLabel={`${metric.name} metric details`}
                      />
                    </Grid>
                  );
                })}
              </Grid>
            </Box>
          )}

          {/* Loading Progress Indicator */}
          {progress > 0 && progress < 100 && (
            <Box
              sx={{
                position: 'fixed',
                bottom: 16,
                right: 16,
                zIndex: 'tooltip'
              }}
            >
              <CircularProgress
                variant="determinate"
                value={progress}
                aria-label="Loading progress"
              />
            </Box>
          )}
        </Box>
      </MainLayout>
    </ErrorBoundary>
  );
};

export default DashboardPage;