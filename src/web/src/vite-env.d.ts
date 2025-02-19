/// <reference types="vite/client" />

/**
 * Type definitions for Vite environment variables used in the startup metrics benchmarking platform.
 * Extends the base Vite client types to provide type safety for custom environment configuration.
 * @version vite ^4.0.0
 */

/**
 * Environment variable interface defining the required configuration for the application.
 * All variables must be prefixed with VITE_ to be exposed to the client.
 */
interface ImportMetaEnv {
  /** Base URL for the backend API endpoints */
  readonly VITE_API_URL: string;
  
  /** Google OAuth client ID for authentication */
  readonly VITE_GOOGLE_CLIENT_ID: string;
  
  /** Current deployment environment identifier */
  readonly VITE_APP_ENV: 'development' | 'staging' | 'production';
}

/**
 * Augments the Vite ImportMeta interface to include our custom environment variables.
 * Provides type-safe access to environment configuration throughout the application.
 */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}