import winston from 'winston';  // v3.8.2
import DailyRotateFile from 'winston-daily-rotate-file';  // v4.7.1
import { ErrorResponse } from '../constants/error-codes';

// Define log levels with numeric priorities
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for different log levels
const LOG_COLORS = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Add colors to Winston
winston.addColors(LOG_COLORS);

/**
 * Formats error objects into structured log entries compatible with ELK stack
 * @param error - Error object or ErrorResponse to be formatted
 * @returns Structured error log entry
 */
const formatError = (error: Error | ErrorResponse): object => {
  const timestamp = new Date().toISOString();
  const errorObject: any = {
    timestamp,
    level: 'error',
    message: error.message,
  };

  if ('code' in error) {
    errorObject.code = error.code;
  }

  if (error instanceof Error) {
    errorObject.stack = error.stack;
    errorObject.name = error.name;
  }

  return errorObject;
};

/**
 * Creates a configured Winston logger instance with all necessary transports
 * @param service - Name of the service for context
 * @returns Configured Winston logger instance
 */
export const createLogger = (service: string): winston.Logger => {
  // Define custom format combining timestamp, service context and JSON
  const customFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format.printf((info) => {
      const { timestamp, level, message, ...meta } = info;
      return JSON.stringify({
        timestamp,
        level,
        service,
        message,
        ...meta,
      });
    })
  );

  // Configure file rotation transport
  const fileRotateTransport = new DailyRotateFile({
    filename: `logs/${service}-%DATE%.log`,
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    compress: true,
    format: customFormat,
  });

  // Create and configure logger
  return winston.createLogger({
    levels: LOG_LEVELS,
    format: customFormat,
    transports: [
      // Console transport with colors for development
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        ),
      }),
      // File transport with rotation
      fileRotateTransport,
    ],
  });
};

/**
 * Main logger class providing structured logging functionality with ELK integration
 */
export class Logger {
  private logger: winston.Logger;
  private service: string;

  /**
   * Creates a new Logger instance
   * @param service - Name of the service for context
   */
  constructor(service: string) {
    this.service = service;
    this.logger = createLogger(service);
  }

  /**
   * Logs error messages with stack traces and context
   * @param message - Error message
   * @param error - Error object or ErrorResponse
   */
  error(message: string, error: Error | ErrorResponse): void {
    const errorData = formatError(error);
    this.logger.error({
      message,
      ...errorData,
      service: this.service,
      environment: process.env.NODE_ENV,
      correlationId: this.getCorrelationId(),
    });
  }

  /**
   * Logs informational messages with metadata
   * @param message - Info message
   * @param meta - Additional metadata
   */
  info(message: string, meta: object = {}): void {
    this.logger.info({
      message,
      ...meta,
      service: this.service,
      environment: process.env.NODE_ENV,
      correlationId: this.getCorrelationId(),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Logs debug messages with detailed context
   * @param message - Debug message
   * @param context - Debug context
   */
  debug(message: string, context: object = {}): void {
    this.logger.debug({
      message,
      ...context,
      service: this.service,
      environment: process.env.NODE_ENV,
      correlationId: this.getCorrelationId(),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Retrieves correlation ID from async storage or generates a new one
   * @private
   * @returns Correlation ID for request tracking
   */
  private getCorrelationId(): string {
    // In a real implementation, this would retrieve from async storage
    // For now, return a random ID
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}