import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import styled from '@mui/material/styles/styled';
import Popper from '@mui/material/Popper';
import { theme } from '../assets/styles/theme';

// Styled component for the tooltip container
const TooltipContainer = styled('div')(({ theme }) => ({
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.common.white,
  padding: theme.spacing(1, 1.5),
  borderRadius: theme.shape.borderRadius,
  fontSize: theme.typography.body2.fontSize,
  maxWidth: 220,
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  zIndex: theme.zIndex.tooltip,
  pointerEvents: 'none',
  transition: 'opacity 200ms ease-in-out',
  opacity: 0,
  '&.visible': {
    opacity: 1,
  },
  '@media (prefers-contrast: high)': {
    border: '1px solid currentColor',
    backgroundColor: theme.palette.common.black,
    color: theme.palette.common.white,
  },
}));

// Interface for tooltip props
export interface TooltipProps {
  children: React.ReactElement;
  content: React.ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 
               'bottom-start' | 'bottom-end' | 'left-start' | 'left-end' | 
               'right-start' | 'right-end';
  delay?: number;
  className?: string;
  ariaLabel?: string;
  id?: string;
  onOpen?: () => void;
  onClose?: () => void;
}

// Function to calculate optimal tooltip position
const getTooltipPosition = (
  placement: string,
  triggerRect: DOMRect,
  tooltipRect: DOMRect,
  windowSize: { width: number; height: number }
) => {
  const spacing = parseInt(theme.spacing(1).replace('px', ''));
  let top = 0;
  let left = 0;
  let finalPlacement = placement;

  // Calculate initial position
  switch (placement) {
    case 'top':
    case 'top-start':
    case 'top-end':
      top = triggerRect.top - tooltipRect.height - spacing;
      left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
      // Flip to bottom if not enough space
      if (top < 0) {
        top = triggerRect.bottom + spacing;
        finalPlacement = 'bottom';
      }
      break;
    // Add similar cases for other placements
    default:
      top = triggerRect.bottom + spacing;
      left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
  }

  // Ensure tooltip stays within viewport
  left = Math.max(spacing, Math.min(left, windowSize.width - tooltipRect.width - spacing));
  
  return { top, left, placement: finalPlacement };
};

export const Tooltip = memo(({
  children,
  content,
  placement = 'top',
  delay = 200,
  className,
  ariaLabel,
  id,
  onOpen,
  onClose,
}: TooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const triggerRef = useRef<HTMLDivElement>(null);

  const showTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      onOpen?.();
    }, delay);
  }, [delay, onOpen]);

  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
    onClose?.();
  }, [onClose]);

  // Handle keyboard interactions
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && isVisible) {
      hideTooltip();
    }
  }, [hideTooltip, isVisible]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [handleKeyDown]);

  // Clone child element to add event handlers
  const trigger = React.cloneElement(children, {
    ref: triggerRef,
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      setAnchorEl(e.currentTarget);
      showTooltip();
    },
    onMouseLeave: hideTooltip,
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      setAnchorEl(e.currentTarget);
      showTooltip();
    },
    onBlur: hideTooltip,
    'aria-describedby': id,
  });

  return (
    <>
      {trigger}
      <Popper
        id={id}
        open={isVisible}
        anchorEl={anchorEl}
        placement={placement}
        transition
        modifiers={[
          {
            name: 'preventOverflow',
            options: {
              boundary: window,
              padding: 8,
            },
          },
          {
            name: 'flip',
            options: {
              fallbackPlacements: ['top', 'bottom', 'left', 'right'],
            },
          },
        ]}
      >
        <TooltipContainer
          className={`${className || ''} ${isVisible ? 'visible' : ''}`}
          role="tooltip"
          aria-label={ariaLabel}
        >
          {content}
        </TooltipContainer>
      </Popper>
    </>
  );
});

Tooltip.displayName = 'Tooltip';

export default Tooltip;