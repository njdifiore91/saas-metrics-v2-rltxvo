import winston from 'winston'; // v3.8.2
import { Logger, createLogger } from '../../../backend/src/shared/utils/logger';
import { ErrorResponse } from '../../../backend/src/shared/constants/error-codes';

// Mock Winston logger
jest.mock('winston', () => ({
  createLogger: jest.fn(),
  format: {
    json: jest.fn(),
    timestamp: jest.fn(),
    combine: jest.fn(),
    printf: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn()
  },
  transports: {
    Console: jest.fn()
  },
  addColors: jest.fn()
}));

// Mock Winston daily rotate file transport
jest.mock('winston-daily-rotate-file', () => jest.fn());

describe('Logger', () => {
  let mockWinstonLogger: any;
  const SERVICE_NAME = 'test-service';
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock Winston logger
    mockWinstonLogger = {
      error: jest.fn(),
      info: jest.fn(),
      debug: jest.fn()
    };
    
    (winston.createLogger as jest.Mock).mockReturnValue(mockWinstonLogger);
    (winston.format.combine as jest.Mock).mockReturnValue({});
    (winston.format.timestamp as jest.Mock).mockReturnValue({});
    (winston.format.json as jest.Mock).mockReturnValue({});
    (winston.format.printf as jest.Mock).mockImplementation(fn => fn);
  });

  describe('createLogger', () => {
    it('should create logger instance with ELK configuration', () => {
      const logger = createLogger(SERVICE_NAME);

      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          format: expect.any(Object),
          transports: expect.arrayContaining([
            expect.any(Object), // Console transport
            expect.any(Object)  // File transport
          ])
        })
      );

      expect(winston.format.combine).toHaveBeenCalledWith(
        expect.any(Object), // timestamp
        expect.any(Object), // json
        expect.any(Object)  // printf
      );
    });

    it('should configure proper log levels', () => {
      const logger = createLogger(SERVICE_NAME);

      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          levels: {
            error: 0,
            warn: 1,
            info: 2,
            http: 3,
            debug: 4
          }
        })
      );
    });
  });

  describe('Logger class methods', () => {
    let logger: Logger;

    beforeEach(() => {
      logger = new Logger(SERVICE_NAME);
    });

    it('should log error messages with proper ELK formatting', () => {
      const errorMessage = 'Test error message';
      const error: ErrorResponse = {
        type: 'https://api.startup-metrics.com/errors/auth',
        status: 401,
        code: 'AUTH001',
        message: 'Authentication failed',
        details: { reason: 'Token expired' },
        instance: '/api/metrics/123'
      };

      logger.error(errorMessage, error);

      expect(mockWinstonLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: errorMessage,
          code: error.code,
          service: SERVICE_NAME,
          environment: process.env.NODE_ENV,
          correlationId: expect.any(String),
          type: error.type,
          status: error.status,
          details: error.details,
          instance: error.instance
        })
      );
    });

    it('should log error messages with stack traces for Error objects', () => {
      const errorMessage = 'Test error message';
      const error = new Error('System error');
      error.stack = 'Error stack trace';

      logger.error(errorMessage, error);

      expect(mockWinstonLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: errorMessage,
          name: error.name,
          stack: error.stack,
          service: SERVICE_NAME,
          environment: process.env.NODE_ENV,
          correlationId: expect.any(String)
        })
      );
    });

    it('should log info messages with metadata for ELK', () => {
      const infoMessage = 'Test info message';
      const metadata = {
        userId: '123',
        action: 'metric_update',
        category: 'financial'
      };

      logger.info(infoMessage, metadata);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          message: infoMessage,
          ...metadata,
          service: SERVICE_NAME,
          environment: process.env.NODE_ENV,
          correlationId: expect.any(String),
          timestamp: expect.any(String)
        })
      );
    });

    it('should log debug messages with context for troubleshooting', () => {
      const debugMessage = 'Test debug message';
      const context = {
        function: 'calculateMetrics',
        parameters: { timeRange: '30d', metricType: 'ARR' },
        state: { processingStep: 'validation' }
      };

      logger.debug(debugMessage, context);

      expect(mockWinstonLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          message: debugMessage,
          ...context,
          service: SERVICE_NAME,
          environment: process.env.NODE_ENV,
          correlationId: expect.any(String),
          timestamp: expect.any(String)
        })
      );
    });

    it('should generate unique correlation IDs for request tracking', () => {
      const message = 'Test message';
      const correlationIds = new Set();

      // Make multiple log calls and collect correlation IDs
      for (let i = 0; i < 10; i++) {
        logger.info(message);
        const call = mockWinstonLogger.info.mock.calls[i][0];
        correlationIds.add(call.correlationId);
      }

      // Verify all correlation IDs were unique
      expect(correlationIds.size).toBe(10);
    });

    it('should include timestamp in ISO8601 format', () => {
      const message = 'Test message';
      
      logger.info(message);

      const call = mockWinstonLogger.info.mock.calls[0][0];
      expect(call.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });
  });
});