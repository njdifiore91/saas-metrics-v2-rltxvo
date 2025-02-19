import React, { useCallback, useState } from 'react';
import { styled } from '@mui/material/styles'; // @mui/material v5.0.0
import { TextField } from '@mui/material'; // @mui/material v5.0.0
import { theme } from '../../assets/styles/theme';

// Interface for Input component props
interface InputProps {
  id: string;
  label: string;
  value: string | number;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  type?: 'text' | 'number' | 'email' | 'password' | 'tel' | 'url';
  validationPattern?: RegExp;
  mask?: string;
  error?: boolean;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}

// Styled TextField component with enhanced styling and states
const StyledTextField = styled(TextField)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  width: '100%',
  fontFamily: theme.typography.fontFamily,
  fontSize: theme.typography.body1.fontSize,
  transition: 'all 0.2s ease-in-out',

  '& .MuiInputBase-root': {
    padding: theme.spacing(1.5),
    borderRadius: 4,
    outline: 'none',
    border: `1px solid ${theme.palette.grey[300]}`,

    '&.Mui-focused': {
      borderColor: theme.palette.primary.main,
      boxShadow: `0 0 0 2px ${theme.palette.primary.light}`,
    },

    '&.Mui-error': {
      color: theme.palette.error.main,
      borderColor: theme.palette.error.main,
      backgroundColor: `${theme.palette.error.light}10`,
    },

    '&.Mui-disabled': {
      backgroundColor: theme.palette.action.disabledBackground,
      color: theme.palette.action.disabled,
      cursor: 'not-allowed',
    },
  },

  '& .MuiInputLabel-root': {
    color: theme.palette.text.primary,
    fontSize: theme.typography.body2.fontSize,
    transform: 'translate(14px, 16px) scale(1)',

    '&.Mui-focused': {
      color: theme.palette.primary.main,
    },

    '&.Mui-error': {
      color: theme.palette.error.main,
    },
  },

  '& .MuiFormHelperText-root': {
    marginLeft: theme.spacing(1),
    fontSize: '0.75rem',

    '&.Mui-error': {
      color: theme.palette.error.main,
    },
  },
}));

const Input: React.FC<InputProps> = ({
  id,
  label,
  value,
  onChange,
  type = 'text',
  validationPattern,
  mask,
  error = false,
  helperText,
  required = false,
  disabled = false,
  ariaLabel,
}) => {
  const [internalError, setInternalError] = useState<boolean>(error);
  const [touched, setTouched] = useState<boolean>(false);

  // Debounced validation handler
  const validateInput = useCallback(
    (value: string | number) => {
      if (!validationPattern || !touched) return true;
      return validationPattern.test(String(value));
    },
    [validationPattern, touched]
  );

  // Handle input change with validation and masking
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = event.target.value;

    // Apply input mask if specified
    if (mask) {
      newValue = applyInputMask(newValue, mask);
    }

    // Validate input value
    const isValid = validateInput(newValue);
    setInternalError(!isValid);

    // Call parent onChange handler
    onChange(event);
  };

  // Apply input mask pattern
  const applyInputMask = (value: string, mask: string): string => {
    let maskedValue = '';
    let valueIndex = 0;

    for (let i = 0; i < mask.length && valueIndex < value.length; i++) {
      if (mask[i] === '#') {
        if (/\d/.test(value[valueIndex])) {
          maskedValue += value[valueIndex];
          valueIndex++;
        }
      } else if (mask[i] === 'A') {
        if (/[a-zA-Z]/.test(value[valueIndex])) {
          maskedValue += value[valueIndex];
          valueIndex++;
        }
      } else {
        maskedValue += mask[i];
        if (value[valueIndex] === mask[i]) {
          valueIndex++;
        }
      }
    }

    return maskedValue;
  };

  // Handle focus event
  const handleFocus = () => {
    setTouched(true);
  };

  return (
    <StyledTextField
      id={id}
      label={label}
      value={value}
      onChange={handleChange}
      onFocus={handleFocus}
      type={type}
      error={internalError || error}
      helperText={helperText}
      required={required}
      disabled={disabled}
      fullWidth
      variant="outlined"
      InputLabelProps={{
        shrink: true,
      }}
      inputProps={{
        'aria-label': ariaLabel || label,
        'aria-required': required,
        'aria-invalid': internalError || error,
        'aria-describedby': helperText ? `${id}-helper-text` : undefined,
      }}
      FormHelperTextProps={{
        id: `${id}-helper-text`,
        role: internalError || error ? 'alert' : undefined,
      }}
    />
  );
};

export default Input;