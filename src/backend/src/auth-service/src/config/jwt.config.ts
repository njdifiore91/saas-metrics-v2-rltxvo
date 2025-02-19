import { existsSync, accessSync, constants } from 'fs';
import * as jwt from 'jsonwebtoken'; // v9.0.0
import { AUTH_ERRORS } from '../../../shared/constants/error-codes';

/**
 * Interface defining comprehensive JWT configuration options with security best practices
 */
export interface JWTConfig {
  algorithm: string;
  expiresIn: string;
  issuer: string;
  audience: string;
  privateKeyPath: string;
  publicKeyPath: string;
  tokenBlacklistEnabled: boolean;
  maxTokenAge: string;
}

/**
 * Interface defining the secure structure of JWT token payload with RBAC support
 */
export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  permissions: string[];
  sessionId: string;
  issuedAt: number;
}

/**
 * Default JWT configuration with secure settings
 */
export const JWT_CONFIG: JWTConfig = {
  algorithm: 'RS256',
  expiresIn: '1h',
  issuer: 'startup-metrics-platform',
  audience: 'startup-metrics-api',
  privateKeyPath: process.env.JWT_PRIVATE_KEY_PATH || '',
  publicKeyPath: process.env.JWT_PUBLIC_KEY_PATH || '',
  tokenBlacklistEnabled: true,
  maxTokenAge: '30d'
};

/**
 * Retrieves and validates the JWT configuration with environment-specific settings
 * and security checks
 * @throws Error if configuration validation fails
 */
export function getJWTConfig(): JWTConfig {
  // Load and validate environment variables
  if (!process.env.JWT_PRIVATE_KEY_PATH || !process.env.JWT_PUBLIC_KEY_PATH) {
    throw new Error(AUTH_ERRORS.AUTH001);
  }

  const config: JWTConfig = {
    ...JWT_CONFIG,
    privateKeyPath: process.env.JWT_PRIVATE_KEY_PATH,
    publicKeyPath: process.env.JWT_PUBLIC_KEY_PATH
  };

  // Validate the configuration
  if (!validateJWTConfig(config)) {
    throw new Error(AUTH_ERRORS.AUTH002);
  }

  return config;
}

/**
 * Validates the JWT configuration for security compliance
 * @param config JWT configuration to validate
 * @returns boolean indicating whether the configuration is valid
 */
export function validateJWTConfig(config: JWTConfig): boolean {
  try {
    // Validate algorithm strength
    if (config.algorithm !== 'RS256') {
      return false;
    }

    // Validate expiration settings
    const expiresInMs = parseTimeToMs(config.expiresIn);
    const maxAgeMs = parseTimeToMs(config.maxTokenAge);
    if (expiresInMs <= 0 || maxAgeMs <= 0 || expiresInMs > maxAgeMs) {
      return false;
    }

    // Verify key files exist and are accessible
    if (!existsSync(config.privateKeyPath) || !existsSync(config.publicKeyPath)) {
      return false;
    }

    // Verify key file permissions
    try {
      accessSync(config.privateKeyPath, constants.R_OK);
      accessSync(config.publicKeyPath, constants.R_OK);
    } catch {
      return false;
    }

    // Validate issuer and audience
    if (!config.issuer || !config.audience) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Helper function to parse time strings to milliseconds
 * @param timeString Time string in format like '1h', '30d'
 * @returns milliseconds
 */
function parseTimeToMs(timeString: string): number {
  const unit = timeString.slice(-1);
  const value = parseInt(timeString.slice(0, -1), 10);

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return 0;
  }
}