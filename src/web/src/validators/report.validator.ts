import { IReport, IReportConfig, ReportType, ReportFormat, IReportTimeRange } from '../interfaces/report.interface';
import { MetricType } from '../types/metric.types';
import { ChartType } from '../types/chart.types';
import { formatValidationError } from '../utils/validation.utils';
import { VALIDATION_ERROR_MESSAGES } from '../constants/validation.constants';

// Cache for validation results to improve performance
const validationCache = new Map<string, ValidationResult>();

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  errorCodes: string[];
}

/**
 * Validates complete report configuration according to business rules
 * @param config - Report configuration to validate
 * @returns ValidationResult with detailed error information
 */
export const validateReportConfig = (config: IReportConfig): ValidationResult => {
  // Generate cache key
  const cacheKey = JSON.stringify(config);
  const cachedResult = validationCache.get(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  const result: ValidationResult = {
    isValid: true,
    errors: [],
    errorCodes: []
  };

  // Required fields validation
  if (!config.type || !config.format || !config.timeRange) {
    result.isValid = false;
    result.errors.push(VALIDATION_ERROR_MESSAGES.REQUIRED_FIELD);
    result.errorCodes.push('MISSING_REQUIRED_FIELDS');
    validationCache.set(cacheKey, result);
    return result;
  }

  // Report type validation
  if (!Object.values(ReportType).includes(config.type)) {
    result.isValid = false;
    result.errors.push('Invalid report type');
    result.errorCodes.push('INVALID_REPORT_TYPE');
  }

  // Format validation and security constraints
  if (!Object.values(ReportFormat).includes(config.format)) {
    result.isValid = false;
    result.errors.push('Invalid report format');
    result.errorCodes.push('INVALID_REPORT_FORMAT');
  }

  // File size validation
  if (config.maxFileSize && (config.maxFileSize <= 0 || config.maxFileSize > 10485760)) { // 10MB limit
    result.isValid = false;
    result.errors.push('File size must be between 1 byte and 10MB');
    result.errorCodes.push('INVALID_FILE_SIZE');
  }

  // Time range validation
  const timeRangeResult = validateReportTimeRange(config.timeRange);
  if (!timeRangeResult.isValid) {
    result.isValid = false;
    result.errors.push(...timeRangeResult.errors);
    result.errorCodes.push(...timeRangeResult.errorCodes);
  }

  // Metrics validation
  if (config.selectedMetrics && config.metricTypes) {
    const metricsResult = validateReportMetrics(config.selectedMetrics, config.metricTypes);
    if (!metricsResult.isValid) {
      result.isValid = false;
      result.errors.push(...metricsResult.errors);
      result.errorCodes.push(...metricsResult.errorCodes);
    }
  }

  // Chart validation
  if (config.includeCharts) {
    if (!config.chartTypes || config.chartTypes.length === 0) {
      result.isValid = false;
      result.errors.push('At least one chart type must be selected when charts are included');
      result.errorCodes.push('MISSING_CHART_TYPES');
    } else {
      // Validate each chart type
      const invalidChartTypes = config.chartTypes.filter(type => !Object.values(ChartType).includes(type));
      if (invalidChartTypes.length > 0) {
        result.isValid = false;
        result.errors.push('Invalid chart type(s) selected');
        result.errorCodes.push('INVALID_CHART_TYPES');
      }
    }
  }

  // Cache validation result
  validationCache.set(cacheKey, result);
  return result;
};

/**
 * Validates report time range according to business rules
 * @param timeRange - Time range to validate
 * @returns ValidationResult with detailed error information
 */
export const validateReportTimeRange = (timeRange: IReportTimeRange): ValidationResult => {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    errorCodes: []
  };

  const startDate = new Date(timeRange.startDate);
  const endDate = new Date(timeRange.endDate);
  const now = new Date();
  const maxRange = 5 * 365 * 24 * 60 * 60 * 1000; // 5 years in milliseconds

  // Validate date formats
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    result.isValid = false;
    result.errors.push('Invalid date format');
    result.errorCodes.push('INVALID_DATE_FORMAT');
    return result;
  }

  // Start date must be before end date
  if (startDate >= endDate) {
    result.isValid = false;
    result.errors.push('Start date must be before end date');
    result.errorCodes.push('INVALID_DATE_RANGE');
  }

  // Dates cannot be in future
  if (startDate > now || endDate > now) {
    result.isValid = false;
    result.errors.push('Dates cannot be in the future');
    result.errorCodes.push('FUTURE_DATES');
  }

  // Validate range is not more than 5 years
  if (endDate.getTime() - startDate.getTime() > maxRange) {
    result.isValid = false;
    result.errors.push('Time range cannot exceed 5 years');
    result.errorCodes.push('EXCESSIVE_TIME_RANGE');
  }

  return result;
};

/**
 * Validates report metrics according to business rules
 * @param selectedMetrics - Array of selected metric IDs
 * @param metricTypes - Array of metric types
 * @returns ValidationResult with detailed error information
 */
export const validateReportMetrics = (
  selectedMetrics: string[],
  metricTypes: MetricType[]
): ValidationResult => {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    errorCodes: []
  };

  // At least one metric must be selected
  if (!selectedMetrics || selectedMetrics.length === 0) {
    result.isValid = false;
    result.errors.push('At least one metric must be selected');
    result.errorCodes.push('NO_METRICS_SELECTED');
    return result;
  }

  // Validate metric types
  if (!metricTypes || metricTypes.length === 0) {
    result.isValid = false;
    result.errors.push('At least one metric type must be specified');
    result.errorCodes.push('NO_METRIC_TYPES');
    return result;
  }

  // Validate metric type values
  const invalidTypes = metricTypes.filter(type => !Object.values(MetricType).includes(type));
  if (invalidTypes.length > 0) {
    result.isValid = false;
    result.errors.push('Invalid metric type(s) specified');
    result.errorCodes.push('INVALID_METRIC_TYPES');
  }

  // Maximum metrics limit
  const maxMetrics = 20;
  if (selectedMetrics.length > maxMetrics) {
    result.isValid = false;
    result.errors.push(`Cannot select more than ${maxMetrics} metrics`);
    result.errorCodes.push('TOO_MANY_METRICS');
  }

  return result;
};

// Clear validation cache periodically
setInterval(() => {
  validationCache.clear();
}, 300000); // Clear every 5 minutes