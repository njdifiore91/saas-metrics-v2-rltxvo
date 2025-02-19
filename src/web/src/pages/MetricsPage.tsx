import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Container, LinearProgress } from '@mui/material'; // @mui/material v5.0.0
import MetricsList from '../components/metrics/MetricsList';
import MetricInput from '../components/metrics/MetricInput';
import { useMetrics } from '../hooks/useMetrics';
import { IMetricDefinition } from '../interfaces/metric.interface';
import { useAppDispatch, useAppSelector } from '../store';
import { selectBenchmarkData } from '../store/benchmark.slice';
import { theme } from '../assets/styles/theme';
import { styled } from '@mui/material/styles';

// Styled components
const StyledContainer = styled(Container)(({ theme }) => ({
  padding: theme.spacing(3),
  marginTop: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[1],
  minHeight: '80vh',
  position: 'relative'
}));

const ProgressWrapper = styled('div')({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 1000
});

const MetricsSection = styled('section')({
  marginBottom: theme.spacing(4)
});

// Error boundary wrapper
const withErrorBoundary = (WrappedComponent: React.ComponentType) => {
  return class extends React.Component<{}, { hasError: boolean }> {
    constructor(props: {}) {
      super(props);
      this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
      return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
      console.error('Metrics Page Error:', error, errorInfo);
    }

    render() {
      if (this.state.hasError) {
        return (
          <StyledContainer>
            <h2>Something went wrong loading the metrics page.</h2>
            <button onClick={() => this.setState({ hasError: false })}>
              Try again
            </button>
          </StyledContainer>
        );
      }
      return <WrappedComponent {...this.props} />;
    }
  };
};

// Main component
const MetricsPage: React.FC = () => {
  // State management
  const [selectedMetric, setSelectedMetric] = useState<IMetricDefinition | null>(null);
  const [batchUpdates, setBatchUpdates] = useState<Array<{ metricId: string; value: number }>>([]);

  // Custom hooks
  const {
    metricDefinitions,
    companyMetrics,
    isLoading,
    submitMetrics,
    batchSubmitMetrics,
    submitProgress
  } = useMetrics('current-company'); // Replace with actual company ID

  const dispatch = useAppDispatch();

  // Memoized benchmark data
  const benchmarkData = useAppSelector(state => 
    selectedMetric ? selectBenchmarkData(state, selectedMetric.id) : null
  );

  // Handle metric selection
  const handleMetricSelect = useCallback((metricId: string) => {
    const metric = metricDefinitions.find(m => m.id === metricId);
    setSelectedMetric(metric || null);
  }, [metricDefinitions]);

  // Handle metric value update
  const handleMetricUpdate = useCallback(async (
    value: number,
    isValid: boolean,
    validationContext?: Record<string, any>
  ) => {
    if (!selectedMetric || !isValid) return;

    try {
      await submitMetrics([{
        metricId: selectedMetric.id,
        value
      }]);
    } catch (error) {
      console.error('Failed to update metric:', error);
    }
  }, [selectedMetric, submitMetrics]);

  // Handle batch updates
  const handleBatchUpdate = useCallback(async () => {
    if (batchUpdates.length === 0) return;

    try {
      await batchSubmitMetrics(batchUpdates);
      setBatchUpdates([]);
    } catch (error) {
      console.error('Failed to process batch updates:', error);
    }
  }, [batchUpdates, batchSubmitMetrics]);

  // Effect to process batch updates
  useEffect(() => {
    if (batchUpdates.length >= 5) {
      handleBatchUpdate();
    }
  }, [batchUpdates, handleBatchUpdate]);

  // Memoized metrics list props
  const metricsListProps = useMemo(() => ({
    companyId: 'current-company', // Replace with actual company ID
    onMetricSelect: handleMetricSelect,
    showLoading: isLoading,
    rowsPerPage: 10
  }), [handleMetricSelect, isLoading]);

  return (
    <StyledContainer>
      {submitProgress > 0 && (
        <ProgressWrapper>
          <LinearProgress 
            variant="determinate" 
            value={submitProgress}
            aria-label="Metric submission progress"
          />
        </ProgressWrapper>
      )}

      <MetricsSection aria-label="Metrics Overview">
        <h1>Company Metrics</h1>
        <MetricsList {...metricsListProps} />
      </MetricsSection>

      {selectedMetric && (
        <MetricsSection aria-label="Metric Input">
          <h2>Update {selectedMetric.name}</h2>
          <MetricInput
            metricDefinition={selectedMetric}
            value={companyMetrics[selectedMetric.id] || 0}
            onChange={handleMetricUpdate}
            disabled={isLoading}
            ariaLabel={`Input field for ${selectedMetric.name}`}
          />
        </MetricsSection>
      )}

      {benchmarkData && selectedMetric && (
        <MetricsSection aria-label="Benchmark Comparison">
          <h2>Benchmark Comparison</h2>
          {/* Benchmark comparison visualization would go here */}
        </MetricsSection>
      )}
    </StyledContainer>
  );
};

// Export wrapped component with error boundary
export default withErrorBoundary(MetricsPage);