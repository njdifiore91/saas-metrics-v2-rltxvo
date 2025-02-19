import React, { Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ErrorBoundary } from 'react-error-boundary';

// Theme and styles
import theme from './assets/styles/theme';

// Components
import LoadingSpinner from './components/common/LoadingSpinner';
import Notification from './components/common/Notification';
import ProtectedRoute from './components/auth/ProtectedRoute';

// Lazy-loaded page components
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage'));

// Error fallback component
const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <div role="alert" className="error-boundary">
    <h2>Something went wrong</h2>
    <pre>{error.message}</pre>
    <button onClick={resetErrorBoundary}>Try again</button>
  </div>
);

const App: React.FC = () => {
  // Handle global errors
  const handleError = (error: Error) => {
    console.error('Global error:', error);
    // Additional error logging or monitoring could be added here
  };

  // Global error boundary reset handler
  const handleErrorReset = () => {
    // Reset application state if needed
    window.location.href = '/';
  };

  // Effect for initializing global app settings
  useEffect(() => {
    // Set document-level attributes for accessibility
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
  }, []);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={handleError}
      onReset={handleErrorReset}
    >
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          {/* Global notification system */}
          <Notification />
          
          {/* Main application routes */}
          <Suspense 
            fallback={
              <LoadingSpinner 
                size="large" 
                overlay={true}
                aria-label="Loading application..."
              />
            }
          >
            <Routes>
              {/* Public routes */}
              <Route 
                path="/login" 
                element={<LoginPage />} 
              />

              {/* Protected routes */}
              <Route
                path="/dashboard/*"
                element={
                  <ProtectedRoute
                    requiredRoles={['user', 'admin', 'analyst']}
                    redirectPath="/login"
                  >
                    <DashboardPage companyId="default" />
                  </ProtectedRoute>
                }
              />

              {/* Admin routes */}
              <Route
                path="/admin/*"
                element={
                  <ProtectedRoute
                    requiredRoles={['admin']}
                    redirectPath="/unauthorized"
                  >
                    <div>Admin Panel</div>
                  </ProtectedRoute>
                }
              />

              {/* Default redirect */}
              <Route 
                path="/" 
                element={<Navigate to="/dashboard" replace />} 
              />

              {/* 404 handler */}
              <Route 
                path="*" 
                element={<NotFoundPage />} 
              />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;