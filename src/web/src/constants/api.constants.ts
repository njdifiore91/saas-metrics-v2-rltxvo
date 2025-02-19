/**
 * API Constants
 * Defines core API-related constants including endpoint URLs, HTTP status codes,
 * error codes, and request/response configurations used throughout the frontend application.
 * @version 1.0.0
 */

// API version and base URL configuration
export const API_VERSION = 'v1';
export const BASE_API_URL = '/api/v1';

/**
 * API endpoint URLs for different services
 */
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    GOOGLE: '/auth/google',
    VERIFY: '/auth/verify'
  },
  METRICS: {
    LIST: '/metrics',
    GET: '/metrics/:id',
    CREATE: '/metrics',
    UPDATE: '/metrics/:id',
    DELETE: '/metrics/:id',
    VALIDATE: '/metrics/validate'
  },
  BENCHMARKS: {
    LIST: '/benchmarks',
    GET: '/benchmarks/:id',
    COMPARE: '/benchmarks/compare',
    TRENDS: '/benchmarks/trends'
  },
  REPORTS: {
    GENERATE: '/reports/generate',
    LIST: '/reports',
    DOWNLOAD: '/reports/:id/download',
    SHARE: '/reports/:id/share'
  },
  ADMIN: {
    USERS: '/admin/users',
    METRICS: '/admin/metrics',
    SETTINGS: '/admin/settings',
    LOGS: '/admin/logs'
  }
} as const;

/**
 * Standard HTTP status codes used in API responses
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SERVER_ERROR: 500
} as const;

/**
 * Application-specific error codes for different types of errors
 */
export const ERROR_CODES = {
  AUTH: {
    TOKEN_EXPIRED: 'AUTH001',
    INVALID_TOKEN: 'AUTH002',
    INVALID_CREDENTIALS: 'AUTH003',
    SESSION_EXPIRED: 'AUTH004'
  },
  DATA: {
    INVALID_VALUE: 'DATA001',
    MISSING_FIELD: 'DATA002',
    VALIDATION_ERROR: 'DATA003',
    DUPLICATE_ENTRY: 'DATA004'
  },
  SYS: {
    RATE_LIMIT: 'SYS001',
    SERVICE_UNAVAILABLE: 'SYS002',
    TIMEOUT: 'SYS003'
  },
  API: {
    INVALID_REQUEST: 'API001',
    ENDPOINT_NOT_FOUND: 'API002',
    METHOD_NOT_ALLOWED: 'API003'
  }
} as const;

/**
 * HTTP request methods
 */
export const REQUEST_METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE'
} as const;

/**
 * Content type constants for API requests and responses
 */
export const CONTENT_TYPES = {
  JSON: 'application/json',
  FORM_DATA: 'multipart/form-data',
  PDF: 'application/pdf'
} as const;

// Type definitions for better TypeScript support
export type ApiEndpoint = typeof API_ENDPOINTS;
export type HttpStatus = typeof HTTP_STATUS;
export type ErrorCode = typeof ERROR_CODES;
export type RequestMethod = typeof REQUEST_METHODS;
export type ContentType = typeof CONTENT_TYPES;