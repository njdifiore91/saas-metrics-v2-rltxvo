import { describe, it, expect, jest, beforeEach, afterEach } from 'jest'; // v29.0.0
import { Request, Response, NextFunction } from 'express'; // v4.18.2
import { createRequest, createResponse } from 'node-mocks-http'; // v1.12.0
import { validate as uuidValidate } from 'uuid'; // v9.0.0

import { requestLogger } from '../../../backend/src/api-gateway/src/middleware/logging.middleware';
import { Logger } from '../../../backend/src/shared/utils/logger';

// Mock Logger class
jest.mock('../../../backend/src/shared/utils/logger');

describe('API Gateway Logging Middleware', () => {
  let mockRequest: Request;
  let mockResponse: Response;
  let mockNext: NextFunction;
  let loggerInfoSpy: jest.SpyInstance;
  let loggerErrorSpy: jest.SpyInstance;
  let loggerDebugSpy: jest.SpyInstance;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Setup spies on Logger methods
    loggerInfoSpy = jest.spyOn(Logger.prototype, 'info');
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error');
    loggerDebugSpy = jest.spyOn(Logger.prototype, 'debug');
    
    // Initialize mock next function
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should generate and track unique request correlation ID', () => {
    // Setup
    mockRequest = createRequest({
      method: 'GET',
      url: '/api/v1/metrics'
    });
    mockResponse = createResponse();

    // Execute
    requestLogger(mockRequest, mockResponse, mockNext);

    // Verify correlation ID is added and valid
    expect(mockRequest['correlationId']).toBeDefined();
    expect(uuidValidate(mockRequest['correlationId'])).toBe(true);

    // Verify correlation ID is logged
    expect(loggerInfoSpy).toHaveBeenCalledWith(
      'Incoming request',
      expect.objectContaining({
        correlationId: mockRequest['correlationId']
      })
    );
  });

  it('should log request details with sanitized headers', () => {
    // Setup request with sensitive headers
    mockRequest = createRequest({
      method: 'POST',
      url: '/api/v1/metrics',
      headers: {
        'authorization': 'Bearer token123',
        'x-api-key': 'secret-key',
        'cookie': 'session=abc123',
        'content-type': 'application/json'
      }
    });
    mockResponse = createResponse();

    // Execute
    requestLogger(mockRequest, mockResponse, mockNext);

    // Verify sensitive headers are redacted
    expect(loggerInfoSpy).toHaveBeenCalledWith(
      'Incoming request',
      expect.objectContaining({
        headers: expect.objectContaining({
          'authorization': '[REDACTED]',
          'x-api-key': '[REDACTED]',
          'cookie': '[REDACTED]',
          'content-type': 'application/json'
        })
      })
    );
  });

  it('should track and log request performance metrics', async () => {
    // Setup
    mockRequest = createRequest({
      method: 'GET',
      url: '/api/v1/metrics'
    });
    mockResponse = createResponse();

    // Execute
    requestLogger(mockRequest, mockResponse, mockNext);

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Trigger response end
    mockResponse.end();

    // Verify performance metrics are logged
    expect(loggerInfoSpy).toHaveBeenCalledWith(
      'Request completed',
      expect.objectContaining({
        performance: expect.objectContaining({
          duration: expect.any(Number),
          timestamp: expect.any(Number)
        })
      })
    );
  });

  it('should handle and log errors with proper sanitization', () => {
    // Setup request that will result in error
    mockRequest = createRequest({
      method: 'POST',
      url: '/api/v1/metrics',
      headers: {
        'authorization': 'Bearer token123'
      }
    });
    mockResponse = createResponse({
      statusCode: 500
    });

    // Execute
    requestLogger(mockRequest, mockResponse, mockNext);

    // Trigger error response
    mockResponse.end();

    // Verify error is logged with sanitized data
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'Request failed',
      expect.any(Error)
    );
  });

  it('should log different levels based on response status', () => {
    // Setup cases for different status codes
    const testCases = [
      { status: 200, logMethod: 'info' },
      { status: 400, logMethod: 'warn' },
      { status: 500, logMethod: 'error' }
    ];

    testCases.forEach(({ status, logMethod }) => {
      mockRequest = createRequest({
        method: 'GET',
        url: '/api/v1/metrics'
      });
      mockResponse = createResponse({
        statusCode: status
      });

      // Execute
      requestLogger(mockRequest, mockResponse, mockNext);
      mockResponse.end();

      // Verify correct log level is used
      if (logMethod === 'error') {
        expect(loggerErrorSpy).toHaveBeenCalled();
      } else if (logMethod === 'info') {
        expect(loggerInfoSpy).toHaveBeenCalledWith(
          'Request completed',
          expect.any(Object)
        );
      }
    });
  });

  it('should include content length in response logging when available', () => {
    // Setup
    mockRequest = createRequest({
      method: 'GET',
      url: '/api/v1/metrics'
    });
    mockResponse = createResponse();
    mockResponse.setHeader('Content-Length', '1234');

    // Execute
    requestLogger(mockRequest, mockResponse, mockNext);
    mockResponse.end();

    // Verify content length is logged
    expect(loggerInfoSpy).toHaveBeenCalledWith(
      'Request completed',
      expect.objectContaining({
        response: expect.objectContaining({
          contentLength: 1234
        })
      })
    );
  });

  it('should preserve original response.end functionality', () => {
    // Setup
    mockRequest = createRequest();
    mockResponse = createResponse();
    const originalEnd = mockResponse.end;

    // Execute
    requestLogger(mockRequest, mockResponse, mockNext);
    mockResponse.end();

    // Verify original end was called
    expect(mockResponse.end).not.toBe(originalEnd);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should include environment metadata in logs', () => {
    // Setup
    process.env.NODE_ENV = 'test';
    mockRequest = createRequest();
    mockResponse = createResponse();

    // Execute
    requestLogger(mockRequest, mockResponse, mockNext);
    mockResponse.end();

    // Verify environment is included
    expect(loggerInfoSpy).toHaveBeenCalledWith(
      'Request completed',
      expect.objectContaining({
        metadata: expect.objectContaining({
          environment: 'test'
        })
      })
    );
  });
});