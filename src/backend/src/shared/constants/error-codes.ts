/**
 * Error response interface following RFC 7807 Problem Details specification
 * @see https://tools.ietf.org/html/rfc7807
 */
export interface ErrorResponse {
  /** URI reference identifying the problem type */
  type: string;
  /** HTTP status code */
  status: number;
  /** Application-specific error code */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Additional error context */
  details: Record<string, unknown>;
  /** URI reference identifying specific occurrence */
  instance: string;
}

/**
 * Authentication related error codes and messages
 * @constant
 */
export const AUTH_ERRORS = {
  AUTH001: 'OAuth token expired or invalid',
  AUTH002: 'Insufficient permissions for requested operation',
  AUTH003: 'Invalid authentication credentials',
  AUTH004: 'Session expired',
  AUTH005: 'Maximum concurrent sessions exceeded'
} as const;

/**
 * Data validation error codes and messages
 * @constant
 */
export const DATA_ERRORS = {
  DATA001: 'Invalid metric value provided',
  DATA002: 'Required field missing in request',
  DATA003: 'Data validation failed',
  DATA004: 'Invalid date range specified',
  DATA005: 'Metric calculation error'
} as const;

/**
 * System level error codes and messages
 * @constant
 */
export const SYSTEM_ERRORS = {
  SYS001: 'Rate limit exceeded - please retry later',
  SYS002: 'Service temporarily unavailable',
  SYS003: 'Internal server error',
  SYS004: 'Database operation failed',
  SYS005: 'Cache service unavailable'
} as const;

/**
 * API related error codes and messages
 * @constant
 */
export const API_ERRORS = {
  API001: 'Invalid API request format',
  API002: 'Endpoint not found',
  API003: 'Method not allowed',
  API004: 'Invalid API version',
  API005: 'Request payload too large'
} as const;

/**
 * Standard HTTP status codes used across the application
 * @constant
 */
export const HTTP_STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNPROCESSABLE_ENTITY: 422,
  RATE_LIMIT: 429,
  SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const;

// Type definitions for error code constants to ensure type safety
export type AuthErrorCode = keyof typeof AUTH_ERRORS;
export type DataErrorCode = keyof typeof DATA_ERRORS;
export type SystemErrorCode = keyof typeof SYSTEM_ERRORS;
export type ApiErrorCode = keyof typeof API_ERRORS;
export type HttpStatusCode = keyof typeof HTTP_STATUS_CODES;

// Type definitions for error messages to ensure type safety
export type AuthErrorMessage = typeof AUTH_ERRORS[AuthErrorCode];
export type DataErrorMessage = typeof DATA_ERRORS[DataErrorCode];
export type SystemErrorMessage = typeof SYSTEM_ERRORS[SystemErrorCode];
export type ApiErrorMessage = typeof API_ERRORS[ApiErrorCode];