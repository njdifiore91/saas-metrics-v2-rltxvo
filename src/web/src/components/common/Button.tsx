import React from 'react'; // v18.2.0
import { Button as MuiButton, CircularProgress } from '@mui/material'; // v5.0.0
import styled from '@mui/material/styles/styled'; // v5.0.0
import { palette, spacing, transitions } from '../../assets/styles/theme';

// Button Props Interface
export interface ButtonProps {
  variant?: 'contained' | 'outlined' | 'text';
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info';
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  ariaLabel?: string;
  tabIndex?: number;
}

// Styled Button Component
const StyledButton = styled(MuiButton)(({ theme, size, color, loading }) => ({
  fontFamily: theme.typography.fontFamily,
  fontWeight: theme.typography.button?.fontWeight || 500,
  padding: {
    small: theme.spacing(1, 2),
    medium: theme.spacing(1.5, 3),
    large: theme.spacing(2, 4),
  }[size || 'medium'],
  
  // Color and state styles
  backgroundColor: loading ? theme.palette[color || 'primary'].light : undefined,
  color: theme.palette[color || 'primary'].contrastText,
  
  // Transition effects
  transition: theme.transitions.create(
    ['background-color', 'box-shadow', 'border-color', 'opacity'],
    {
      duration: theme.transitions.duration.short,
    }
  ),

  // Hover state
  '&:hover': {
    backgroundColor: !loading && theme.palette[color || 'primary'].hover,
    cursor: loading ? 'default' : 'pointer',
  },

  // Active state
  '&:active': {
    backgroundColor: theme.palette[color || 'primary'].dark,
  },

  // Focus visible state for keyboard navigation
  '&.Mui-focusVisible': {
    outline: `2px solid ${theme.palette[color || 'primary'].main}`,
    outlineOffset: 2,
  },

  // Disabled state
  '&.Mui-disabled': {
    opacity: 0.6,
    cursor: 'not-allowed',
  },

  // Loading state styles
  position: 'relative',
  '.MuiCircularProgress-root': {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -12,
    marginTop: -12,
  },

  // Icon spacing
  '.MuiButton-startIcon': {
    marginRight: theme.spacing(1),
  },
  '.MuiButton-endIcon': {
    marginLeft: theme.spacing(1),
  },

  // Full width support
  width: props => props.fullWidth ? '100%' : 'auto',

  // High contrast mode support
  '@media (forced-colors: active)': {
    border: '1px solid currentColor',
  },
}));

// Button Component
export const Button = React.memo<ButtonProps>(({
  variant = 'contained',
  size = 'medium',
  color = 'primary',
  fullWidth = false,
  disabled = false,
  loading = false,
  startIcon,
  endIcon,
  onClick,
  onKeyDown,
  children,
  className,
  type = 'button',
  ariaLabel,
  tabIndex = 0,
  ...props
}) => {
  // Memoize event handlers
  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (!loading && !disabled && onClick) {
        onClick(event);
      }
    },
    [loading, disabled, onClick]
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (!loading && !disabled && onKeyDown) {
        onKeyDown(event);
      }
    },
    [loading, disabled, onKeyDown]
  );

  return (
    <StyledButton
      variant={variant}
      size={size}
      color={color}
      fullWidth={fullWidth}
      disabled={disabled || loading}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={className}
      type={type}
      aria-label={ariaLabel}
      aria-busy={loading}
      aria-disabled={disabled || loading}
      tabIndex={disabled ? -1 : tabIndex}
      startIcon={!loading && startIcon}
      endIcon={!loading && endIcon}
      {...props}
    >
      {loading && <CircularProgress size={24} color="inherit" />}
      <span style={{ visibility: loading ? 'hidden' : 'visible' }}>
        {children}
      </span>
    </StyledButton>
  );
});

Button.displayName = 'Button';

export default Button;