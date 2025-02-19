import React, { useState, useCallback, useEffect } from 'react';
import { debounce } from 'lodash'; // lodash v4.17.21
import Input from '../common/Input';
import { IMetricDefinition, IMetricValidationRule } from '../../interfaces/metric.interface';
import { validateMetricValue, ValidationResult } from '../../validators/metric.validator';
import { MetricUnit } from '../../types/metric.types';

interface MetricInputProps {
  metricDefinition: IMetricDefinition;
  value: number;
  onChange: (value: number, isValid: boolean, validationContext?: Record<string, any>) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

const MetricInput: React.FC<MetricInputProps> = ({
  metricDefinition,
  value,
  onChange,
  disabled = false,
  ariaLabel,
}) => {
  const [inputValue, setInputValue] = useState<string>(formatValue(value, metricDefinition.unit));
  const [validationState, setValidationState] = useState<ValidationResult>({
    isValid: true,
    errors: [],
    warnings: [],
    context: {}
  });

  // Format value based on metric unit
  function formatValue(val: number, unit: MetricUnit): string {
    if (val === null || val === undefined) return '';

    switch (unit) {
      case MetricUnit.PERCENTAGE:
        return `${val.toFixed(2)}%`;
      case MetricUnit.CURRENCY:
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        }).format(val);
      case MetricUnit.RATIO:
        return val.toFixed(2);
      case MetricUnit.MONTHS:
        return `${val.toFixed(1)} months`;
      default:
        return val.toString();
    }
  }

  // Parse value from formatted string
  function parseValue(val: string): number {
    const cleanValue = val.replace(/[^0-9.-]/g, '');
    return parseFloat(cleanValue);
  }

  // Debounced validation function
  const debouncedValidate = useCallback(
    debounce((value: number) => {
      const validationResult = validateMetricValue(
        value,
        metricDefinition,
        validationState.context
      );
      setValidationState(validationResult);
      onChange(value, validationResult.isValid, validationResult.context);
    }, 300),
    [metricDefinition, onChange]
  );

  // Handle input change
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setInputValue(newValue);

    const parsedValue = parseValue(newValue);
    if (!isNaN(parsedValue)) {
      debouncedValidate(parsedValue);
    }
  };

  // Handle blur event for final formatting
  const handleBlur = () => {
    const parsedValue = parseValue(inputValue);
    if (!isNaN(parsedValue)) {
      setInputValue(formatValue(parsedValue, metricDefinition.unit));
    }
  };

  // Update input value when prop value changes
  useEffect(() => {
    setInputValue(formatValue(value, metricDefinition.unit));
  }, [value, metricDefinition.unit]);

  // Generate helper text from validation state
  const getHelperText = (): string => {
    if (validationState.errors.length > 0) {
      return validationState.errors[0];
    }
    if (validationState.warnings.length > 0) {
      return validationState.warnings[0];
    }
    return metricDefinition.description;
  };

  // Generate ARIA label
  const getAriaLabel = (): string => {
    return ariaLabel || `${metricDefinition.name} input - ${metricDefinition.description}`;
  };

  return (
    <Input
      id={`metric-${metricDefinition.id}`}
      label={metricDefinition.name}
      value={inputValue}
      onChange={handleInputChange}
      onBlur={handleBlur}
      type="text"
      error={!validationState.isValid}
      helperText={getHelperText()}
      required={metricDefinition.validationRules.some(rule => rule.required)}
      disabled={disabled}
      ariaLabel={getAriaLabel()}
      validationPattern={new RegExp(`^[0-9.-]+${metricDefinition.unit === MetricUnit.PERCENTAGE ? '%?' : ''}$`)}
    />
  );
};

export default MetricInput;