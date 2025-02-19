import { S3Client, S3ClientConfig, ServerSideEncryption } from '@aws-sdk/client-s3'; // @aws-sdk/client-s3 v3.x

// Environment variables with defaults
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || 'startup-metrics-reports';
const S3_ENCRYPTION_KEY = process.env.S3_ENCRYPTION_KEY;
const S3_MAX_RETRIES = Number(process.env.S3_MAX_RETRIES || 3);
const S3_TIMEOUT = Number(process.env.S3_TIMEOUT || 5000);

/**
 * Validates storage configuration parameters and environment variables
 * @throws Error if configuration is invalid
 * @returns boolean True if configuration is valid
 */
const validateConfig = (): boolean => {
  // Validate AWS region format
  const regionRegex = /^[a-z]{2}-[a-z]+-\d{1}$/;
  if (!regionRegex.test(AWS_REGION)) {
    throw new Error(`Invalid AWS region format: ${AWS_REGION}`);
  }

  // Validate bucket name format
  const bucketRegex = /^[a-z0-9][a-z0-9.-]*[a-z0-9]$/;
  if (!bucketRegex.test(S3_BUCKET_NAME)) {
    throw new Error(`Invalid S3 bucket name format: ${S3_BUCKET_NAME}`);
  }

  // Validate encryption key
  if (!S3_ENCRYPTION_KEY || S3_ENCRYPTION_KEY.length < 32) {
    throw new Error('Invalid or missing S3 encryption key');
  }

  // Validate numeric parameters
  if (S3_MAX_RETRIES < 1 || S3_MAX_RETRIES > 10) {
    throw new Error('S3_MAX_RETRIES must be between 1 and 10');
  }

  if (S3_TIMEOUT < 1000 || S3_TIMEOUT > 30000) {
    throw new Error('S3_TIMEOUT must be between 1000 and 30000 ms');
  }

  return true;
};

/**
 * Creates and configures an S3 client instance with enhanced security and performance settings
 * @returns S3Client Configured S3 client instance
 */
const createS3Client = (): S3Client => {
  // Validate configuration before creating client
  validateConfig();

  // Configure S3 client with enhanced settings
  const s3Config: S3ClientConfig = {
    region: AWS_REGION,
    credentials: {
      // Using environment variables: AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
    maxAttempts: S3_MAX_RETRIES,
    requestTimeout: S3_TIMEOUT,
    // Enable TCP keep-alive for persistent connections
    keepAlive: true,
    // Configure connection timeout
    connectTimeout: 5000,
    // Configure SDK retry strategy
    retryMode: 'adaptive',
  };

  return new S3Client(s3Config);
};

/**
 * Storage configuration object with enhanced security and performance settings
 */
export const storageConfig = {
  s3Client: createS3Client(),
  bucketName: S3_BUCKET_NAME,
  region: AWS_REGION,
  encryptionKey: S3_ENCRYPTION_KEY,
  maxRetries: S3_MAX_RETRIES,
  timeout: S3_TIMEOUT,
  // Default server-side encryption configuration
  encryptionConfig: {
    ServerSideEncryption: ServerSideEncryption.AES256,
    SSEKMSKeyId: S3_ENCRYPTION_KEY,
  },
  // Default storage class for reports
  storageClass: 'STANDARD',
  // Versioning enabled by default
  versioning: true,
  // Default content type for reports
  defaultContentType: 'application/pdf',
  // Cache control settings
  cacheControl: 'private, max-age=3600',
  // CORS configuration
  corsEnabled: true,
  // Lifecycle policy enabled
  lifecycleEnabled: true,
  // Monitoring enabled
  monitoringEnabled: true,
} as const;

// Type definition for storage configuration
export type StorageConfig = typeof storageConfig;

// Export individual configuration values
export const {
  s3Client,
  bucketName,
  region,
  encryptionKey,
  maxRetries,
  timeout
} = storageConfig;