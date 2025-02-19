import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'; // v29.0.0
import { Request, Response, NextFunction } from 'express'; // v4.18.2
import { MockRequest, MockResponse } from 'jest-mock-express'; // v0.1.1
import { errorHandler } from '../../../backend/src/api-gateway/src/middleware/error.middleware';
import { ErrorResponse, HTTP_STATUS_CODES } from '../../../backend/src/shared/constants/error-codes';

describe('Error Middleware', () => {
  let mockRequest: MockRequest;
  let mockResponse: MockResponse;
  let mockNext: jest.Mock<NextFunction>;

  beforeEach(() => {
    mockRequest = new MockRequest({
      headers: {
        'x-correlation-id': 'test-correlation-id'
      }
    });
    mockResponse = new MockResponse();
    mockNext = jest.fn();

    // Add required response methods
    mockResponse.status = jest.fn().mockReturnThis();
    mockResponse.json = jest.fn().mockReturnThis();
    mockResponse.contentType = jest.fn().mockReturnThis();
    mockResponse.setHeader = jest.fn().mockReturnThis();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should format error response according to RFC 7807', async () => {
    const testError: ErrorResponse = {
      type: 'https://api.startupmetrics.com/errors/validation',
      code: 'DATA001',
      message: 'Invalid metric value provided',
      details: { field: 'revenue', value: 'invalid' },
      status: HTTP_STATUS_CODES.BAD_REQUEST,
      instance: '/errors/test-correlation-id'
    };

    errorHandler(testError, mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.contentType).toHaveBeenCalledWith('application/problem+json');
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      type: testError.type,
      title: testError.message,
      status: HTTP_STATUS_CODES.BAD_REQUEST,
      detail: testError.message,
      instance: testError.instance,
      correlationId: 'test-correlation-id'
    }));
  });

  it('should handle different error types with appropriate status codes', async () => {
    const testCases = [
      {
        error: { code: 'AUTH001', message: 'OAuth token expired' },
        expectedStatus: HTTP_STATUS_CODES.UNAUTHORIZED
      },
      {
        error: { code: 'AUTH002', message: 'Insufficient permissions' },
        expectedStatus: HTTP_STATUS_CODES.FORBIDDEN
      },
      {
        error: { code: 'DATA001', message: 'Invalid data' },
        expectedStatus: HTTP_STATUS_CODES.BAD_REQUEST
      },
      {
        error: { code: 'API002', message: 'Endpoint not found' },
        expectedStatus: HTTP_STATUS_CODES.NOT_FOUND
      },
      {
        error: { code: 'SYS001', message: 'System error' },
        expectedStatus: HTTP_STATUS_CODES.SERVER_ERROR
      }
    ];

    for (const testCase of testCases) {
      const error: Partial<ErrorResponse> = {
        type: 'https://api.startupmetrics.com/errors/test',
        ...testCase.error,
        details: {},
        instance: '/errors/test'
      };

      errorHandler(error as ErrorResponse, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(testCase.expectedStatus);
    }
  });

  it('should implement security-conscious error reporting', async () => {
    const sensitiveError: ErrorResponse = {
      type: 'https://api.startupmetrics.com/errors/auth',
      code: 'AUTH001',
      message: 'Authentication failed',
      details: {
        stack: 'Error stack trace',
        password: 'secret123',
        token: 'sensitive-token',
        error: new Error('Internal details')
      },
      status: HTTP_STATUS_CODES.UNAUTHORIZED,
      instance: '/errors/test'
    };

    errorHandler(sensitiveError, mockRequest as Request, mockResponse as Response, mockNext);

    const responseJson = (mockResponse.json as jest.Mock).mock.calls[0][0];

    // Verify security headers
    expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Security-Policy', "default-src 'none'");

    // Verify sensitive data is not exposed
    expect(responseJson).not.toHaveProperty('details.stack');
    expect(responseJson).not.toHaveProperty('details.password');
    expect(responseJson).not.toHaveProperty('details.token');
    expect(responseJson.correlationId).toBe('test-correlation-id');
  });

  it('should handle non-ErrorResponse errors gracefully', async () => {
    const standardError = new Error('Unexpected error');

    errorHandler(standardError, mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      type: 'https://api.startupmetrics.com/errors/system-error',
      code: 'SYS003',
      status: HTTP_STATUS_CODES.SERVER_ERROR,
      title: 'Unexpected error'
    }));
  });

  it('should handle missing correlation ID', async () => {
    mockRequest.headers['x-correlation-id'] = undefined;
    const error = new Error('Test error');

    errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      correlationId: 'unknown'
    }));
  });

  it('should sanitize error details for safe external exposure', async () => {
    const errorWithDetails: ErrorResponse = {
      type: 'https://api.startupmetrics.com/errors/validation',
      code: 'DATA001',
      message: 'Validation error',
      details: {
        field: 'revenue',
        value: 'invalid',
        internal: {
          stack: 'Error stack',
          debug: 'Internal info'
        }
      },
      status: HTTP_STATUS_CODES.BAD_REQUEST,
      instance: '/errors/test'
    };

    errorHandler(errorWithDetails, mockRequest as Request, mockResponse as Response, mockNext);

    const responseJson = (mockResponse.json as jest.Mock).mock.calls[0][0];
    
    // Verify only safe fields are exposed
    expect(responseJson).toHaveProperty('field', 'revenue');
    expect(responseJson).toHaveProperty('value', 'invalid');
    expect(responseJson).not.toHaveProperty('internal');
  });
});