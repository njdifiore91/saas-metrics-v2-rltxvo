import React from 'react';
import { Navigate, useLocation } from 'react-router-dom'; // v6.8.0
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../common/LoadingSpinner';

/**
 * Props interface for the ProtectedRoute component
 * Defines required and optional properties for route protection
 */
interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  redirectPath?: string;
}

/**
 * Higher-order component that implements secure route protection with role-based access control
 * Handles authentication state, session validation, and authorization checks
 * 
 * @param {ProtectedRouteProps} props - Component properties
 * @returns {JSX.Element} Protected route component or secure redirect
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles,
  redirectPath = '/login'
}) => {
  const location = useLocation();
  const { isAuthenticated, loading, user, sessionExpired } = useAuth();

  // Show loading spinner while authentication state is being checked
  if (loading) {
    return (
      <LoadingSpinner 
        size="medium"
        overlay={true}
        aria-label="Verifying authentication..."
      />
    );
  }

  // Handle session expiration with secure redirect
  if (sessionExpired) {
    return (
      <Navigate
        to={redirectPath}
        state={{ 
          from: location,
          message: 'Your session has expired. Please log in again.',
          code: 'SESSION_EXPIRED'
        }}
        replace
      />
    );
  }

  // Redirect to login if user is not authenticated
  if (!isAuthenticated) {
    return (
      <Navigate
        to={redirectPath}
        state={{ 
          from: location,
          message: 'Please log in to access this page.',
          code: 'AUTH_REQUIRED'
        }}
        replace
      />
    );
  }

  // Perform role-based authorization check if required roles are specified
  if (requiredRoles && !checkUserAuthorization(requiredRoles, user)) {
    // Log unauthorized access attempt for security monitoring
    console.warn('Unauthorized access attempt', {
      path: location.pathname,
      requiredRoles,
      userRole: user?.role,
      timestamp: new Date().toISOString(),
    });

    return (
      <Navigate
        to="/unauthorized"
        state={{ 
          from: location,
          message: 'You do not have permission to access this page.',
          code: 'UNAUTHORIZED'
        }}
        replace
      />
    );
  }

  // Render children if all security checks pass
  return <>{children}</>;
};

/**
 * Helper function to perform secure role-based authorization checks
 * 
 * @param {string[]} requiredRoles - Array of roles required for access
 * @param {AuthUser | null} user - Current authenticated user
 * @returns {boolean} Authorization status
 */
const checkUserAuthorization = (
  requiredRoles: string[],
  user: AuthUser | null
): boolean => {
  // Return true if no roles are required
  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }

  // Return false if no user or user has no role
  if (!user || !user.role) {
    return false;
  }

  // Log authorization check for security audit
  console.debug('Authorization check', {
    requiredRoles,
    userRole: user.role,
    timestamp: new Date().toISOString(),
  });

  // Check if user has at least one of the required roles
  return requiredRoles.includes(user.role);
};

export default ProtectedRoute;