import React, { useCallback, useRef, useState } from 'react';
import { Select, MenuItem, FormControl, InputLabel } from '@mui/material'; // @mui/material v5.0.0
import { styled } from '@mui/material/styles';
import { theme } from '../../assets/styles/theme';

// Interfaces
export interface IDropdownOption {
  value: string;
  label: string;
  data?: any;
  disabled?: boolean;
  group?: string;
}

export interface IDropdownProps {
  id: string;
  label: string;
  options: IDropdownOption[];
  value: string | string[];
  multiple: boolean;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  onChange: (value: string | string[]) => void;
  loading?: boolean;
  placeholder?: string;
  maxHeight?: number;
  searchable?: boolean;
  size?: 'small' | 'medium';
}

// Styled components
const StyledFormControl = styled(FormControl)(({ theme }) => ({
  width: '100%',
  marginBottom: theme.spacing(2),
  '& .MuiInputLabel-root': {
    color: theme.palette.text.primary,
    ...theme.typography.body1,
    '&.Mui-required': {
      '& .MuiInputLabel-asterisk': {
        color: theme.palette.error.main,
      },
    },
  },
  '& .MuiOutlinedInput-root': {
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: theme.palette.primary.hover,
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: theme.palette.primary.main,
      borderWidth: 2,
    },
    '&.Mui-error .MuiOutlinedInput-notchedOutline': {
      borderColor: theme.palette.error.main,
    },
  },
  '& .MuiSelect-select': {
    ...theme.typography.body1,
    padding: theme.spacing(1.5),
  },
}));

const StyledMenuItem = styled(MenuItem)(({ theme }) => ({
  ...theme.typography.body1,
  padding: theme.spacing(1, 2),
  '&.Mui-selected': {
    backgroundColor: theme.palette.primary.light + '1A', // 10% opacity
    '&:hover': {
      backgroundColor: theme.palette.primary.light + '33', // 20% opacity
    },
  },
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
  '&.Mui-disabled': {
    opacity: 0.5,
  },
}));

const Dropdown: React.FC<IDropdownProps> = ({
  id,
  label,
  options,
  value,
  multiple,
  disabled = false,
  required = false,
  error,
  onChange,
  loading = false,
  placeholder,
  maxHeight = 300,
  searchable = false,
  size = 'medium',
}) => {
  const [searchText, setSearchText] = useState('');
  const selectRef = useRef<HTMLSelectElement>(null);
  const labelId = `${id}-label`;

  // Filter options based on search text
  const filteredOptions = searchable
    ? options.filter(option =>
        option.label.toLowerCase().includes(searchText.toLowerCase())
      )
    : options;

  // Handle selection change
  const handleChange = useCallback(
    (event: React.ChangeEvent<{ value: unknown }>) => {
      event.preventDefault();
      const newValue = event.target.value;
      
      // Format value based on multiple selection mode
      const formattedValue = multiple
        ? (Array.isArray(newValue) ? newValue : [newValue]) as string[]
        : (newValue as string);

      // Announce selection change to screen readers
      const selectedLabel = multiple
        ? (formattedValue as string[])
            .map(v => options.find(opt => opt.value === v)?.label)
            .join(', ')
        : options.find(opt => opt.value === formattedValue)?.label;

      const announcement = multiple
        ? `Selected: ${selectedLabel}`
        : `Selected ${selectedLabel}`;
      
      // Create and dispatch announcement
      const ariaLive = document.createElement('div');
      ariaLive.setAttribute('aria-live', 'polite');
      ariaLive.innerText = announcement;
      document.body.appendChild(ariaLive);
      setTimeout(() => document.body.removeChild(ariaLive), 1000);

      onChange(formattedValue);
    },
    [multiple, onChange, options]
  );

  // Handle keyboard navigation
  const handleKeyboardNavigation = useCallback(
    (event: React.KeyboardEvent) => {
      if (searchable && event.key.length === 1) {
        setSearchText(prev => prev + event.key);
        setTimeout(() => setSearchText(''), 1000);
      }

      switch (event.key) {
        case 'Escape':
          selectRef.current?.blur();
          break;
        case 'Home':
          event.preventDefault();
          const firstOption = filteredOptions.find(opt => !opt.disabled);
          if (firstOption) {
            onChange(multiple ? [firstOption.value] : firstOption.value);
          }
          break;
        case 'End':
          event.preventDefault();
          const lastOption = [...filteredOptions].reverse().find(opt => !opt.disabled);
          if (lastOption) {
            onChange(multiple ? [lastOption.value] : lastOption.value);
          }
          break;
      }
    },
    [filteredOptions, multiple, onChange, searchable]
  );

  return (
    <StyledFormControl
      error={!!error}
      disabled={disabled || loading}
      required={required}
      size={size}
    >
      <InputLabel
        id={labelId}
        required={required}
        error={!!error}
      >
        {label}
      </InputLabel>
      <Select
        id={id}
        labelId={labelId}
        value={value}
        multiple={multiple}
        onChange={handleChange}
        onKeyDown={handleKeyboardNavigation}
        inputRef={selectRef}
        displayEmpty
        renderValue={(selected) => {
          if (!selected || (Array.isArray(selected) && selected.length === 0)) {
            return <em>{placeholder || 'Select an option'}</em>;
          }
          const selectedLabels = Array.isArray(selected)
            ? selected.map(v => options.find(opt => opt.value === v)?.label)
            : options.find(opt => opt.value === selected)?.label;
          return selectedLabels;
        }}
        MenuProps={{
          PaperProps: {
            style: {
              maxHeight,
            },
          },
          variant: 'menu',
          getContentAnchorEl: null,
          anchorOrigin: {
            vertical: 'bottom',
            horizontal: 'left',
          },
        }}
        aria-label={label}
        aria-invalid={!!error}
        aria-errormessage={error ? `${id}-error` : undefined}
      >
        {loading ? (
          <StyledMenuItem disabled>Loading...</StyledMenuItem>
        ) : filteredOptions.length === 0 ? (
          <StyledMenuItem disabled>No options available</StyledMenuItem>
        ) : (
          filteredOptions.map((option) => (
            <StyledMenuItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              aria-label={option.label}
            >
              {option.label}
            </StyledMenuItem>
          ))
        )}
      </Select>
      {error && (
        <div
          id={`${id}-error`}
          role="alert"
          style={{
            color: theme.palette.error.main,
            ...theme.typography.body2,
            marginTop: theme.spacing(0.5),
          }}
        >
          {error}
        </div>
      )}
    </StyledFormControl>
  );
};

export default Dropdown;