// @package react v18.2.0
import { useState, useCallback, useEffect } from 'react';

// Notification type enum for different notification states
export enum NotificationType {
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

// Interface for notification object structure
interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  duration: number;
  timestamp: number;
  ariaLive: 'polite' | 'assertive';
  role: 'alert' | 'status';
}

// Interface for notification creation options
interface ShowNotificationOptions {
  message: string;
  type: NotificationType;
  duration?: number;
  ariaLive?: 'polite' | 'assertive';
  role?: 'alert' | 'status';
}

/**
 * Custom hook for managing notification state and behavior with accessibility support
 * @returns Object containing notifications array and management functions
 */
export const useNotification = () => {
  // State for storing active notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  // Map to store auto-dismiss timer references
  const timerRefs = new Map<string, NodeJS.Timeout>();

  /**
   * Shows a new notification with specified options and accessibility support
   * @param options ShowNotificationOptions object
   * @returns Generated notification ID
   */
  const showNotification = useCallback((options: ShowNotificationOptions): string => {
    // Validate required options
    if (!options.message) {
      throw new Error('Notification message is required');
    }

    // Generate unique ID for the notification
    const id = crypto.randomUUID();

    // Create notification object with defaults
    const notification: Notification = {
      id,
      message: options.message,
      type: options.type,
      duration: options.duration ?? 5000, // Default 5 seconds
      timestamp: Date.now(),
      ariaLive: options.ariaLive ?? (options.type === NotificationType.ERROR ? 'assertive' : 'polite'),
      role: options.role ?? (options.type === NotificationType.ERROR ? 'alert' : 'status')
    };

    // Add notification to state
    setNotifications(prev => [...prev, notification]);

    // Set up auto-dismiss timer if duration is provided
    if (notification.duration > 0) {
      const timer = setTimeout(() => {
        hideNotification(id);
      }, notification.duration);

      timerRefs.set(id, timer);
    }

    return id;
  }, []);

  /**
   * Removes a notification by its ID and cleans up associated timer
   * @param id Notification ID to remove
   */
  const hideNotification = useCallback((id: string): void => {
    // Clear auto-dismiss timer if exists
    const timer = timerRefs.get(id);
    if (timer) {
      clearTimeout(timer);
      timerRefs.delete(id);
    }

    // Remove notification from state
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  /**
   * Removes all notifications and cleans up all timers
   */
  const clearAllNotifications = useCallback((): void => {
    // Clear all auto-dismiss timers
    timerRefs.forEach(timer => clearTimeout(timer));
    timerRefs.clear();

    // Clear all notifications
    setNotifications([]);
  }, []);

  /**
   * Cleanup effect to clear timers when component unmounts
   */
  useEffect(() => {
    return () => {
      timerRefs.forEach(timer => clearTimeout(timer));
      timerRefs.clear();
    };
  }, []);

  return {
    notifications,
    showNotification,
    hideNotification,
    clearAllNotifications
  };
};