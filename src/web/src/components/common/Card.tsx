// @mui/material v5.0.0
// react v18.2.0
import React from 'react';
import { styled } from '@mui/material/styles';
import Paper from '@mui/material/Paper';
import { theme } from '../../assets/styles/theme';

// Props interface for the Card component
export interface CardProps {
  children: React.ReactNode;
  elevation?: number;
  className?: string;
  onClick?: () => void;
  padding?: string | number;
  borderRadius?: number;
  role?: string;
  ariaLabel?: string;
}

// Enhanced styled Paper component with improved accessibility and animations
const StyledCard = styled(Paper, {
  shouldForwardProp: (prop) => 
    !['padding', 'borderRadius', 'ariaLabel'].includes(prop as string),
})<Omit<CardProps, 'children' | 'className'>>(({ 
  onClick, 
  elevation = 1,
  padding = 2,
  borderRadius = 1
}) => ({
  backgroundColor: theme.palette.background.paper,
  borderRadius: `${borderRadius * theme.shape.borderRadius}px`,
  padding: theme.spacing(padding),
  transition: `all ${theme.transitions.duration.short}ms ${theme.transitions.easing.easeInOut}`,
  position: 'relative',
  overflow: 'hidden',
  cursor: onClick ? 'pointer' : 'default',

  // Interactive states
  '&:hover': {
    transform: onClick ? 'translateY(-2px)' : 'none',
    boxShadow: onClick 
      ? theme.shadows[elevation + 1] 
      : theme.shadows[elevation],
  },

  // Focus state for accessibility
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
    boxShadow: theme.shadows[2],
  },

  // Active state for interactive cards
  '&:active': {
    transform: onClick ? 'translateY(1px)' : 'none',
  },

  // Touch device optimizations
  '@media (hover: none)': {
    '&:hover': {
      transform: 'none',
      boxShadow: theme.shadows[elevation],
    },
  },
}));

/**
 * A reusable card component that provides a contained, elevated surface for displaying content.
 * Implements the application's design system with consistent styling, spacing, and elevation.
 */
export const Card: React.FC<CardProps> = ({
  children,
  elevation = 1,
  className,
  onClick,
  padding = 2,
  borderRadius = 1,
  role,
  ariaLabel,
  ...props
}) => {
  // Determine appropriate ARIA role based on interactivity
  const defaultRole = onClick ? 'button' : 'article';
  const computedRole = role || defaultRole;

  // Determine tabIndex based on interactivity
  const tabIndex = onClick ? 0 : undefined;

  return (
    <StyledCard
      elevation={elevation}
      className={className}
      onClick={onClick}
      padding={padding}
      borderRadius={borderRadius}
      role={computedRole}
      aria-label={ariaLabel}
      tabIndex={tabIndex}
      component={onClick ? 'button' : 'div'}
      {...props}
    >
      {children}
    </StyledCard>
  );
};

// Default export for the Card component
export default Card;