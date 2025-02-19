/**
 * Authentication Configuration
 * Centralizes authentication settings for the frontend application
 * @version 1.0.0
 */

import { UserRole } from '../types/api.types';
import { API_ENDPOINTS } from '../constants/api.constants';
import CryptoJS from 'crypto-js'; // v4.1.1

// Environment variables
const GOOGLE_CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_REDIRECT_URI = process.env.VITE_GOOGLE_REDIRECT_URI;
const TOKEN_EXPIRY = 3600; // 1 hour in seconds
const REFRESH_TOKEN_EXPIRY = 2592000; // 30 days in seconds
const AUTH_COOKIE_NAME = '_secure_auth';

/**
 * Generates a cryptographically secure state token for OAuth CSRF protection
 * @returns {string} Base64 encoded state token
 */
const generateStateToken = (): string => {
  const randomBytes = CryptoJS.lib.WordArray.random(32);
  const stateToken = CryptoJS.enc.Base64.stringify(randomBytes);
  sessionStorage.setItem('oauth_state', stateToken);
  return stateToken;
};

/**
 * Validates the OAuth state token to prevent CSRF attacks
 * @param {string} state - Received state token from OAuth callback
 * @returns {boolean} Whether the state token is valid
 */
const validateStateToken = (state: string): boolean => {
  const storedState = sessionStorage.getItem('oauth_state');
  sessionStorage.removeItem('oauth_state');
  return storedState === state;
};

/**
 * Comprehensive authentication configuration object
 */
export const authConfig = {
  oauth: {
    provider: 'google',
    clientId: GOOGLE_CLIENT_ID,
    redirectUri: GOOGLE_REDIRECT_URI,
    scope: ['email', 'profile', 'openid'],
    responseType: 'code',
    prompt: 'select_account',
    accessType: 'offline',
    state: generateStateToken,
    codeChallengeMethod: 'S256',
    endpoints: {
      authorization: 'https://accounts.google.com/o/oauth2/v2/auth',
      token: API_ENDPOINTS.AUTH.GOOGLE,
      userInfo: API_ENDPOINTS.AUTH.VERIFY
    }
  },

  jwt: {
    algorithm: 'RS256',
    expiresIn: TOKEN_EXPIRY,
    refreshExpiresIn: REFRESH_TOKEN_EXPIRY,
    issuer: 'startup-metrics-platform',
    audience: 'startup-metrics-api',
    clockTolerance: 30,
    maxAge: TOKEN_EXPIRY,
    endpoints: {
      refresh: API_ENDPOINTS.AUTH.REFRESH,
      logout: API_ENDPOINTS.AUTH.LOGOUT
    }
  },

  session: {
    maxConcurrentSessions: 3,
    idleTimeout: 1800, // 30 minutes in seconds
    maxAge: 2592000, // 30 days in seconds
    rolling: true,
    secure: true,
    sameSite: 'strict' as const,
    httpOnly: true,
    cookieName: AUTH_COOKIE_NAME,
    version: '1.0'
  },

  rolePermissions: {
    [UserRole.ADMIN]: [
      'full_access',
      'user_management',
      'system_configuration',
      'audit_logs'
    ],
    [UserRole.ANALYST]: [
      'view_metrics',
      'create_reports',
      'export_data',
      'input_metrics',
      'view_audit_logs'
    ],
    [UserRole.USER]: [
      'view_assigned_metrics',
      'basic_comparison',
      'view_personal_dashboard'
    ],
    [UserRole.GUEST]: [
      'view_public_benchmarks',
      'view_documentation'
    ]
  },

  security: {
    csrfProtection: true,
    rateLimiting: {
      maxAttempts: 5,
      windowMs: 300000 // 5 minutes
    },
    passwordPolicy: {
      minLength: 12,
      requireNumbers: true,
      requireSpecialChars: true
    },
    tokenSecurity: {
      refreshRotation: true,
      blacklistCompromised: true,
      validateState: validateStateToken
    }
  }
} as const;

export default authConfig;