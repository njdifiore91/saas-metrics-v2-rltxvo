import React, { useCallback, useMemo } from 'react';
import { Box } from '@mui/material'; // @mui/material v5.0.0
import { useDebounce } from 'use-debounce'; // v9.0.4
import Dropdown from '../common/Dropdown';
import { useMetrics } from '../../hooks/useMetrics';

// Interface for component props
interface IRevenueFilterProps {
  selectedRange: string;
  onRangeChange: (range: string) => void;
  disabled?: boolean;
  isError?: boolean;
  errorMessage?: string;
}

// Revenue range options with validation rules
const REVENUE_RANGES = [
  {
    value: '<$1M',
    label: 'Less than $1M',
    data: {
      description: 'Companies with annual revenue below $1 million',
      validation: 'revenue < 1000000'
    }
  },
  {
    value: '$1M-$5M',
    label: '$1M to $5M',
    data: {
      description: 'Companies with annual revenue between $1M and $5M',
      validation: '1000000 <= revenue <= 5000000'
    }
  },
  {
    value: '$5M-$20M',
    label: '$5M to $20M',
    data: {
      description: 'Companies with annual revenue between $5M and $20M',
      validation: '5000000 <= revenue <= 20000000'
    }
  },
  {
    value: '>$20M',
    label: 'More than $20M',
    data: {
      description: 'Companies with annual revenue exceeding $20M',
      validation: 'revenue > 20000000'
    }
  }
];

/**
 * RevenueFilter component provides a dropdown for selecting company revenue ranges
 * with accessibility support and metric refresh functionality.
 */
const RevenueFilter: React.FC<IRevenueFilterProps> = ({
  selectedRange,
  onRangeChange,
  disabled = false,
  isError = false,
  errorMessage
}) => {
  // Get metric refresh functionality from useMetrics hook
  const { refreshMetrics, isLoading } = useMetrics();

  // Create debounced refresh function to prevent excessive API calls
  const [debouncedRefresh] = useDebounce(refreshMetrics, 500);

  // Validate revenue range selection
  const validateRevenueRange = useCallback((range: string): boolean => {
    return REVENUE_RANGES.some(option => option.value === range);
  }, []);

  // Handle revenue range change with validation
  const handleRevenueRangeChange = useCallback((value: string) => {
    if (!validateRevenueRange(value)) {
      console.error('Invalid revenue range selected:', value);
      return;
    }

    onRangeChange(value);
    debouncedRefresh();
  }, [onRangeChange, debouncedRefresh, validateRevenueRange]);

  // Memoize dropdown options to prevent unnecessary re-renders
  const dropdownOptions = useMemo(() => 
    REVENUE_RANGES.map(range => ({
      value: range.value,
      label: range.label,
      data: range.data
    })), 
  []);

  return (
    <Box
      sx={{
        width: { xs: '100%', sm: '250px' },
        mb: 2
      }}
    >
      <Dropdown
        id="revenue-range-filter"
        label="Revenue Range"
        options={dropdownOptions}
        value={selectedRange}
        onChange={handleRevenueRangeChange}
        disabled={disabled || isLoading}
        error={isError ? errorMessage : undefined}
        required
        multiple={false}
        loading={isLoading}
        placeholder="Select revenue range"
        searchable={false}
        size="medium"
      />
    </Box>
  );
};

export default RevenueFilter;