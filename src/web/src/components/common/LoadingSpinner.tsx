import React from 'react';
import { CircularProgress, Box, styled } from '@mui/material'; // @mui/material v5.0.0
import { palette } from '../../assets/styles/theme';

// Props interface for the LoadingSpinner component
interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large' | number;
  color?: string;
  overlay?: boolean;
}

// Size mapping for predefined size options
const sizeMap = {
  small: 24,
  medium: 40,
  large: 56,
};

// Styled container for the spinner component
const SpinnerWrapper = styled(Box)({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '16px', // Using theme spacing(2)
  position: 'relative',
});

// Styled overlay for blocking background interactions
const SpinnerOverlay = styled(Box)({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(255, 255, 255, 0.8)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1300,
});

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  color = palette.primary.main,
  overlay = false,
}) => {
  // Calculate the actual size value
  const spinnerSize = typeof size === 'string' ? sizeMap[size] : size;

  // Common CircularProgress props
  const progressProps = {
    size: spinnerSize,
    color: 'primary' as const,
    sx: { color },
    variant: 'indeterminate' as const,
    thickness: 3.6,
    disableShrink: false,
    // Accessibility attributes
    role: 'progressbar',
    'aria-label': 'Loading content...',
    'aria-busy': true,
    'aria-live': 'polite',
  };

  // Render spinner with or without overlay
  if (overlay) {
    return (
      <SpinnerOverlay>
        <CircularProgress {...progressProps} />
      </SpinnerOverlay>
    );
  }

  return (
    <SpinnerWrapper>
      <CircularProgress {...progressProps} />
    </SpinnerWrapper>
  );
};

export default LoadingSpinner;