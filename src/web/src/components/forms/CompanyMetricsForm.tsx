import React, { useState, useCallback, useEffect } from 'react';
import { styled } from '@mui/material/styles';
import { Button, Grid, Paper, Typography } from '@mui/material';
import Input from '../common/Input';
import ErrorBoundary from '../common/ErrorBoundary';
import { useMetrics } from '../../hooks/useMetrics';
import { MetricType, MetricUnit, MetricTimeframe } from '../../types/metric.types';
import { IMetricDefinition } from '../../interfaces/metric.interface';

// Styled components
const FormContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
  backgroundColor: theme.palette.background.paper,
  boxShadow: theme.shadows[2],
  borderRadius: theme.shape.borderRadius,
}));

const FormSection = styled('div')(({ theme }) => ({
  marginBottom: theme.spacing(4),
}));

const FormActions = styled('div')(({ theme }) => ({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: theme.spacing(2),
  marginTop: theme.spacing(3),
}));

// Props interface
interface CompanyMetricsFormProps {
  companyId: string;
  initialData?: Record<string, number>;
  onSubmitSuccess?: (metrics: Record<string, number>) => void;
  onSubmitError?: (error: any) => void;
  onValidationChange?: (isValid: boolean) => void;
}

// Form state interface
interface FormState {
  values: Record<string, number>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isDirty: boolean;
}

const CompanyMetricsForm: React.FC<CompanyMetricsFormProps> = ({
  companyId,
  initialData = {},
  onSubmitSuccess,
  onSubmitError,
  onValidationChange,
}) => {
  // Hooks
  const {
    metricDefinitions,
    submitMetrics,
    calculateMetrics,
    validateMetrics,
    isLoading,
    error
  } = useMetrics(companyId);

  // Local state
  const [formState, setFormState] = useState<FormState>({
    values: initialData,
    errors: {},
    touched: {},
    isSubmitting: false,
    isDirty: false,
  });

  // Memoized metric groups
  const metricGroups = React.useMemo(() => {
    return metricDefinitions.reduce((acc, metric) => {
      if (!acc[metric.type]) {
        acc[metric.type] = [];
      }
      acc[metric.type].push(metric);
      return acc;
    }, {} as Record<MetricType, IMetricDefinition[]>);
  }, [metricDefinitions]);

  // Format value based on metric unit
  const formatValue = useCallback((value: number, unit: MetricUnit): string => {
    switch (unit) {
      case MetricUnit.PERCENTAGE:
        return `${value}%`;
      case MetricUnit.CURRENCY:
        return `$${value.toLocaleString()}`;
      case MetricUnit.MONTHS:
        return `${value} months`;
      default:
        return value.toString();
    }
  }, []);

  // Handle metric value change
  const handleMetricChange = useCallback(async (
    metricId: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newValue = parseFloat(event.target.value);
    
    setFormState(prev => ({
      ...prev,
      values: { ...prev.values, [metricId]: newValue },
      touched: { ...prev.touched, [metricId]: true },
      isDirty: true,
    }));

    // Validate the new value
    const validationResult = await validateMetrics([{
      metricId,
      value: newValue,
      timeframe: MetricTimeframe.MONTHLY
    }]);

    // Update errors
    setFormState(prev => ({
      ...prev,
      errors: {
        ...prev.errors,
        [metricId]: validationResult[0].errors.join(', ')
      }
    }));

    // Notify parent of validation state
    if (onValidationChange) {
      const isValid = Object.values(formState.errors).every(error => !error);
      onValidationChange(isValid);
    }
  }, [validateMetrics, onValidationChange]);

  // Handle form submission
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setFormState(prev => ({ ...prev, isSubmitting: true }));

    try {
      // Validate all metrics
      const metricsToValidate = Object.entries(formState.values).map(([metricId, value]) => ({
        metricId,
        value,
        timeframe: MetricTimeframe.MONTHLY
      }));

      const validationResults = await validateMetrics(metricsToValidate);
      const hasErrors = validationResults.some(result => !result.isValid);

      if (hasErrors) {
        const errors = validationResults.reduce((acc, result) => {
          if (!result.isValid) {
            acc[result.metricId] = result.errors.join(', ');
          }
          return acc;
        }, {} as Record<string, string>);

        setFormState(prev => ({
          ...prev,
          errors,
          isSubmitting: false
        }));

        if (onSubmitError) {
          onSubmitError({ errors });
        }
        return;
      }

      // Calculate derived metrics
      const calculatedMetrics = await calculateMetrics(metricsToValidate);

      // Submit metrics
      await submitMetrics(metricsToValidate);

      setFormState(prev => ({
        ...prev,
        isSubmitting: false,
        isDirty: false
      }));

      if (onSubmitSuccess) {
        onSubmitSuccess(formState.values);
      }
    } catch (error) {
      setFormState(prev => ({
        ...prev,
        isSubmitting: false
      }));

      if (onSubmitError) {
        onSubmitError(error);
      }
    }
  };

  // Reset form
  const handleReset = () => {
    setFormState({
      values: initialData,
      errors: {},
      touched: {},
      isSubmitting: false,
      isDirty: false,
    });
  };

  return (
    <ErrorBoundary>
      <form onSubmit={handleSubmit} noValidate>
        <FormContainer>
          {Object.entries(metricGroups).map(([type, metrics]) => (
            <FormSection key={type}>
              <Typography variant="h6" gutterBottom>
                {type} Metrics
              </Typography>
              <Grid container spacing={3}>
                {metrics.map((metric) => (
                  <Grid item xs={12} sm={6} key={metric.id}>
                    <Input
                      id={`metric-${metric.id}`}
                      label={metric.name}
                      value={formState.values[metric.id] || ''}
                      onChange={(e) => handleMetricChange(metric.id, e)}
                      type="number"
                      error={Boolean(formState.errors[metric.id])}
                      helperText={formState.errors[metric.id]}
                      required={metric.validationRules.some(rule => rule.required)}
                      disabled={formState.isSubmitting}
                      ariaLabel={`Enter ${metric.name}`}
                    />
                  </Grid>
                ))}
              </Grid>
            </FormSection>
          ))}

          <FormActions>
            <Button
              type="button"
              variant="outlined"
              onClick={handleReset}
              disabled={formState.isSubmitting || !formState.isDirty}
            >
              Reset
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={
                formState.isSubmitting ||
                !formState.isDirty ||
                Object.keys(formState.errors).length > 0
              }
            >
              {formState.isSubmitting ? 'Submitting...' : 'Submit Metrics'}
            </Button>
          </FormActions>
        </FormContainer>
      </form>
    </ErrorBoundary>
  );
};

export default CompanyMetricsForm;