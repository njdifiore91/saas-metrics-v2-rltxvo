import React from 'react'; // v18.2.0
import { Modal as MuiModal, Fade } from '@mui/material'; // v5.0.0
import { styled } from '@mui/material/styles'; // v5.0.0
import { FocusTrap } from '@mui/base'; // v5.0.0
import { palette, spacing, transitions, breakpoints } from '../../assets/styles/theme';
import Button from './Button';

// Props interface for the Modal component
export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | number;
  fullWidth?: boolean;
  showCloseButton?: boolean;
  className?: string;
  disableBackdropClick?: boolean;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  testId?: string;
  transitionDuration?: number;
  transitionTimingFunction?: string;
  onTransitionEnd?: () => void;
  initialFocusRef?: React.RefObject<HTMLElement>;
  returnFocusOnClose?: boolean;
}

// Styled components
const StyledModalContainer = styled('div')(({ theme, maxWidth }) => ({
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[8],
  outline: 'none',
  maxWidth: (() => {
    if (typeof maxWidth === 'number') return maxWidth;
    const widths = { sm: 600, md: 900, lg: 1200 };
    return widths[maxWidth as keyof typeof widths] || widths.md;
  })(),
  width: '90%',
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  WebkitOverflowScrolling: 'touch',
  
  [theme.breakpoints.down('sm')]: {
    width: '95%',
    maxHeight: '95vh',
  },

  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },

  '@media (forced-colors: active)': {
    border: '1px solid currentColor',
  },
}));

const StyledModalHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: theme.spacing(2, 3),
  borderBottom: `1px solid ${theme.palette.divider}`,
  
  '& h2': {
    margin: 0,
    fontFamily: theme.typography.h6.fontFamily,
    fontSize: theme.typography.h6.fontSize,
    fontWeight: theme.typography.h6.fontWeight,
    color: theme.palette.text.primary,
  },

  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1.5, 2),
  },
}));

const StyledModalContent = styled('div')(({ theme }) => ({
  padding: theme.spacing(3),
  overflowY: 'auto',
  flexGrow: 1,
  '-webkit-overflow-scrolling': 'touch',
  
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
  },
}));

// Modal Component
export const Modal = React.memo<ModalProps>(({
  open,
  onClose,
  title,
  children,
  maxWidth = 'md',
  fullWidth = false,
  showCloseButton = true,
  className,
  disableBackdropClick = false,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  testId,
  transitionDuration = 300,
  transitionTimingFunction = 'ease-in-out',
  onTransitionEnd,
  initialFocusRef,
  returnFocusOnClose = true,
}) => {
  // Track backdrop click start position
  const backdropClickRef = React.useRef<{ x: number; y: number } | null>(null);

  // Handle backdrop click
  const handleBackdropClick = React.useCallback((event: React.MouseEvent) => {
    if (disableBackdropClick) return;

    const isBackdrop = event.target === event.currentTarget;
    if (!isBackdrop) return;

    const clickPosition = { x: event.clientX, y: event.clientY };
    
    if (backdropClickRef.current) {
      const startPos = backdropClickRef.current;
      const threshold = 5;
      
      if (Math.abs(startPos.x - clickPosition.x) <= threshold &&
          Math.abs(startPos.y - clickPosition.y) <= threshold) {
        onClose();
      }
    }
    
    backdropClickRef.current = null;
  }, [disableBackdropClick, onClose]);

  // Handle escape key
  const handleEscapeKeydown = React.useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  }, [onClose]);

  // Handle transition end
  const handleTransitionEnd = React.useCallback(() => {
    if (onTransitionEnd) {
      onTransitionEnd();
    }
  }, [onTransitionEnd]);

  // Effect for escape key handling
  React.useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleEscapeKeydown);
      return () => {
        document.removeEventListener('keydown', handleEscapeKeydown);
      };
    }
  }, [open, handleEscapeKeydown]);

  const modalId = ariaLabelledBy || 'modal-title';
  const contentId = ariaDescribedBy || 'modal-content';

  return (
    <MuiModal
      open={open}
      onClose={onClose}
      closeAfterTransition
      aria-labelledby={modalId}
      aria-describedby={contentId}
      data-testid={testId}
    >
      <Fade
        in={open}
        timeout={transitionDuration}
        easing={transitionTimingFunction}
        onTransitionEnd={handleTransitionEnd}
      >
        <StyledModalContainer
          maxWidth={maxWidth}
          className={className}
          onClick={handleBackdropClick}
          role="dialog"
          aria-modal="true"
        >
          <FocusTrap
            open={open}
            disableAutoFocus={!!initialFocusRef}
            disableEnforceFocus={false}
          >
            <div>
              <StyledModalHeader>
                <h2 id={modalId}>{title}</h2>
                {showCloseButton && (
                  <Button
                    variant="text"
                    color="primary"
                    onClick={onClose}
                    aria-label="Close modal"
                    size="small"
                  >
                    Close
                  </Button>
                )}
              </StyledModalHeader>
              <StyledModalContent id={contentId}>
                {children}
              </StyledModalContent>
            </div>
          </FocusTrap>
        </StyledModalContainer>
      </Fade>
    </MuiModal>
  );
});

Modal.displayName = 'Modal';

export default Modal;