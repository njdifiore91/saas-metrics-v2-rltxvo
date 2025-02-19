import { Request, Response, NextFunction } from 'express'; // v4.18.2
import { v4 as uuidv4 } from 'uuid'; // v8.3.2
import { Logger } from '../../shared/utils/logger';

// Initialize logger instance for API Gateway
const logger = new Logger('api-gateway');

// Headers that should be redacted in logs for security
const SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'x-api-key',
  'session-id'
] as const;

/**
 * Sanitizes request headers by removing sensitive information
 * @param headers - Original request headers
 * @returns Sanitized headers object
 */
const sanitizeHeaders = (headers: Record<string, string>): Record<string, string> => {
  const sanitized = { ...headers };
  
  // Redact sensitive header values
  SENSITIVE_HEADERS.forEach(header => {
    if (header in sanitized) {
      sanitized[header] = '[REDACTED]';
    }
  });

  // Additional sanitization for headers containing sensitive patterns
  Object.keys(sanitized).forEach(key => {
    if (
      key.toLowerCase().includes('token') ||
      key.toLowerCase().includes('secret') ||
      key.toLowerCase().includes('password')
    ) {
      sanitized[key] = '[REDACTED]';
    }
  });

  return sanitized;
};

/**
 * Formats request and response data into structured log message
 * @param requestData - HTTP request details
 * @param responseData - HTTP response details
 * @param duration - Request duration in milliseconds
 * @returns Structured log message for ELK
 */
const formatLogMessage = (
  requestData: {
    method: string;
    path: string;
    query: Record<string, any>;
    headers: Record<string, string>;
    correlationId: string;
  },
  responseData: {
    statusCode: number;
    contentLength?: number;
  },
  duration: number
): object => {
  return {
    timestamp: new Date().toISOString(),
    correlationId: requestData.correlationId,
    type: 'request_log',
    request: {
      method: requestData.method,
      path: requestData.path,
      query: requestData.query,
      headers: sanitizeHeaders(requestData.headers),
    },
    response: {
      statusCode: responseData.statusCode,
      contentLength: responseData.contentLength,
    },
    performance: {
      duration,
      timestamp: Date.now(),
    },
    metadata: {
      service: 'api-gateway',
      environment: process.env.NODE_ENV,
    }
  };
};

/**
 * Express middleware for request logging with performance monitoring
 * and security audit capabilities
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  // Generate unique correlation ID for request tracking
  const correlationId = uuidv4();
  const startTime = process.hrtime.bigint();

  // Attach correlation ID to request for tracing
  req['correlationId'] = correlationId;

  // Log initial request details
  logger.info('Incoming request', {
    correlationId,
    method: req.method,
    path: req.path,
    query: req.query,
    headers: sanitizeHeaders(req.headers as Record<string, string>),
  });

  // Store original end function
  const originalEnd = res.end;

  // Override end function to capture response details
  res.end = function(chunk?: any, encoding?: string, callback?: () => void): Response {
    // Calculate request duration
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1e6; // Convert to milliseconds

    // Format and log complete request-response cycle
    const logMessage = formatLogMessage(
      {
        method: req.method,
        path: req.path,
        query: req.query,
        headers: req.headers as Record<string, string>,
        correlationId,
      },
      {
        statusCode: res.statusCode,
        contentLength: res.get('Content-Length') ? parseInt(res.get('Content-Length')!) : undefined,
      },
      duration
    );

    // Log at appropriate level based on status code
    if (res.statusCode >= 500) {
      logger.error('Request failed', new Error(JSON.stringify(logMessage)));
    } else if (res.statusCode >= 400) {
      logger.warn('Request error', logMessage);
    } else {
      logger.info('Request completed', logMessage);
    }

    // Restore original end function
    res.end = originalEnd;
    return originalEnd.call(this, chunk, encoding, callback);
  };

  next();
};