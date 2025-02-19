// @package react v18.2.0
import React from 'react';

// Internal imports
import { DEFAULT_ERROR_MESSAGE, ERROR_SEVERITY } from '../../constants/error.constants';
import Notification from './Notification';

// Interface for ErrorBoundary props
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

// Interface for ErrorBoundary state
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
  notificationKey: string | undefined;
}

/**
 * ErrorBoundary component that catches JavaScript errors in child components,
 * logs them, and displays an accessible fallback UI
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      notificationKey: undefined
    };
  }

  /**
   * Static method to update state when an error occurs
   * @param error The error that was caught
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      notificationKey: crypto.randomUUID()
    };
  }

  /**
   * Lifecycle method called after an error is caught
   * Handles error logging and notification
   * @param error The error that was caught
   * @param errorInfo React error info object
   */
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error to monitoring service
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Update state with error details
    this.setState({
      errorInfo: errorInfo.componentStack
    });

    // Call onError prop if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Set focus to error message for accessibility
    const errorElement = document.getElementById('error-notification');
    if (errorElement) {
      errorElement.focus();
    }
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      // Render fallback UI if provided, otherwise show error notification
      const fallbackUI = this.props.fallback || (
        <div
          role="alert"
          aria-live="assertive"
          id="error-notification"
          tabIndex={-1}
          style={{ outline: 'none' }}
        >
          <Notification
            key={this.state.notificationKey}
            type={ERROR_SEVERITY.ERROR}
            message={this.state.error?.message || DEFAULT_ERROR_MESSAGE}
            role="alert"
            ariaLive="assertive"
          />
          {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
            <details
              style={{
                whiteSpace: 'pre-wrap',
                marginTop: '1rem',
                padding: '1rem',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px'
              }}
            >
              <summary>Error Details</summary>
              <pre>{this.state.errorInfo}</pre>
            </details>
          )}
        </div>
      );

      return fallbackUI;
    }

    // If no error, render children normally
    return this.props.children;
  }
}

export default ErrorBoundary;