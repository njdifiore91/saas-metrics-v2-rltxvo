/**
 * Authentication interfaces for the Startup Metrics Benchmarking Platform
 * Defines TypeScript interfaces for user authentication, session management, and OAuth integration
 * @version 1.0.0
 */

import { UserRole } from '../types/api.types';

/**
 * Interface representing an authenticated user with comprehensive session information
 * Includes all necessary user data and authentication tokens
 */
export interface AuthUser {
  id: string;                  // Unique user identifier
  email: string;              // User's email address
  name: string;               // User's full name
  role: UserRole;             // User's role for access control
  token: string;              // JWT access token
  refreshToken: string;       // Token for session refresh
  createdAt: string;          // ISO8601 timestamp of account creation
  lastLoginAt: string;        // ISO8601 timestamp of last login
  sessionId: string;          // Unique session identifier
}

/**
 * Interface for global authentication state management
 * Tracks authentication status, user data, and error states
 */
export interface AuthState {
  isAuthenticated: boolean;           // Current authentication status
  user: AuthUser | null;             // Authenticated user data
  loading: boolean;                   // Authentication process status
  error: string | null;              // Authentication error message
  sessionExpiry: string | null;      // ISO8601 timestamp of session expiration
}

/**
 * Interface for login request payload
 * Includes credentials and session persistence preference
 */
export interface LoginRequest {
  email: string;              // User's email address
  password: string;           // User's password (never stored)
  rememberMe: boolean;        // Extended session flag
}

/**
 * Interface for Google OAuth request payload
 * Includes necessary parameters for OAuth flow with CSRF protection
 */
export interface GoogleOAuthRequest {
  code: string;               // OAuth authorization code
  redirectUri: string;        // OAuth redirect URI
  state: string;              // CSRF protection token
}

/**
 * Interface for authentication response data
 * Contains user information and session tokens
 */
export interface AuthResponse {
  user: AuthUser;             // Authenticated user data
  token: string;              // JWT access token
  refreshToken: string;       // Token for session refresh
  expiresIn: number;         // Token expiration in seconds
}