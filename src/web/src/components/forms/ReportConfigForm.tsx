import React, { useState, useCallback, useEffect } from 'react';
import { styled } from '@mui/material/styles'; // @mui/material v5.0.0
import { 
  Box, 
  Button, 
  CircularProgress,
  FormControlLabel,
  Switch,
  Typography,
  Grid,
  Alert
} from '@mui/material'; // @mui/material v5.0.0

import Input from '../common/Input';
import Dropdown from '../common/Dropdown';
import { reportService } from '../../services/report.service';
import { 
  IReportConfig, 
  ReportType, 
  ReportFormat, 
  PageOrientation 
} from '../../interfaces/report.interface';
import { MetricType } from '../../types/metric.types';
import { ChartType } from '../../types/chart.types';

// Styled components
const FormContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
}));

const FormSection = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(3),
}));

const ProgressContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  marginTop: theme.spacing(2),
}));

// Props interface
interface ReportConfigFormProps {
  onSubmit: (config: IReportConfig) => Promise<void>;
  initialConfig?: Partial<IReportConfig>;
  onProgress?: (progress: number) => void;
}

// Form validation interface
interface FormValidation {
  [key: string]: boolean;
}

const ReportConfigForm: React.FC<ReportConfigFormProps> = ({
  onSubmit,
  initialConfig,
  onProgress
}) => {
  // Form state
  const [formData, setFormData] = useState<IReportConfig>({
    type: initialConfig?.type || ReportType.BENCHMARK_COMPARISON,
    format: initialConfig?.format || ReportFormat.PDF,
    timeRange: initialConfig?.timeRange || {
      startDate: new Date(),
      endDate: new Date()
    },
    selectedMetrics: initialConfig?.selectedMetrics || [],
    metricTypes: initialConfig?.metricTypes || [],
    includeCharts: initialConfig?.includeCharts ?? true,
    chartTypes: initialConfig?.chartTypes || [],
    orientation: initialConfig?.orientation || PageOrientation.PORTRAIT,
    maxFileSize: initialConfig?.maxFileSize || 10 * 1024 * 1024, // 10MB default
    securityOptions: initialConfig?.securityOptions || {
      enableEncryption: true,
      sanitizeContent: true,
      allowedDomains: []
    }
  });

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<FormValidation>({});

  // Validation rules
  const validateForm = useCallback(() => {
    const newValidation: FormValidation = {
      selectedMetrics: formData.selectedMetrics.length > 0,
      metricTypes: formData.metricTypes.length > 0,
      chartTypes: !formData.includeCharts || formData.chartTypes.length > 0,
      maxFileSize: formData.maxFileSize > 0 && formData.maxFileSize <= 100 * 1024 * 1024
    };

    setValidation(newValidation);
    return Object.values(newValidation).every(Boolean);
  }, [formData]);

  // Handle form field changes
  const handleChange = useCallback((field: keyof IReportConfig, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError(null);
  }, []);

  // Handle security options changes
  const handleSecurityOptionChange = useCallback((option: keyof typeof formData.securityOptions, value: any) => {
    setFormData(prev => ({
      ...prev,
      securityOptions: {
        ...prev.securityOptions,
        [option]: value
      }
    }));
  }, []);

  // Handle form submission
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!validateForm()) {
      setError('Please fill in all required fields correctly');
      return;
    }

    setIsSubmitting(true);
    setProgress(0);

    try {
      // Track progress
      const handleProgress = (currentProgress: number) => {
        setProgress(currentProgress);
        onProgress?.(currentProgress);
      };

      await onSubmit(formData);
      handleProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while generating the report');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Options for dropdowns
  const reportTypeOptions = Object.values(ReportType).map(type => ({
    value: type,
    label: type.replace(/_/g, ' ').toLowerCase()
  }));

  const reportFormatOptions = Object.values(ReportFormat).map(format => ({
    value: format,
    label: format
  }));

  const metricTypeOptions = Object.values(MetricType).map(type => ({
    value: type,
    label: type.replace(/_/g, ' ').toLowerCase()
  }));

  const chartTypeOptions = Object.values(ChartType).map(type => ({
    value: type,
    label: type.replace(/_/g, ' ').toLowerCase()
  }));

  return (
    <FormContainer component="form" onSubmit={handleSubmit}>
      <Typography variant="h6" gutterBottom>
        Report Configuration
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <FormSection>
            <Dropdown
              id="report-type"
              label="Report Type"
              options={reportTypeOptions}
              value={formData.type}
              onChange={(value) => handleChange('type', value)}
              required
              multiple={false}
            />
          </FormSection>
        </Grid>

        <Grid item xs={12} md={6}>
          <FormSection>
            <Dropdown
              id="report-format"
              label="Export Format"
              options={reportFormatOptions}
              value={formData.format}
              onChange={(value) => handleChange('format', value)}
              required
              multiple={false}
            />
          </FormSection>
        </Grid>

        <Grid item xs={12}>
          <FormSection>
            <Dropdown
              id="metric-types"
              label="Metric Types"
              options={metricTypeOptions}
              value={formData.metricTypes}
              onChange={(value) => handleChange('metricTypes', value)}
              required
              multiple={true}
              error={!validation.metricTypes ? 'Select at least one metric type' : undefined}
            />
          </FormSection>
        </Grid>

        <Grid item xs={12}>
          <FormSection>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.includeCharts}
                  onChange={(e) => handleChange('includeCharts', e.target.checked)}
                />
              }
              label="Include Charts"
            />

            {formData.includeCharts && (
              <Dropdown
                id="chart-types"
                label="Chart Types"
                options={chartTypeOptions}
                value={formData.chartTypes}
                onChange={(value) => handleChange('chartTypes', value)}
                required
                multiple={true}
                error={!validation.chartTypes ? 'Select at least one chart type' : undefined}
              />
            )}
          </FormSection>
        </Grid>

        <Grid item xs={12}>
          <FormSection>
            <Typography variant="subtitle2" gutterBottom>
              Security Options
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.securityOptions.enableEncryption}
                  onChange={(e) => handleSecurityOptionChange('enableEncryption', e.target.checked)}
                />
              }
              label="Enable Encryption"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.securityOptions.sanitizeContent}
                  onChange={(e) => handleSecurityOptionChange('sanitizeContent', e.target.checked)}
                />
              }
              label="Sanitize Content"
            />
          </FormSection>
        </Grid>
      </Grid>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="submit"
          variant="contained"
          color="primary"
          disabled={isSubmitting}
          sx={{ minWidth: 150 }}
        >
          {isSubmitting ? 'Generating...' : 'Generate Report'}
        </Button>
      </Box>

      {isSubmitting && (
        <ProgressContainer>
          <CircularProgress size={24} />
          <Typography variant="body2">
            Generating report... {progress}%
          </Typography>
        </ProgressContainer>
      )}
    </FormContainer>
  );
};

export default ReportConfigForm;