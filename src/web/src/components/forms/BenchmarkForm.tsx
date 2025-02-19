import React, { memo, useEffect, useState, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { 
  TextField, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel,
  FormHelperText,
  Box,
  CircularProgress,
  Alert
} from '@mui/material';
import debounce from 'lodash/debounce'; // ^4.17.21

import { IBenchmarkData, IBenchmarkRevenueRange } from '../../interfaces/benchmark.interface';
import { benchmarkService } from '../../services/benchmark.service';
import { validateBenchmarkComparison } from '../../validators/benchmark.validator';
import { METRIC_VALIDATION_RULES } from '../../constants/validation.constants';

interface BenchmarkFormProps {
  onSubmit: (data: IBenchmarkComparison) => Promise<void>;
  initialMetricId?: string;
  validationContext?: Record<string, any>;
}

interface BenchmarkFormData {
  metricId: string;
  revenueRangeId: string;
  companyValue: number;
}

const BenchmarkForm: React.FC<BenchmarkFormProps> = memo(({ 
  onSubmit, 
  initialMetricId,
  validationContext 
}) => {
  // Form state management with react-hook-form
  const { 
    control, 
    handleSubmit: submitForm, 
    formState: { errors, isSubmitting },
    watch,
    setError,
    clearErrors
  } = useForm<BenchmarkFormData>({
    defaultValues: {
      metricId: initialMetricId || '',
      revenueRangeId: '',
      companyValue: undefined
    }
  });

  // Component state
  const [revenueRanges, setRevenueRanges] = useState<IBenchmarkRevenueRange[]>([]);
  const [loading, setLoading] = useState(false);
  const [benchmarkData, setBenchmarkData] = useState<IBenchmarkData | null>(null);

  // Watch form values for real-time validation
  const metricId = watch('metricId');
  const revenueRangeId = watch('revenueRangeId');
  const companyValue = watch('companyValue');

  // Load revenue ranges on component mount
  useEffect(() => {
    const loadRevenueRanges = async () => {
      try {
        setLoading(true);
        const ranges = await benchmarkService.getRevenueRanges();
        setRevenueRanges(ranges);
      } catch (error) {
        console.error('Failed to load revenue ranges:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRevenueRanges();
  }, []);

  // Debounced validation function
  const validateMetric = useCallback(
    debounce(async (value: number, metricId: string, revenueRangeId: string) => {
      if (!value || !metricId || !revenueRangeId) return;

      try {
        const benchmarkData = await benchmarkService.getBenchmarkData(metricId, revenueRangeId);
        setBenchmarkData(benchmarkData);

        const validationResult = validateBenchmarkComparison(
          value,
          benchmarkData,
          validationContext
        );

        if (!validationResult.isValid) {
          setError('companyValue', {
            type: 'validation',
            message: validationResult.errors.join('. ')
          });
        } else {
          clearErrors('companyValue');
        }
      } catch (error) {
        console.error('Validation error:', error);
        setError('companyValue', {
          type: 'validation',
          message: 'Failed to validate metric value'
        });
      }
    }, 500),
    [setError, clearErrors, validationContext]
  );

  // Validate on value changes
  useEffect(() => {
    if (companyValue && metricId && revenueRangeId) {
      validateMetric(companyValue, metricId, revenueRangeId);
    }
    return () => {
      validateMetric.cancel();
    };
  }, [companyValue, metricId, revenueRangeId, validateMetric]);

  // Form submission handler
  const handleSubmit = async (data: BenchmarkFormData) => {
    try {
      if (!benchmarkData) {
        throw new Error('Benchmark data not available');
      }

      const comparison = await benchmarkService.compareMetric(
        data.metricId,
        data.revenueRangeId,
        data.companyValue
      );

      await onSubmit(comparison);
    } catch (error) {
      console.error('Submission error:', error);
      setError('root', {
        type: 'submission',
        message: 'Failed to submit benchmark comparison'
      });
    }
  };

  return (
    <Box
      component="form"
      onSubmit={submitForm(handleSubmit)}
      noValidate
      aria-label="Benchmark comparison form"
      sx={{ width: '100%', maxWidth: 600 }}
    >
      {/* Metric Selection */}
      <FormControl 
        fullWidth 
        margin="normal"
        error={!!errors.metricId}
      >
        <InputLabel id="metric-select-label">Select Metric</InputLabel>
        <Controller
          name="metricId"
          control={control}
          rules={{ required: 'Please select a metric' }}
          render={({ field }) => (
            <Select
              {...field}
              labelId="metric-select-label"
              label="Select Metric"
              disabled={loading}
            >
              {Object.keys(METRIC_VALIDATION_RULES).map((metricKey) => (
                <MenuItem key={metricKey} value={metricKey}>
                  {metricKey.replace(/_/g, ' ')}
                </MenuItem>
              ))}
            </Select>
          )}
        />
        {errors.metricId && (
          <FormHelperText>{errors.metricId.message}</FormHelperText>
        )}
      </FormControl>

      {/* Revenue Range Selection */}
      <FormControl 
        fullWidth 
        margin="normal"
        error={!!errors.revenueRangeId}
      >
        <InputLabel id="revenue-range-label">Revenue Range</InputLabel>
        <Controller
          name="revenueRangeId"
          control={control}
          rules={{ required: 'Please select a revenue range' }}
          render={({ field }) => (
            <Select
              {...field}
              labelId="revenue-range-label"
              label="Revenue Range"
              disabled={loading}
            >
              {revenueRanges.map((range) => (
                <MenuItem key={range.id} value={range.id}>
                  {range.name}
                </MenuItem>
              ))}
            </Select>
          )}
        />
        {errors.revenueRangeId && (
          <FormHelperText>{errors.revenueRangeId.message}</FormHelperText>
        )}
      </FormControl>

      {/* Company Value Input */}
      <Controller
        name="companyValue"
        control={control}
        rules={{
          required: 'Please enter your company value',
          validate: {
            isNumber: (value) => !isNaN(value) || 'Please enter a valid number'
          }
        }}
        render={({ field }) => (
          <TextField
            {...field}
            fullWidth
            label="Your Company's Value"
            type="number"
            margin="normal"
            error={!!errors.companyValue}
            helperText={errors.companyValue?.message}
            disabled={loading}
            InputProps={{
              inputProps: { 
                'aria-label': 'Company metric value',
                step: 'any'
              }
            }}
          />
        )}
      />

      {/* Form-level error display */}
      {errors.root && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {errors.root.message}
        </Alert>
      )}

      {/* Submit button with loading state */}
      <Box sx={{ mt: 3, position: 'relative' }}>
        <button
          type="submit"
          disabled={isSubmitting || loading}
          style={{
            padding: '12px 24px',
            backgroundColor: '#168947',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isSubmitting || loading ? 'not-allowed' : 'pointer',
            width: '100%'
          }}
        >
          {isSubmitting ? 'Comparing...' : 'Compare Metrics'}
        </button>
        {(isSubmitting || loading) && (
          <CircularProgress
            size={24}
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              marginTop: '-12px',
              marginLeft: '-12px'
            }}
          />
        )}
      </Box>
    </Box>
  );
});

BenchmarkForm.displayName = 'BenchmarkForm';

export default BenchmarkForm;