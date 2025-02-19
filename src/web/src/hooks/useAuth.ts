/**
 * Enhanced authentication hook providing comprehensive security features
 * Implements JWT token rotation, concurrent session management, and role-based access control
 * @version 1.0.0
 */

import { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { v4 as uuidv4 } from 'uuid'; // v9.0.0
import jwtDecode from 'jwt-decode'; // v3.1.2
import { AuthState, LoginRequest, AuthError, AuthUser } from '../interfaces/auth.interface';
import { UserRole } from '../types/api.types';

// Constants for token management
const TOKEN_REFRESH_INTERVAL = 45 * 60 * 1000; // 45 minutes
const SESSION_EXPIRY = 60 * 60 * 1000; // 1 hour
const MAX_CONCURRENT_SESSIONS = 3;

/**
 * Custom hook providing comprehensive authentication functionality
 * Includes enhanced security features and session management
 */
export const useAuth = () => {
  const dispatch = useDispatch();
  const refreshTimerRef = useRef<NodeJS.Timeout>();
  const deviceIdRef = useRef<string>(localStorage.getItem('deviceId') || uuidv4());

  // Select authentication state from Redux store
  const authState = useSelector((state: { auth: AuthState }) => state.auth);
  
  /**
   * Handles JWT token refresh with sliding session
   * Implements token rotation and session validation
   */
  const handleTokenRefresh = useCallback(async (): Promise<void> => {
    try {
      if (!authState.user?.refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-ID': deviceIdRef.current,
        },
        body: JSON.stringify({
          refreshToken: authState.user.refreshToken,
          sessionId: authState.user.sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const { token, refreshToken, expiresIn } = await response.json();

      dispatch({
        type: 'AUTH_REFRESH_SUCCESS',
        payload: {
          token,
          refreshToken,
          sessionExpiry: new Date(Date.now() + expiresIn * 1000).toISOString(),
        },
      });

      // Reset refresh timer
      setupRefreshTimer();
    } catch (error) {
      dispatch({ type: 'AUTH_REFRESH_FAILURE', payload: error });
      handleLogout();
    }
  }, [authState.user, dispatch]);

  /**
   * Sets up token refresh timer with sliding session
   */
  const setupRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    refreshTimerRef.current = setTimeout(() => {
      handleTokenRefresh();
    }, TOKEN_REFRESH_INTERVAL);
  }, [handleTokenRefresh]);

  /**
   * Enhanced login handler with security features
   * Implements device tracking and session management
   */
  const handleLogin = useCallback(async (credentials: LoginRequest): Promise<void> => {
    try {
      dispatch({ type: 'AUTH_LOGIN_REQUEST' });

      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-ID': deviceIdRef.current,
        },
        body: JSON.stringify({
          ...credentials,
          deviceId: deviceIdRef.current,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      const { user, token, refreshToken, expiresIn } = await response.json();

      // Store device ID for session tracking
      localStorage.setItem('deviceId', deviceIdRef.current);

      dispatch({
        type: 'AUTH_LOGIN_SUCCESS',
        payload: {
          user,
          token,
          refreshToken,
          sessionExpiry: new Date(Date.now() + expiresIn * 1000).toISOString(),
        },
      });

      setupRefreshTimer();
    } catch (error) {
      dispatch({
        type: 'AUTH_LOGIN_FAILURE',
        payload: {
          code: 'AUTH001',
          message: error.message,
          details: { timestamp: new Date().toISOString() },
        },
      });
    }
  }, [dispatch, setupRefreshTimer]);

  /**
   * Handles Google OAuth authentication
   * Implements secure OAuth flow with state validation
   */
  const handleGoogleLogin = useCallback(async (code: string, state: string): Promise<void> => {
    try {
      dispatch({ type: 'AUTH_LOGIN_REQUEST' });

      // Validate stored OAuth state
      const storedState = sessionStorage.getItem('oauthState');
      if (state !== storedState) {
        throw new Error('Invalid OAuth state');
      }

      const response = await fetch('/api/v1/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-ID': deviceIdRef.current,
        },
        body: JSON.stringify({
          code,
          deviceId: deviceIdRef.current,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      const { user, token, refreshToken, expiresIn } = await response.json();

      dispatch({
        type: 'AUTH_LOGIN_SUCCESS',
        payload: {
          user,
          token,
          refreshToken,
          sessionExpiry: new Date(Date.now() + expiresIn * 1000).toISOString(),
        },
      });

      setupRefreshTimer();
    } catch (error) {
      dispatch({
        type: 'AUTH_LOGIN_FAILURE',
        payload: {
          code: 'AUTH002',
          message: error.message,
          details: { timestamp: new Date().toISOString() },
        },
      });
    }
  }, [dispatch, setupRefreshTimer]);

  /**
   * Handles user logout with session cleanup
   */
  const handleLogout = useCallback(async (): Promise<void> => {
    try {
      if (authState.user?.token) {
        await fetch('/api/v1/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authState.user.token}`,
            'X-Device-ID': deviceIdRef.current,
          },
        });
      }

      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }

      dispatch({ type: 'AUTH_LOGOUT' });
      localStorage.removeItem('deviceId');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, [authState.user, dispatch]);

  /**
   * Checks if user has required role
   */
  const hasRole = useCallback((requiredRole: UserRole): boolean => {
    if (!authState.user) return false;
    
    const roleHierarchy = {
      [UserRole.ADMIN]: 4,
      [UserRole.ANALYST]: 3,
      [UserRole.USER]: 2,
      [UserRole.GUEST]: 1,
    };

    return roleHierarchy[authState.user.role] >= roleHierarchy[requiredRole];
  }, [authState.user]);

  // Setup session monitoring and token refresh
  useEffect(() => {
    if (authState.isAuthenticated && authState.user?.token) {
      setupRefreshTimer();
    }

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [authState.isAuthenticated, authState.user, setupRefreshTimer]);

  return {
    isAuthenticated: authState.isAuthenticated,
    user: authState.user,
    loading: authState.loading,
    error: authState.error,
    login: handleLogin,
    loginWithGoogle: handleGoogleLogin,
    logout: handleLogout,
    refreshToken: handleTokenRefresh,
    hasRole,
  };
};