import { IBenchmarkData, IBenchmarkRevenueRange } from '../interfaces/benchmark.interface';
import { validateRangeRule, formatValidationError } from '../utils/validation.utils';
import { Cache } from 'cache-manager';
import { ValidationContext } from '@types/validation';

// Initialize cache for validation results
const validationCache = new Map<string, ValidationResult>();

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  context?: ValidationContext;
}

/**
 * Validates benchmark data points with comprehensive error checking and caching
 * @param benchmarkData - Benchmark data to validate
 * @param context - Validation context for enhanced validation
 * @returns ValidationResult with detailed error information
 */
export const validateBenchmarkData = (
  benchmarkData: IBenchmarkData,
  context?: ValidationContext
): ValidationResult => {
  // Generate cache key
  const cacheKey = `benchmark_${benchmarkData.id}_${JSON.stringify(context)}`;
  
  // Check cache first
  const cachedResult = validationCache.get(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  const result: ValidationResult = {
    isValid: true,
    errors: [],
    context
  };

  // Validate required fields
  const requiredFields = ['p10Value', 'p25Value', 'p50Value', 'p75Value', 'p90Value'];
  for (const field of requiredFields) {
    if (benchmarkData[field] === undefined || benchmarkData[field] === null) {
      result.isValid = false;
      result.errors.push(formatValidationError('REQUIRED_FIELD', { field }));
    }
  }

  // Validate percentile order
  if (
    benchmarkData.p10Value > benchmarkData.p25Value ||
    benchmarkData.p25Value > benchmarkData.p50Value ||
    benchmarkData.p50Value > benchmarkData.p75Value ||
    benchmarkData.p75Value > benchmarkData.p90Value
  ) {
    result.isValid = false;
    result.errors.push('Percentile values must be in ascending order');
  }

  // Validate non-negative values
  const percentileValues = [
    benchmarkData.p10Value,
    benchmarkData.p25Value,
    benchmarkData.p50Value,
    benchmarkData.p75Value,
    benchmarkData.p90Value
  ];

  for (const value of percentileValues) {
    if (value < 0) {
      result.isValid = false;
      result.errors.push('Percentile values cannot be negative');
      break;
    }
  }

  // Cache validation result
  validationCache.set(cacheKey, result);
  return result;
};

/**
 * Validates revenue range values with currency support and enhanced error handling
 * @param revenueRange - Revenue range to validate
 * @param context - Validation context for enhanced validation
 * @returns ValidationResult with detailed error information
 */
export const validateRevenueRange = (
  revenueRange: IBenchmarkRevenueRange,
  context?: ValidationContext
): ValidationResult => {
  const cacheKey = `revenue_range_${revenueRange.minRevenue}_${revenueRange.maxRevenue}_${JSON.stringify(context)}`;
  
  const cachedResult = validationCache.get(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  const result: ValidationResult = {
    isValid: true,
    errors: [],
    context
  };

  // Validate currency code if present
  if (revenueRange.currency && !/^[A-Z]{3}$/.test(revenueRange.currency)) {
    result.isValid = false;
    result.errors.push('Invalid currency code format');
  }

  // Validate revenue range values
  if (revenueRange.minRevenue < 0) {
    result.isValid = false;
    result.errors.push('Minimum revenue cannot be negative');
  }

  if (revenueRange.maxRevenue <= revenueRange.minRevenue) {
    result.isValid = false;
    result.errors.push('Maximum revenue must be greater than minimum revenue');
  }

  // Validate range bounds
  const rangeValidation = validateRangeRule(
    revenueRange.maxRevenue,
    revenueRange.minRevenue,
    Number.MAX_SAFE_INTEGER,
    'currency'
  );

  if (!rangeValidation.isValid) {
    result.isValid = false;
    result.errors.push(...rangeValidation.errors.map(err => err.message));
  }

  // Cache validation result
  validationCache.set(cacheKey, result);
  return result;
};

/**
 * Validates company metric comparison with enhanced context support
 * @param companyValue - Company metric value to compare
 * @param benchmarkData - Benchmark data for comparison
 * @param context - Validation context for enhanced validation
 * @returns ValidationResult with detailed error information
 */
export const validateBenchmarkComparison = (
  companyValue: number,
  benchmarkData: IBenchmarkData,
  context?: ValidationContext
): ValidationResult => {
  const cacheKey = `comparison_${companyValue}_${benchmarkData.id}_${JSON.stringify(context)}`;
  
  const cachedResult = validationCache.get(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  const result: ValidationResult = {
    isValid: true,
    errors: [],
    context
  };

  // Validate company value
  if (typeof companyValue !== 'number' || isNaN(companyValue)) {
    result.isValid = false;
    result.errors.push('Company value must be a valid number');
  }

  if (companyValue < 0) {
    result.isValid = false;
    result.errors.push('Company value cannot be negative');
  }

  // Validate benchmark data
  const benchmarkValidation = validateBenchmarkData(benchmarkData, context);
  if (!benchmarkValidation.isValid) {
    result.isValid = false;
    result.errors.push(...benchmarkValidation.errors);
  }

  // Validate value is within reasonable bounds
  if (companyValue > benchmarkData.p90Value * 10) {
    result.isValid = false;
    result.errors.push('Company value exceeds reasonable bounds');
  }

  // Cache validation result
  validationCache.set(cacheKey, result);
  return result;
};

// Clear validation cache periodically to prevent memory leaks
setInterval(() => {
  validationCache.clear();
}, 300000); // Clear every 5 minutes