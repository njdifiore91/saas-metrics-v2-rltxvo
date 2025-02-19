import Redis from 'ioredis'; // v5.3.2
import { Logger } from 'winston'; // v3.8.2
import CircuitBreaker from 'opossum'; // v6.4.0

// Redis cluster nodes configuration
const REDIS_CLUSTER_NODES = [{
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10)
}];

// Redis client configuration options
const REDIS_OPTIONS = {
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  connectTimeout: 10000,
  keepAlive: 30000,
  enableAutoPipelining: true,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  clusterRetryStrategy: (times: number) => {
    const delay = Math.min(times * 100, 3000);
    return delay;
  }
};

// Cache TTL configurations in seconds
export const CACHE_TTL = {
  BENCHMARK_DATA: 24 * 60 * 60,    // 24 hours
  USER_METRICS: 15 * 60,           // 15 minutes
  REPORT_TEMPLATES: 60 * 60,       // 1 hour
  AGGREGATED_STATS: 30 * 60        // 30 minutes
};

// Circuit breaker configuration
const CIRCUIT_BREAKER_OPTIONS = {
  timeout: 3000,                   // 3 seconds
  errorThresholdPercentage: 50,    // 50% error rate triggers open circuit
  resetTimeout: 30000,             // 30 seconds before attempting reset
  rollingCountTimeout: 10000,      // 10 seconds statistical window
  rollingCountBuckets: 10         // Split window into 10 buckets
};

// Create logger instance for Redis operations
const logger = new Logger({
  level: 'info',
  transports: [
    // Add your logger transports configuration here
  ]
});

/**
 * Handles Redis operation errors and manages circuit breaker state
 */
const handleRedisError = (error: Error, operation: string): void => {
  logger.error(`Redis ${operation} error:`, {
    error: error.message,
    stack: error.stack,
    operation,
    timestamp: new Date().toISOString()
  });

  // Update error metrics
  // Implementation depends on your metrics collection system
  monitorRedisPerformance(redisClient);
};

/**
 * Monitors Redis performance metrics and cache efficiency
 */
const monitorRedisPerformance = (client: Redis): void => {
  const metrics = {
    connectedClients: 0,
    usedMemory: 0,
    hitRate: 0,
    missRate: 0,
    operationLatency: 0
  };

  client.info().then((info) => {
    // Parse Redis INFO command output and update metrics
    logger.debug('Redis performance metrics:', metrics);
  }).catch((error) => {
    logger.error('Failed to collect Redis metrics:', error);
  });
};

/**
 * Creates and configures a Redis client with high availability and monitoring
 */
const createRedisClient = (): CircuitBreaker<Redis> => {
  // Create Redis cluster client
  const client = new Redis.Cluster(REDIS_CLUSTER_NODES, {
    ...REDIS_OPTIONS,
    redisOptions: REDIS_OPTIONS
  });

  // Create circuit breaker
  const breaker = new CircuitBreaker(client, CIRCUIT_BREAKER_OPTIONS);

  // Set up event handlers
  client.on('connect', () => {
    logger.info('Redis client connected');
  });

  client.on('error', (error) => {
    handleRedisError(error, 'connection');
  });

  client.on('close', () => {
    logger.warn('Redis connection closed');
  });

  client.on('reconnecting', () => {
    logger.info('Redis client reconnecting');
  });

  // Set up circuit breaker event handlers
  breaker.on('open', () => {
    logger.warn('Redis circuit breaker opened');
  });

  breaker.on('halfOpen', () => {
    logger.info('Redis circuit breaker half-open');
  });

  breaker.on('close', () => {
    logger.info('Redis circuit breaker closed');
  });

  // Start performance monitoring
  setInterval(() => {
    monitorRedisPerformance(client);
  }, 60000); // Monitor every minute

  return breaker;
};

// Create and export Redis client instance
export const redisClient = createRedisClient();

// Export health check function
export const checkRedisHealth = async (): Promise<boolean> => {
  try {
    await redisClient.fire('ping');
    return true;
  } catch (error) {
    logger.error('Redis health check failed:', error);
    return false;
  }
};

// Export wrapped Redis client with common operations
export default {
  get: async (key: string): Promise<string | null> => {
    return redisClient.fire('get', key);
  },
  set: async (key: string, value: string, ttl?: number): Promise<'OK'> => {
    return ttl 
      ? redisClient.fire('setex', key, ttl, value)
      : redisClient.fire('set', key, value);
  },
  del: async (key: string): Promise<number> => {
    return redisClient.fire('del', key);
  },
  flushdb: async (): Promise<'OK'> => {
    return redisClient.fire('flushdb');
  },
  health: checkRedisHealth
};