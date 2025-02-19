import { Request, Response, NextFunction } from 'express'; // v4.18.2
import { ErrorResponse, HTTP_STATUS_CODES } from '../constants/error-codes';
import { Logger } from '../utils/logger';

// Initialize logger for error handling middleware
const logger = new Logger('error-handler');

/**
 * Error categories for classification and monitoring
 */
export enum ErrorCategory {
  AUTHENTICATION = 'authentication',
  VALIDATION = 'validation',
  SYSTEM = 'system',
  API = 'api',
  UNKNOWN = 'unknown'
}

/**
 * Enhanced Error interface with additional properties for error tracking
 */
export interface CustomError extends Error {
  code: string;
  status: number;
  details: Record<string, unknown>;
  correlationId: string;
  timestamp: Date;
  serviceId: string;
  category: ErrorCategory;
}

/**
 * Determines the error category based on error code prefix
 * @param code - Error code to categorize
 * @returns Appropriate ErrorCategory
 */
const determineErrorCategory = (code: string): ErrorCategory => {
  const prefix = code.substring(0, 3);
  switch (prefix) {
    case 'AUT':
      return ErrorCategory.AUTHENTICATION;
    case 'DAT':
      return ErrorCategory.VALIDATION;
    case 'SYS':
      return ErrorCategory.SYSTEM;
    case 'API':
      return ErrorCategory.API;
    default:
      return ErrorCategory.UNKNOWN;
  }
};

/**
 * Formats error details according to RFC 7807 Problem Details specification
 * @param error - Error object to format
 * @param req - Express request object
 * @returns Formatted error response
 */
const formatErrorResponse = (error: Error | CustomError, req: Request): ErrorResponse => {
  const isCustomError = 'code' in error;
  const timestamp = new Date().toISOString();
  const correlationId = (error as CustomError).correlationId || `${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
  
  const errorResponse: ErrorResponse = {
    type: 'https://api.startupmetrics.com/errors',
    status: isCustomError ? (error as CustomError).status : HTTP_STATUS_CODES.SERVER_ERROR,
    code: isCustomError ? (error as CustomError).code : 'SYS003',
    message: error.message,
    details: {
      ...(isCustomError ? (error as CustomError).details : {}),
      timestamp,
      correlationId,
      path: req.path,
      method: req.method,
      serviceId: process.env.SERVICE_ID || 'unknown'
    },
    instance: `${req.protocol}://${req.get('host')}${req.originalUrl}`
  };

  return errorResponse;
};

/**
 * Enhanced Express middleware for comprehensive error handling
 * Implements RFC 7807 Problem Details specification with security monitoring
 */
export const errorHandler = (
  error: Error | CustomError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Format error response
  const errorResponse = formatErrorResponse(error, req);
  
  // Determine error category for monitoring
  const category = 'code' in error 
    ? determineErrorCategory(error.code)
    : ErrorCategory.UNKNOWN;

  // Log error with complete context
  logger.error('Request error occurred', {
    ...errorResponse,
    category,
    headers: req.headers,
    body: req.body,
    query: req.query,
    user: req.user,
    stack: error.stack
  });

  // Track security-related errors
  if (category === ErrorCategory.AUTHENTICATION) {
    // In a real implementation, this would integrate with security monitoring
    console.warn('Security-related error detected:', errorResponse.code);
  }

  // Determine appropriate status code
  let statusCode = HTTP_STATUS_CODES.SERVER_ERROR;
  if ('status' in error) {
    statusCode = error.status;
  } else if (error instanceof Error) {
    switch (category) {
      case ErrorCategory.AUTHENTICATION:
        statusCode = HTTP_STATUS_CODES.UNAUTHORIZED;
        break;
      case ErrorCategory.VALIDATION:
        statusCode = HTTP_STATUS_CODES.BAD_REQUEST;
        break;
      case ErrorCategory.API:
        statusCode = HTTP_STATUS_CODES.NOT_FOUND;
        break;
      default:
        statusCode = HTTP_STATUS_CODES.SERVER_ERROR;
    }
  }

  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'");

  // Send error response
  res.status(statusCode).json(errorResponse);
};