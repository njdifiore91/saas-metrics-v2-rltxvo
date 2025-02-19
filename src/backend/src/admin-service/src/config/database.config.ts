import { PrismaClient } from '@prisma/client'; // v4.0+

// Environment variables for database configuration
const DATABASE_URL = process.env.ADMIN_DB_URL;
const DATABASE_CONNECTION_LIMIT = parseInt(process.env.ADMIN_DB_CONNECTION_LIMIT || '10', 10);
const DATABASE_SSL_MODE = process.env.NODE_ENV === 'production';
const DATABASE_STATEMENT_TIMEOUT = parseInt(process.env.ADMIN_DB_STATEMENT_TIMEOUT || '30000', 10);
const DATABASE_IDLE_TIMEOUT = parseInt(process.env.ADMIN_DB_IDLE_TIMEOUT || '60000', 10);

/**
 * Validates the database configuration settings and environment variables
 * @throws Error if configuration is invalid
 * @returns boolean indicating if configuration is valid
 */
export const validateDatabaseConfig = (): boolean => {
  if (!DATABASE_URL) {
    throw new Error('Database URL is required but not provided in environment variables');
  }

  if (DATABASE_CONNECTION_LIMIT < 2 || DATABASE_CONNECTION_LIMIT > 50) {
    throw new Error('Connection limit must be between 2 and 50');
  }

  if (process.env.NODE_ENV === 'production' && !process.env.SSL_CA_CERT) {
    throw new Error('SSL CA certificate is required in production environment');
  }

  if (DATABASE_STATEMENT_TIMEOUT < 1000 || DATABASE_STATEMENT_TIMEOUT > 300000) {
    throw new Error('Statement timeout must be between 1000ms and 300000ms');
  }

  return true;
};

/**
 * Returns the database configuration object with comprehensive connection parameters
 * @returns Database configuration object
 */
export const getDatabaseConfig = () => {
  validateDatabaseConfig();

  return {
    datasources: {
      db: {
        url: DATABASE_URL,
      },
    },
    pool: {
      min: 2,
      max: DATABASE_CONNECTION_LIMIT,
    },
    ssl: DATABASE_SSL_MODE ? {
      rejectUnauthorized: true,
      ca: process.env.SSL_CA_CERT,
    } : false,
    connection: {
      statement_timeout: DATABASE_STATEMENT_TIMEOUT,
      idle_in_transaction_session_timeout: DATABASE_IDLE_TIMEOUT,
      connectionTimeoutMillis: 5000,
    },
    log: process.env.NODE_ENV === 'development' ? [
      'query',
      'error',
      'warn',
    ] : ['error'],
  };
};

/**
 * Creates and configures a new Prisma client instance with optimized settings
 * @returns Configured PrismaClient instance
 */
const createPrismaClient = (): PrismaClient => {
  const config = getDatabaseConfig();
  
  const prisma = new PrismaClient({
    datasources: config.datasources,
    log: config.log,
  });

  // Configure connection events
  prisma.$on('query', (e) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Query: ' + e.query);
      console.log('Duration: ' + e.duration + 'ms');
    }
  });

  prisma.$on('error', (e) => {
    console.error('Database error:', e.message);
  });

  return prisma;
};

// Export singleton instance of PrismaClient
export const prisma = createPrismaClient();

// Ensure proper cleanup on application shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export default prisma;