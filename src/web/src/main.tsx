import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { StrictMode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { PerformanceMonitor } from '@performance-monitor/react';
import App from './App';
import { store } from './store';

// Constants for performance monitoring
const PERFORMANCE_THRESHOLDS = {
  firstContentfulPaint: 1000,
  timeToInteractive: 2000
};

// Get root element
const rootElement = document.getElementById('root') as HTMLElement;
if (!rootElement) {
  throw new Error('Root element not found');
}

// Configure Content Security Policy for production
const configureCSP = () => {
  const meta = document.createElement('meta');
  meta.httpEquiv = 'Content-Security-Policy';
  meta.content = `
    default-src 'self';
    script-src 'self' https://accounts.google.com;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' data: https:;
    connect-src 'self' https://api.startupmetrics.com;
    frame-src https://accounts.google.com;
  `.replace(/\s+/g, ' ').trim();
  document.head.appendChild(meta);
};

// Initialize performance monitoring
const initializeMonitoring = () => {
  if (process.env.NODE_ENV === 'production') {
    PerformanceMonitor.init({
      thresholds: PERFORMANCE_THRESHOLDS,
      reportingEndpoint: '/api/v1/metrics/performance',
      sampleRate: 0.1,
      enableLongTaskReporting: true,
      enableNetworkTiming: true,
      enableResourceTiming: true
    });
  }
};

// Error fallback component
const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <div role="alert" className="error-boundary">
    <h2>Application Error</h2>
    <pre>{error.message}</pre>
    <button onClick={resetErrorBoundary}>Try again</button>
  </div>
);

// Configure production settings
if (process.env.NODE_ENV === 'production') {
  configureCSP();
  initializeMonitoring();
}

// Create root and render application
const root = ReactDOM.createRoot(rootElement);
root.render(
  <StrictMode>
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, info) => {
        // Log error to monitoring service
        console.error('Application error:', error, info);
        PerformanceMonitor.logError(error, {
          componentStack: info.componentStack,
          timestamp: new Date().toISOString()
        });
      }}
      onReset={() => {
        // Reset application state
        window.location.href = '/';
      }}
    >
      <Provider store={store}>
        <PerformanceMonitor>
          <App />
        </PerformanceMonitor>
      </Provider>
    </ErrorBoundary>
  </StrictMode>
);

// Enable hot module replacement in development
if (process.env.NODE_ENV === 'development' && module.hot) {
  module.hot.accept();
}