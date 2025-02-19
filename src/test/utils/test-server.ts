import express, { Express } from 'express'; // v4.18.2
import supertest from 'supertest'; // v6.3.3
import pino from 'pino'; // v8.14.1
import helmet from 'helmet'; // v7.0.0
import app from '../../backend/src/api-gateway/src/app';
import { setupTestDatabase, teardownTestDatabase } from './database-helpers';

// Global test server and agent instances
let testServer: Express | null = null;
let testAgent: supertest.SuperTest<supertest.Test> | null = null;

// Configure test logger
const logger = pino({
  level: process.env.LOG_LEVEL || 'error',
  redact: ['req.headers.authorization', 'req.headers.cookie'],
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard'
    }
  }
});

/**
 * Test server configuration options
 */
interface TestServerOptions {
  enableSecurity?: boolean;
  enableCompression?: boolean;
  enableRateLimit?: boolean;
  timeoutMs?: number;
  maxRequestSize?: string;
}

/**
 * Test agent configuration options
 */
interface TestAgentOptions {
  retryCount?: number;
  retryDelay?: number;
  timeout?: number;
}

/**
 * Initializes and configures test server instance with enhanced security and monitoring
 * @param options Test server configuration options
 */
export const setupTestServer = async (options: TestServerOptions = {}): Promise<void> => {
  try {
    // Initialize test database
    await setupTestDatabase();

    // Create Express application instance
    testServer = express();

    // Apply security middleware if enabled
    if (options.enableSecurity) {
      testServer.use(helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'"],
            imgSrc: ["'self'", 'data:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"]
          }
        },
        crossOriginEmbedderPolicy: true,
        crossOriginOpenerPolicy: true,
        crossOriginResourcePolicy: { policy: 'same-site' }
      }));
    }

    // Configure request parsing
    testServer.use(express.json({
      limit: options.maxRequestSize || '10kb'
    }));
    testServer.use(express.urlencoded({
      extended: true,
      limit: options.maxRequestSize || '10kb'
    }));

    // Mount API routes
    testServer.use('/api/v1', app);

    // Create supertest agent
    testAgent = supertest(testServer);

    // Configure request timeout
    if (options.timeoutMs) {
      testServer.timeout = options.timeoutMs;
    }

    // Add health check endpoint
    testServer.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: 'test'
      });
    });

    logger.info('Test server initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize test server:', error);
    throw error;
  }
};

/**
 * Cleans up test server, database connections, and monitoring resources
 */
export const teardownTestServer = async (): Promise<void> => {
  try {
    // Close database connections
    await teardownTestDatabase();

    // Clear test server instance
    testServer = null;
    testAgent = null;

    logger.info('Test server teardown completed successfully');
  } catch (error) {
    logger.error('Failed to teardown test server:', error);
    throw error;
  }
};

/**
 * Returns configured supertest agent with enhanced timeout and retry capabilities
 * @param options Test agent configuration options
 */
export const getTestAgent = (options: TestAgentOptions = {}): supertest.SuperTest<supertest.Test> => {
  if (!testAgent) {
    throw new Error('Test server not initialized. Call setupTestServer first.');
  }

  const agent = testAgent;

  // Configure retry behavior
  if (options.retryCount) {
    agent.retry(options.retryCount);
  }

  // Configure timeout
  if (options.timeout) {
    agent.timeout(options.timeout);
  }

  return agent;
};

// Cleanup on process termination
process.on('SIGTERM', async () => {
  await teardownTestServer();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await teardownTestServer();
  process.exit(0);
});