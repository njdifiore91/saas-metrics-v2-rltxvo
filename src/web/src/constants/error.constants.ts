/**
 * Error constants for the Startup Metrics Benchmarking Platform
 * @version 1.0.0
 */

// Default fallback error message for unhandled errors
export const DEFAULT_ERROR_MESSAGE = 'An unexpected error occurred. Please try again later.';

// Standardized error codes by category
export const ERROR_CODES = {
  AUTH: {
    TOKEN_EXPIRED: 'AUTH001',
    INVALID_PERMISSIONS: 'AUTH002',
    INVALID_CREDENTIALS: 'AUTH003',
    SESSION_EXPIRED: 'AUTH004',
    OAUTH_FAILED: 'AUTH005'
  },
  DATA: {
    INVALID_VALUE: 'DATA001',
    MISSING_FIELD: 'DATA002',
    INVALID_FORMAT: 'DATA003',
    VALIDATION_FAILED: 'DATA004',
    DUPLICATE_ENTRY: 'DATA005'
  },
  SYS: {
    RATE_LIMIT: 'SYS001',
    SERVICE_UNAVAILABLE: 'SYS002',
    TIMEOUT: 'SYS003',
    MAINTENANCE: 'SYS004',
    RESOURCE_EXHAUSTED: 'SYS005'
  },
  API: {
    INVALID_REQUEST: 'API001',
    ENDPOINT_NOT_FOUND: 'API002',
    METHOD_NOT_ALLOWED: 'API003',
    RESPONSE_ERROR: 'API004',
    VERSION_MISMATCH: 'API005'
  }
} as const;

// User-friendly error messages mapped to error codes
export const ERROR_MESSAGES = {
  AUTH: {
    [ERROR_CODES.AUTH.TOKEN_EXPIRED]: 'Your session has expired. Please log in again.',
    [ERROR_CODES.AUTH.INVALID_PERMISSIONS]: 'You do not have permission to perform this action.',
    [ERROR_CODES.AUTH.INVALID_CREDENTIALS]: 'Invalid username or password.',
    [ERROR_CODES.AUTH.SESSION_EXPIRED]: 'Your session has timed out. Please log in again.',
    [ERROR_CODES.AUTH.OAUTH_FAILED]: 'Google authentication failed. Please try again.'
  },
  DATA: {
    [ERROR_CODES.DATA.INVALID_VALUE]: 'The provided value is invalid.',
    [ERROR_CODES.DATA.MISSING_FIELD]: 'Required field is missing.',
    [ERROR_CODES.DATA.INVALID_FORMAT]: 'The data format is invalid.',
    [ERROR_CODES.DATA.VALIDATION_FAILED]: 'Data validation failed.',
    [ERROR_CODES.DATA.DUPLICATE_ENTRY]: 'This entry already exists.'
  },
  SYS: {
    [ERROR_CODES.SYS.RATE_LIMIT]: 'Too many requests. Please try again later.',
    [ERROR_CODES.SYS.SERVICE_UNAVAILABLE]: 'Service is temporarily unavailable.',
    [ERROR_CODES.SYS.TIMEOUT]: 'Request timed out. Please try again.',
    [ERROR_CODES.SYS.MAINTENANCE]: 'System is under maintenance.',
    [ERROR_CODES.SYS.RESOURCE_EXHAUSTED]: 'System resources are currently exhausted.'
  },
  API: {
    [ERROR_CODES.API.INVALID_REQUEST]: 'Invalid API request.',
    [ERROR_CODES.API.ENDPOINT_NOT_FOUND]: 'Requested endpoint not found.',
    [ERROR_CODES.API.METHOD_NOT_ALLOWED]: 'HTTP method not allowed.',
    [ERROR_CODES.API.RESPONSE_ERROR]: 'Error processing API response.',
    [ERROR_CODES.API.VERSION_MISMATCH]: 'API version mismatch.'
  }
} as const;

// Error type classifications
export const ERROR_TYPES = {
  VALIDATION: 'validation_error',
  AUTHENTICATION: 'authentication_error',
  AUTHORIZATION: 'authorization_error',
  SERVER: 'server_error',
  NETWORK: 'network_error'
} as const;

// Error severity levels
export const ERROR_SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
} as const;

// Standard HTTP status codes
export const HTTP_STATUS_CODES = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMIT_EXCEEDED: 429,
  SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const;

// Error message templates for dynamic content
export const ERROR_TEMPLATES = {
  WITH_CODE: 'Error code: {code} - {message}',
  WITH_FIELD: 'Invalid field: {field} - {message}',
  WITH_VALUE: 'Invalid value: {value} for {field}',
  WITH_RANGE: 'Value must be between {min} and {max}',
  WITH_DETAILS: '{message} Details: {details}'
} as const;

// Type definitions for error handling
export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES][keyof typeof ERROR_CODES[keyof typeof ERROR_CODES]];
export type ErrorType = typeof ERROR_TYPES[keyof typeof ERROR_TYPES];
export type ErrorSeverity = typeof ERROR_SEVERITY[keyof typeof ERROR_SEVERITY];
export type HttpStatusCode = typeof HTTP_STATUS_CODES[keyof typeof HTTP_STATUS_CODES];