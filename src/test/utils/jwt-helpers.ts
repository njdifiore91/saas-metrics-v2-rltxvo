import * as jwt from 'jsonwebtoken'; // v9.0.0
import * as fs from 'fs';
import { JWT_CONFIG } from '../../backend/src/auth-service/src/config/jwt.config';

/**
 * Interface defining options for generating test JWT tokens
 */
export interface TestTokenOptions {
  userId: string;
  email: string;
  role?: string;
  permissions?: string[];
  expiresIn?: string;
}

/**
 * Retrieves RSA key pair for test token signing and verification
 * @returns Object containing public and private RSA keys for testing
 * @throws Error if keys cannot be loaded
 */
export function getTestKeys(): { privateKey: string; publicKey: string } {
  try {
    const privateKey = fs.readFileSync('src/test/keys/test-private.key', 'utf8');
    const publicKey = fs.readFileSync('src/test/keys/test-public.key', 'utf8');

    if (!privateKey || !publicKey) {
      throw new Error('Failed to load test keys');
    }

    return { privateKey, publicKey };
  } catch (error) {
    throw new Error(`Failed to load test keys: ${error.message}`);
  }
}

/**
 * Generates a JWT token for testing purposes with configurable options
 * @param options Test token configuration options
 * @returns Signed JWT token string
 */
export function generateTestToken(options: TestTokenOptions): string {
  const { privateKey } = getTestKeys();
  
  const payload = {
    userId: options.userId,
    email: options.email,
    role: options.role || 'user',
    permissions: options.permissions || [],
    sessionId: `test-session-${Date.now()}`,
    issuedAt: Math.floor(Date.now() / 1000)
  };

  const signOptions: jwt.SignOptions = {
    algorithm: JWT_CONFIG.algorithm as jwt.Algorithm,
    expiresIn: options.expiresIn || JWT_CONFIG.expiresIn,
    issuer: JWT_CONFIG.issuer,
    audience: JWT_CONFIG.audience,
    keyid: 'test-key-1',
    header: {
      typ: 'JWT'
    }
  };

  return jwt.sign(payload, privateKey, signOptions);
}

/**
 * Creates an expired JWT token for testing error handling
 * @param options Test token configuration options
 * @returns Expired JWT token string
 */
export function generateExpiredToken(options: TestTokenOptions): string {
  return generateTestToken({
    ...options,
    expiresIn: '-1h' // Force token to be expired
  });
}

/**
 * Decodes and verifies a JWT token using test public key
 * @param token JWT token string to decode
 * @returns Decoded token payload if valid
 * @throws JsonWebTokenError if token is invalid
 */
export function decodeTestToken(token: string): jwt.JwtPayload {
  const { publicKey } = getTestKeys();

  const verifyOptions: jwt.VerifyOptions = {
    algorithms: [JWT_CONFIG.algorithm as jwt.Algorithm],
    issuer: JWT_CONFIG.issuer,
    audience: JWT_CONFIG.audience
  };

  return jwt.verify(token, publicKey, verifyOptions) as jwt.JwtPayload;
}