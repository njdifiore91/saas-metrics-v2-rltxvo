/**
 * Authentication Utility Functions
 * Provides secure token management, validation, and permission checking functionality
 * @version 1.0.0
 */

import jwtDecode from 'jwt-decode'; // v3.1.2
import { AuthUser } from '../interfaces/auth.interface';
import { authConfig } from '../config/auth.config';
import { UserRole } from '../types/api.types';
import { ERROR_CODES } from '../constants/api.constants';

// Type for decoded JWT payload
interface JWTPayload {
  sub: string;
  email: string;
  role: UserRole;
  exp: number;
  iat: number;
  iss: string;
  aud: string;
  version: string;
}

/**
 * Securely retrieves JWT token from localStorage with error handling
 * @returns {string | null} JWT token if exists and valid, null otherwise
 */
export const getTokenFromStorage = (): string | null => {
  try {
    const token = localStorage.getItem(authConfig.jwt.cookieName);
    if (!token) return null;
    
    // Basic structural validation before returning
    if (!token.split('.').length === 3) {
      removeTokenFromStorage();
      return null;
    }
    
    return token;
  } catch (error) {
    console.error('Error accessing token storage:', error);
    return null;
  }
};

/**
 * Securely stores JWT token in localStorage with validation
 * @param {string} token - JWT token to store
 */
export const setTokenInStorage = (token: string): void => {
  try {
    if (!token || typeof token !== 'string') {
      throw new Error(ERROR_CODES.AUTH.INVALID_TOKEN);
    }

    // Validate token structure before storing
    if (token.split('.').length !== 3) {
      throw new Error(ERROR_CODES.AUTH.INVALID_TOKEN);
    }

    localStorage.setItem(authConfig.jwt.cookieName, token);
  } catch (error) {
    console.error('Error storing token:', error);
    removeTokenFromStorage();
  }
};

/**
 * Securely removes JWT token from localStorage with cleanup
 */
export const removeTokenFromStorage = (): void => {
  try {
    localStorage.removeItem(authConfig.jwt.cookieName);
    // Clear any additional auth-related data
    localStorage.removeItem('user_session');
    sessionStorage.removeItem('oauth_state');
  } catch (error) {
    console.error('Error removing token:', error);
  }
};

/**
 * Comprehensively validates JWT token with enhanced security checks
 * @param {string} token - JWT token to validate
 * @returns {boolean} True if token is valid, not expired, and passes all security checks
 */
export const isTokenValid = (token: string): boolean => {
  try {
    if (!token || typeof token !== 'string') return false;

    const decoded = jwtDecode<JWTPayload>(token);
    const currentTime = Math.floor(Date.now() / 1000);

    // Comprehensive token validation
    return (
      decoded.exp > currentTime && // Not expired
      decoded.iat < currentTime && // Issued in the past
      decoded.iss === authConfig.jwt.issuer && // Valid issuer
      decoded.aud === authConfig.jwt.audience && // Valid audience
      currentTime - decoded.iat <= authConfig.jwt.maxAge && // Within maximum age
      decoded.version === authConfig.session.version // Valid version
    );
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
};

/**
 * Securely decodes JWT token with comprehensive error handling and type safety
 * @param {string} token - JWT token to decode
 * @returns {AuthUser | null} Decoded and validated user data or null if invalid
 */
export const decodeToken = (token: string): AuthUser | null => {
  try {
    if (!isTokenValid(token)) return null;

    const decoded = jwtDecode<JWTPayload>(token);
    
    // Construct AuthUser object from decoded token
    const authUser: AuthUser = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      token: token,
      name: '', // Extracted from additional claims if available
      refreshToken: '', // Managed separately
      createdAt: new Date(decoded.iat * 1000).toISOString(),
      lastLoginAt: new Date().toISOString(),
      sessionId: '' // Managed by session handling
    };

    return authUser;
  } catch (error) {
    console.error('Token decoding error:', error);
    return null;
  }
};

/**
 * Checks user permissions with role validation and enhanced security
 * @param {string} permission - Permission to check
 * @param {UserRole} userRole - User's role
 * @returns {boolean} True if user has required permission and role is valid
 */
export const hasPermission = (permission: string, userRole: UserRole): boolean => {
  try {
    // Validate inputs
    if (!permission || !userRole || !Object.values(UserRole).includes(userRole)) {
      return false;
    }

    // Get role permissions from config
    const rolePermissions = authConfig.rolePermissions[userRole];
    if (!rolePermissions) return false;

    // Special case for ADMIN role
    if (userRole === UserRole.ADMIN && rolePermissions.includes('full_access')) {
      return true;
    }

    // Check specific permission
    return rolePermissions.includes(permission);
  } catch (error) {
    console.error('Permission check error:', error);
    return false;
  }
};