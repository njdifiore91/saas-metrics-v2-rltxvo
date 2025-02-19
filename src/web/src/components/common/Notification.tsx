// @package react v18.2.0
import React from 'react';
// @package @mui/material v5.0.0
import { Alert, Slide } from '@mui/material';
import { styled } from '@mui/material/styles';
// Internal imports
import { useNotification, NotificationType } from '../../hooks/useNotification';
import theme from '../../assets/styles/theme';

// Styled container for notifications with responsive positioning
const NotificationContainer = styled('div')({
  position: 'fixed',
  top: theme.spacing(3),
  right: theme.spacing(3),
  zIndex: theme.zIndex.snackbar,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  [`@media (max-width: ${theme.breakpoints.values.sm}px)`]: {
    top: theme.spacing(2),
    right: theme.spacing(2),
    left: theme.spacing(2),
  },
});

// Styled wrapper for individual notifications with animation support
const NotificationWrapper = styled('div')({
  minWidth: 300,
  maxWidth: `min(400px, calc(100vw - ${theme.spacing(4)}))`,
  opacity: 1,
  transition: `opacity ${theme.transitions.duration.standard}ms ${theme.transitions.easing.easeInOut}`,
  '&[aria-hidden="true"]': {
    opacity: 0,
  },
});

/**
 * Maps notification types to semantic MUI Alert severities with RFC 7807 support
 * @param type NotificationType
 * @returns Semantic severity for MUI Alert
 */
const getAlertSeverity = (type: NotificationType): 'success' | 'error' | 'warning' | 'info' => {
  const severityMap = {
    [NotificationType.SUCCESS]: 'success',
    [NotificationType.ERROR]: 'error',
    [NotificationType.WARNING]: 'warning',
    [NotificationType.INFO]: 'info',
  } as const;

  return severityMap[type];
};

/**
 * Notification component that displays toast-style messages with accessibility support
 * Implements RFC 7807 Problem Details for API errors and follows design system
 */
const Notification: React.FC = () => {
  const { notifications, hideNotification } = useNotification();

  return (
    <NotificationContainer role="log" aria-live="polite" aria-atomic="true">
      {notifications.map((notification) => (
        <Slide
          key={notification.id}
          direction="left"
          in={true}
          mountOnEnter
          unmountOnExit
          timeout={{
            enter: theme.transitions.duration.standard,
            exit: theme.transitions.duration.standard,
          }}
        >
          <NotificationWrapper
            role={notification.role}
            aria-live={notification.ariaLive}
            aria-atomic="true"
          >
            <Alert
              severity={getAlertSeverity(notification.type)}
              onClose={() => hideNotification(notification.id)}
              sx={{
                width: '100%',
                boxShadow: theme.shadows[2],
                '& .MuiAlert-message': {
                  width: '100%',
                },
                '& .MuiAlert-icon': {
                  alignItems: 'center',
                },
                backgroundColor: (theme) => {
                  switch (notification.type) {
                    case NotificationType.SUCCESS:
                      return theme.palette.success.light;
                    case NotificationType.ERROR:
                      return theme.palette.error.light;
                    case NotificationType.WARNING:
                      return theme.palette.warning.light;
                    case NotificationType.INFO:
                      return theme.palette.info.light;
                    default:
                      return theme.palette.background.paper;
                  }
                },
              }}
            >
              {notification.message}
            </Alert>
          </NotificationWrapper>
        </Slide>
      ))}
    </NotificationContainer>
  );
};

export default Notification;