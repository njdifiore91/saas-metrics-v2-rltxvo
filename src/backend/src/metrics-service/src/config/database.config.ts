import { PrismaClient } from '@prisma/client'; // v4.0+
import { createLogger, format, transports, Logger } from 'winston'; // v3.8+

// Environment variables with defaults
const DATABASE_URL = process.env.DATABASE_URL;
const MAX_CONNECTIONS = Number(process.env.DB_MAX_CONNECTIONS) || 10;
const IDLE_TIMEOUT = Number(process.env.DB_IDLE_TIMEOUT) || 30000;
const QUERY_TIMEOUT = Number(process.env.DB_QUERY_TIMEOUT) || 5000;

// Configure Winston logger for database operations
const dbLogger: Logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.json(),
    format.metadata()
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    }),
    new transports.File({ 
      filename: 'logs/database-error.log', 
      level: 'error' 
    }),
    new transports.File({ 
      filename: 'logs/database.log'
    })
  ]
});

// Database error handler with retry logic
async function handleDatabaseError(
  error: Error, 
  operation: string, 
  context: Record<string, any>
): Promise<void> {
  const errorContext = {
    operation,
    error: {
      message: error.message,
      name: error.name,
      stack: error.stack
    },
    context
  };

  // Log error with context
  dbLogger.error('Database operation failed', errorContext);

  // Classify error type
  if (error.message.includes('Connection')) {
    // Implement exponential backoff for connection errors
    const retryCount = context.retryCount || 0;
    if (retryCount < 3) {
      const backoffTime = Math.pow(2, retryCount) * 1000;
      dbLogger.info(`Retrying connection after ${backoffTime}ms`);
      await new Promise(resolve => setTimeout(resolve, backoffTime));
      throw new Error(`Database connection retry ${retryCount + 1}`);
    }
  }

  if (error.message.includes('Timeout')) {
    dbLogger.warn('Query timeout occurred', { queryTimeout: QUERY_TIMEOUT });
    throw new Error('Database query timeout');
  }

  // Critical failure logging
  if (error.message.includes('FATAL')) {
    dbLogger.error('Critical database error occurred', errorContext);
    // Trigger alert through monitoring system
  }

  throw error;
}

// Create configured Prisma client
function createPrismaClient(): PrismaClient {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: DATABASE_URL
      }
    },
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'event' },
      { level: 'info', emit: 'event' },
      { level: 'warn', emit: 'event' }
    ]
  });

  // Query logging and performance monitoring middleware
  prisma.$use(async (params, next) => {
    const start = Date.now();
    const result = await next(params);
    const duration = Date.now() - start;

    dbLogger.info('Database query executed', {
      model: params.model,
      action: params.action,
      duration,
      timestamp: new Date().toISOString()
    });

    // Performance monitoring for slow queries
    if (duration > 1000) {
      dbLogger.warn('Slow query detected', {
        model: params.model,
        action: params.action,
        duration,
        query: params.args
      });
    }

    return result;
  });

  // Error handling middleware
  prisma.$use(async (params, next) => {
    try {
      return await next(params);
    } catch (error) {
      await handleDatabaseError(error as Error, `${params.model}.${params.action}`, params);
      throw error;
    }
  });

  // Configure event listeners
  prisma.$on('query', (event) => {
    dbLogger.debug('Query executed', {
      query: event.query,
      params: event.params,
      duration: event.duration
    });
  });

  prisma.$on('error', (event) => {
    dbLogger.error('Database error occurred', {
      target: event.target,
      message: event.message
    });
  });

  // Initialize connection pool
  const pool = {
    max: MAX_CONNECTIONS,
    min: 2,
    idleTimeoutMillis: IDLE_TIMEOUT,
    acquireTimeoutMillis: QUERY_TIMEOUT
  };

  // Verify database connectivity
  prisma.$connect()
    .then(() => {
      dbLogger.info('Database connection established', {
        url: DATABASE_URL?.replace(/\/\/.*@/, '//***@'), // Redact credentials
        pool: {
          maxConnections: pool.max,
          idleTimeout: pool.idleTimeoutMillis
        }
      });
    })
    .catch((error) => {
      dbLogger.error('Failed to establish database connection', {
        error: error.message
      });
      process.exit(1);
    });

  return prisma;
}

// Create and export singleton instance
const prisma = createPrismaClient();

export default prisma;