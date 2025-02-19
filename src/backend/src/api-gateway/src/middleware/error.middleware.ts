import { Request, Response, NextFunction } from 'express'; // v4.18.2
import { ErrorResponse, HTTP_STATUS_CODES } from '../../shared/constants/error-codes';
import { Logger } from '../../shared/utils/logger';

// Initialize logger for API Gateway
const logger = new Logger('api-gateway');

/**
 * Maps error codes to HTTP status codes
 * @param code Error code prefix
 * @returns Appropriate HTTP status code
 */
const mapErrorCodeToStatus = (code: string): number => {
  switch (code.substring(0, 3)) {
    case 'AUT':
      return code === 'AUTH001' ? HTTP_STATUS_CODES.UNAUTHORIZED : HTTP_STATUS_CODES.FORBIDDEN;
    case 'DAT':
      return HTTP_STATUS_CODES.BAD_REQUEST;
    case 'SYS':
      return HTTP_STATUS_CODES.SERVER_ERROR;
    case 'API':
      return code === 'API002' ? HTTP_STATUS_CODES.NOT_FOUND : HTTP_STATUS_CODES.BAD_REQUEST;
    default:
      return HTTP_STATUS_CODES.SERVER_ERROR;
  }
};

/**
 * Sanitizes error details for safe external exposure
 * @param error Original error object
 * @returns Sanitized error details
 */
const sanitizeErrorDetails = (error: Error | ErrorResponse): Record<string, unknown> => {
  if ('details' in error) {
    // Remove sensitive information from error details
    const { stack, ...safeDetails } = error.details;
    return safeDetails;
  }
  return {};
};

/**
 * Express error handling middleware implementing RFC 7807 Problem Details
 * @param error Error object or ErrorResponse
 * @param req Express request object
 * @param res Express response object
 * @param next Express next function
 */
export const errorHandler = (
  error: Error | ErrorResponse,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Extract correlation ID from request headers
  const correlationId = req.headers['x-correlation-id'] as string || 'unknown';

  // Log error with context
  logger.error('API Error occurred', {
    ...error,
    correlationId,
    path: req.path,
    method: req.method,
  });

  // Determine if error is already formatted as ErrorResponse
  const isErrorResponse = 'code' in error && 'type' in error;

  // Construct RFC 7807 compliant error response
  const errorResponse: ErrorResponse = isErrorResponse 
    ? error as ErrorResponse
    : {
        type: 'https://api.startupmetrics.com/errors/system-error',
        code: 'SYS003',
        message: error.message || 'An unexpected error occurred',
        details: {},
        instance: `/errors/${correlationId}`,
        status: HTTP_STATUS_CODES.SERVER_ERROR
      };

  // Map error code to HTTP status
  const httpStatus = mapErrorCodeToStatus(errorResponse.code);

  // Sanitize error details
  const safeDetails = sanitizeErrorDetails(error);

  // Construct final response following RFC 7807
  const problemDetails = {
    type: errorResponse.type,
    title: errorResponse.message,
    status: httpStatus,
    detail: errorResponse.message,
    instance: errorResponse.instance,
    correlationId,
    code: errorResponse.code,
    ...safeDetails
  };

  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'none'");

  // Send RFC 7807 compliant response
  res.status(httpStatus)
     .contentType('application/problem+json')
     .json(problemDetails);
};