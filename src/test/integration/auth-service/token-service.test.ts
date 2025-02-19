import { describe, it, expect, beforeEach, afterEach, jest } from 'jest'; // v29.0.0
import { Redis } from 'ioredis'; // v5.0.0
import { AuthService } from '../../../backend/src/auth-service/src/services/auth.service';
import { JWT_CONFIG } from '../../../backend/src/auth-service/src/config/jwt.config';
import { 
  generateTestToken, 
  generateExpiredToken, 
  TestTokenOptions,
  getTestKeys 
} from '../../utils/jwt-helpers';
import { AUTH_ERRORS } from '../../../backend/src/shared/constants/error-codes';

describe('Token Service Integration Tests', () => {
  let authService: AuthService;
  let redisClient: Redis;
  let mockUserModel: any;

  beforeEach(async () => {
    // Initialize Redis client with test configuration
    redisClient = new Redis({
      host: process.env.REDIS_TEST_HOST || 'localhost',
      port: parseInt(process.env.REDIS_TEST_PORT || '6379'),
      db: 1 // Use separate DB for tests
    });

    // Mock user model for testing
    mockUserModel = {
      findOne: jest.fn(),
      updateOne: jest.fn(),
      create: jest.fn()
    };

    // Initialize logger mock
    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    // Initialize auth service
    authService = new AuthService(mockUserModel, redisClient, mockLogger);

    // Clear Redis test database
    await redisClient.flushdb();

    // Generate test RSA keys
    const { privateKey, publicKey } = getTestKeys();
    process.env.JWT_PRIVATE_KEY_PATH = privateKey;
    process.env.JWT_PUBLIC_KEY_PATH = publicKey;
  });

  afterEach(async () => {
    await redisClient.quit();
    jest.clearAllMocks();
  });

  describe('Token Generation', () => {
    it('should generate valid JWT token with correct claims', async () => {
      const testUser = {
        id: 'test-user-1',
        email: 'test@example.com',
        role: 'user',
        lastLogin: new Date()
      };

      const token = await authService.handleGoogleCallback('test-code', 'test-state');
      
      expect(token).toBeDefined();
      expect(typeof token.token).toBe('string');
      
      const decoded = await authService.verifyToken(token.token);
      expect(decoded).toMatchObject({
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role
      });
      expect(decoded.sessionId).toBeDefined();
      expect(decoded.issuedAt).toBeDefined();
    });

    it('should use RS256 algorithm and correct expiration', async () => {
      const testOptions: TestTokenOptions = {
        userId: 'test-user-1',
        email: 'test@example.com'
      };

      const token = generateTestToken(testOptions);
      expect(token.split('.')[0]).toContain('RS256');
      
      const decoded = await authService.verifyToken(token);
      const expirationTime = decoded.exp! - decoded.iat!;
      expect(expirationTime).toBe(3600); // 1 hour in seconds
    });
  });

  describe('Token Validation', () => {
    it('should validate tokens and verify signatures', async () => {
      const token = generateTestToken({
        userId: 'test-user-1',
        email: 'test@example.com',
        role: 'user'
      });

      const decoded = await authService.verifyToken(token);
      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe('test-user-1');
    });

    it('should reject expired tokens', async () => {
      const expiredToken = generateExpiredToken({
        userId: 'test-user-1',
        email: 'test@example.com'
      });

      await expect(authService.verifyToken(expiredToken))
        .rejects
        .toThrow(AUTH_ERRORS.AUTH001);
    });

    it('should reject blacklisted tokens', async () => {
      const token = generateTestToken({
        userId: 'test-user-1',
        email: 'test@example.com'
      });

      // Blacklist the token
      await redisClient.set(`blacklist:${token}`, '1', 'EX', 3600);

      await expect(authService.verifyToken(token))
        .rejects
        .toThrow(AUTH_ERRORS.AUTH001);
    });
  });

  describe('Session Management', () => {
    it('should enforce maximum concurrent sessions', async () => {
      const userId = 'test-user-1';
      const maxSessions = JWT_CONFIG.maxSessions || 3;

      // Create maximum allowed sessions
      for (let i = 0; i < maxSessions; i++) {
        await authService.handleGoogleCallback('test-code', 'test-state');
      }

      // Attempt to create one more session
      const result = await authService.handleGoogleCallback('test-code', 'test-state');
      
      // Verify oldest session was removed
      const sessions = await redisClient.keys(`session:${userId}:*`);
      expect(sessions.length).toBe(maxSessions);
      expect(result.sessionId).toBeDefined();
    });

    it('should track session activity and update last active time', async () => {
      const token = await authService.handleGoogleCallback('test-code', 'test-state');
      const initialSession = await redisClient.get(`session:${token.user.id}:${token.sessionId}`);
      
      // Wait briefly to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await authService.verifyToken(token.token);
      
      const updatedSession = await redisClient.get(`session:${token.user.id}:${token.sessionId}`);
      expect(JSON.parse(updatedSession!).lastActivity)
        .toBeGreaterThan(JSON.parse(initialSession!).lastActivity);
    });
  });

  describe('Token Refresh', () => {
    it('should refresh tokens with sliding expiration', async () => {
      const initialToken = await authService.handleGoogleCallback('test-code', 'test-state');
      
      // Wait briefly
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const refreshedToken = await authService.refreshToken(initialToken.token);
      
      expect(refreshedToken).toBeDefined();
      expect(refreshedToken).not.toBe(initialToken.token);
      
      const decodedRefresh = await authService.verifyToken(refreshedToken);
      expect(decodedRefresh.exp).toBeGreaterThan(
        (await authService.verifyToken(initialToken.token)).exp!
      );
    });

    it('should blacklist old tokens after refresh', async () => {
      const initialToken = await authService.handleGoogleCallback('test-code', 'test-state');
      const refreshedToken = await authService.refreshToken(initialToken.token);
      
      await expect(authService.verifyToken(initialToken.token))
        .rejects
        .toThrow(AUTH_ERRORS.AUTH001);
      
      const isBlacklisted = await redisClient.exists(`blacklist:${initialToken.token}`);
      expect(isBlacklisted).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed tokens', async () => {
      await expect(authService.verifyToken('malformed.token.here'))
        .rejects
        .toThrow(AUTH_ERRORS.AUTH003);
    });

    it('should handle rate limiting', async () => {
      const attempts = 10;
      const promises = Array(attempts).fill(null).map(() => 
        authService.handleGoogleCallback('test-code', 'test-state')
      );
      
      await expect(Promise.all(promises))
        .rejects
        .toThrow(/rate limit/i);
    });
  });
});