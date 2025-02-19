import { 
  calculateNDR, 
  calculateCACPayback, 
  validateMetricValue, 
  formatMetricValue 
} from '../../src/utils/metric.utils';
import { 
  MetricType, 
  MetricUnit, 
  MetricTimeframe 
} from '../../src/types/metric.types';
import { METRIC_VALIDATION_RULES } from '../../src/constants/metric.constants';

describe('calculateNDR', () => {
  it('should calculate NDR correctly for typical values', () => {
    const result = calculateNDR(1000000, 200000, 50000, 100000);
    expect(result.value).toBeCloseTo(105, 2);
    expect(result.isValid).toBe(true);
    expect(result.formattedValue).toBe('105.0%');
  });

  it('should handle zero starting ARR', () => {
    const result = calculateNDR(0, 100000, 50000, 25000);
    expect(result.isValid).toBe(false);
    expect(result.messages).toContain('Starting ARR must be greater than 0');
  });

  it('should validate against negative values', () => {
    const result = calculateNDR(1000000, -50000, 25000, 10000);
    expect(result.isValid).toBe(false);
    expect(result.messages).toContain('Expansions, contractions, and churn must be non-negative');
  });

  it('should respect maximum NDR threshold', () => {
    const result = calculateNDR(1000000, 2500000, 0, 0);
    expect(result.isValid).toBe(false);
    expect(result.value).toBeGreaterThan(200);
  });

  it('should handle monthly timeframe conversion', () => {
    const result = calculateNDR(100000, 10000, 5000, 2000, MetricTimeframe.MONTHLY);
    expect(result.isValid).toBe(true);
    expect(result.value).toBeCloseTo(103, 2);
  });
});

describe('calculateCACPayback', () => {
  it('should calculate CAC payback correctly for typical values', () => {
    const result = calculateCACPayback(12000, 120000, 80);
    expect(result.value).toBeCloseTo(15, 2);
    expect(result.isValid).toBe(true);
    expect(result.formattedValue).toBe('15.0 months');
  });

  it('should handle zero ARR', () => {
    const result = calculateCACPayback(10000, 0, 75);
    expect(result.isValid).toBe(false);
    expect(result.messages).toContain('CAC and ARR must be greater than 0');
  });

  it('should validate gross margin range', () => {
    const result = calculateCACPayback(10000, 100000, 120);
    expect(result.isValid).toBe(false);
    expect(result.messages).toContain('Gross margin must be between 0 and 100');
  });

  it('should respect maximum payback period', () => {
    const result = calculateCACPayback(500000, 100000, 50);
    expect(result.isValid).toBe(false);
    expect(result.value).toBeGreaterThan(60);
  });

  it('should handle decimal precision correctly', () => {
    const result = calculateCACPayback(10000, 100000, 77.5);
    expect(result.value).toBeCloseTo(15.48, 2);
    expect(result.formattedValue).toBe('15.5 months');
  });
});

describe('validateMetricValue', () => {
  const rules = METRIC_VALIDATION_RULES.NDR;

  it('should validate values within range', () => {
    const result = validateMetricValue(120, [rules], MetricType.RETENTION);
    expect(result.isValid).toBe(true);
    expect(result.messages).toHaveLength(0);
  });

  it('should detect values below minimum', () => {
    const result = validateMetricValue(-10, [rules], MetricType.RETENTION);
    expect(result.isValid).toBe(false);
    expect(result.messages).toContain(`Value must be greater than ${rules.min}`);
  });

  it('should detect values above maximum', () => {
    const result = validateMetricValue(250, [rules], MetricType.RETENTION);
    expect(result.isValid).toBe(false);
    expect(result.messages).toContain(`Value must be less than ${rules.max}`);
  });

  it('should include warning for values near thresholds', () => {
    const result = validateMetricValue(75, [rules], MetricType.RETENTION);
    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain(`Value is below recommended minimum of ${rules.warningThreshold.low}`);
  });

  it('should handle multiple validation rules', () => {
    const multipleRules = [
      { ...rules, priority: 1 },
      { ...METRIC_VALIDATION_RULES.GROSS_MARGINS, priority: 2 }
    ];
    const result = validateMetricValue(150, multipleRules, MetricType.FINANCIAL);
    expect(result.isValid).toBe(false);
  });
});

describe('formatMetricValue', () => {
  it('should format percentage metrics correctly', () => {
    const result = formatMetricValue(85.5, MetricType.RETENTION, MetricUnit.PERCENTAGE);
    expect(result).toBe('85.5%');
  });

  it('should format currency metrics with appropriate symbol', () => {
    const result = formatMetricValue(1234567, MetricType.FINANCIAL, MetricUnit.CURRENCY);
    expect(result).toBe('$1,234,567');
  });

  it('should format ratio metrics with decimal precision', () => {
    const result = formatMetricValue(2.567, MetricType.SALES, MetricUnit.RATIO);
    expect(result).toBe('2.57');
  });

  it('should format month durations with suffix', () => {
    const result = formatMetricValue(18.3, MetricType.EFFICIENCY, MetricUnit.MONTHS);
    expect(result).toBe('18.3 months');
  });

  it('should handle invalid unit gracefully', () => {
    const result = formatMetricValue(100, MetricType.FINANCIAL, 'INVALID_UNIT' as MetricUnit);
    expect(result).toBe('100');
  });

  it('should handle negative values appropriately', () => {
    const result = formatMetricValue(-25.5, MetricType.FINANCIAL, MetricUnit.PERCENTAGE);
    expect(result).toBe('-25.5%');
  });

  it('should handle zero values correctly', () => {
    const result = formatMetricValue(0, MetricType.RETENTION, MetricUnit.PERCENTAGE);
    expect(result).toBe('0.0%');
  });

  it('should handle large numbers with appropriate formatting', () => {
    const result = formatMetricValue(1234567.89, MetricType.FINANCIAL, MetricUnit.CURRENCY);
    expect(result).toBe('$1,234,568');
  });
});