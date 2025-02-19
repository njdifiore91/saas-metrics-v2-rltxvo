// @package cors@2.8.5
import { CorsOptions } from 'cors';

/**
 * Production-ready CORS configuration for the API Gateway
 * Implements strict security controls with environment-specific settings
 * Includes rate limiting headers and CSRF protection
 */
export const corsConfig: CorsOptions = {
  // Whitelist of allowed origins based on environment
  origin: [
    process.env.FRONTEND_URL,
    process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : '',
    process.env.NODE_ENV === 'staging' ? 'https://staging.startupmetrics.com' : '',
  ].filter(Boolean), // Remove empty strings

  // Allowed HTTP methods
  methods: [
    'GET',
    'POST', 
    'PUT',
    'DELETE',
    'OPTIONS'
  ],

  // Headers that are allowed to be sent by the client
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-API-Key',
    'X-CSRF-Token'
  ],

  // Headers that are exposed to the client
  exposedHeaders: [
    'Content-Range',
    'X-Content-Range',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining'
  ],

  // Allow credentials (cookies, authorization headers)
  credentials: true,

  // Cache preflight requests for 24 hours (86400 seconds)
  maxAge: 86400,

  // Do not pass the OPTIONS request to the next handler
  preflightContinue: false,

  // Success status code for OPTIONS requests
  optionsSuccessStatus: 204
};