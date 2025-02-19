import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals'; // v29.0.0
import supertest from 'supertest'; // v6.3.3
import { Redis } from 'ioredis';
import { OAuth2Client } from 'google-auth-library';
import { Logger } from 'winston';

import { AuthService } from '../../../backend/src/auth-service/src/services/auth.service';
import { MockAuthService, mockUser, mockToken } from '../../mocks/auth-service.mock';
import { generateTestToken, generateExpiredToken, decodeTestToken } from '../../utils/jwt-helpers';
import { AUTH_ERRORS, HTTP_STATUS_CODES } from '../../../backend/src/shared/constants/error-codes';
import { UserRole } from '../../../backend/src/shared/interfaces/user.interface';

describe('AuthService', () => {
  let authService: AuthService;
  let mockRedisClient: jest.Mocked<Redis>;
  let mockUserModel: any;
  let mockLogger: jest.Mocked<Logger>;
  let mockGoogleClient: jest.Mocked<OAuth2Client>;

  beforeEach(() => {
    // Initialize mocks
    mockRedisClient = {
      setex: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      keys: jest.fn(),
    } as any;

    mockUserModel = {
      findOne: jest.fn(),
      create: jest.fn(),
      updateOne: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockGoogleClient = {
      generateAuthUrl: jest.fn(),
      getToken: jest.fn(),
      verifyIdToken: jest.fn(),
    } as any;

    // Initialize AuthService with mocks
    authService = new AuthService(mockUserModel, mockRedisClient, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Google OAuth Flow', () => {
    const mockCode = 'valid-auth-code';
    const mockState = 'valid-state';
    const mockGoogleProfile = {
      email: 'test@example.com',
      name: 'Test User',
      sub: 'google-user-id',
    };

    it('should handle Google OAuth callback successfully', async () => {
      // Setup mocks
      mockGoogleClient.getToken.mockResolvedValue({
        tokens: { id_token: 'mock-id-token' },
      });
      mockGoogleClient.verifyIdToken.mockResolvedValue({
        getPayload: () => mockGoogleProfile,
      });
      mockUserModel.findOne.mockResolvedValue(mockUser);
      mockRedisClient.exists.mockResolvedValue(0);

      // Execute test
      const result = await authService.handleGoogleCallback(mockCode, mockState);

      // Verify results
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('sessionId');
      expect(result.user.email).toBe(mockUser.email);
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should enforce rate limiting on OAuth requests', async () => {
      // Setup rate limit exceeded scenario
      mockRedisClient.get.mockResolvedValue('{"points": 0}');

      // Execute and verify
      await expect(
        authService.handleGoogleCallback(mockCode, mockState)
      ).rejects.toMatchObject({
        status: HTTP_STATUS_CODES.RATE_LIMIT,
        code: 'SYS001',
      });
    });
  });

  describe('JWT Token Management', () => {
    const testToken = generateTestToken({
      userId: mockUser.id,
      email: mockUser.email,
      role: UserRole.USER,
    });

    it('should verify valid JWT token', async () => {
      // Setup mocks
      mockRedisClient.exists.mockResolvedValue(0);
      mockRedisClient.get.mockResolvedValue(
        JSON.stringify({
          userId: mockUser.id,
          sessionId: 'test-session',
          lastActivity: Date.now(),
        })
      );

      // Execute test
      const result = await authService.verifyToken(testToken);

      // Verify results
      expect(result).toHaveProperty('userId', mockUser.id);
      expect(result).toHaveProperty('email', mockUser.email);
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should reject blacklisted tokens', async () => {
      // Setup blacklisted token
      mockRedisClient.exists.mockResolvedValue(1);

      // Execute and verify
      await expect(authService.verifyToken(testToken)).rejects.toMatchObject({
        code: AUTH_ERRORS.AUTH001,
      });
    });

    it('should reject expired tokens', async () => {
      const expiredToken = generateExpiredToken({
        userId: mockUser.id,
        email: mockUser.email,
      });

      await expect(authService.verifyToken(expiredToken)).rejects.toMatchObject({
        code: AUTH_ERRORS.AUTH001,
      });
    });
  });

  describe('Session Management', () => {
    it('should enforce concurrent session limits', async () => {
      // Setup max sessions scenario
      mockRedisClient.keys.mockResolvedValue([
        'session:user1:1',
        'session:user1:2',
        'session:user1:3',
      ]);
      mockRedisClient.get.mockImplementation((key) =>
        JSON.stringify({
          userId: mockUser.id,
          sessionId: key.split(':')[2],
          lastActivity: Date.now(),
        })
      );

      // Execute Google OAuth flow
      const result = authService.handleGoogleCallback(
        'new-auth-code',
        'valid-state'
      );

      // Verify oldest session is removed
      expect(mockRedisClient.del).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Removed oldest session'),
        expect.any(Object)
      );
    });

    it('should update session activity on token verification', async () => {
      // Setup valid session
      const sessionData = {
        userId: mockUser.id,
        sessionId: 'test-session',
        lastActivity: Date.now() - 1000,
      };
      mockRedisClient.exists.mockResolvedValue(0);
      mockRedisClient.get.mockResolvedValue(JSON.stringify(sessionData));

      // Execute test
      await authService.verifyToken(mockToken);

      // Verify session update
      expect(mockRedisClient.setex).toHaveBeenCalled();
      const updatedSession = JSON.parse(
        mockRedisClient.setex.mock.calls[0][2]
      );
      expect(updatedSession.lastActivity).toBeGreaterThan(
        sessionData.lastActivity
      );
    });
  });

  describe('Security Controls', () => {
    it('should implement RFC 7807 compliant error responses', async () => {
      // Setup invalid token scenario
      mockRedisClient.exists.mockResolvedValue(0);
      mockRedisClient.get.mockResolvedValue(null);

      try {
        await authService.verifyToken('invalid-token');
      } catch (error) {
        expect(error).toMatchObject({
          type: expect.stringContaining('auth.api.startup-metrics.com/errors'),
          status: expect.any(Number),
          code: expect.any(String),
          message: expect.any(String),
          details: expect.any(Object),
          instance: expect.any(String),
        });
      }
    });

    it('should validate token signature integrity', async () => {
      const tamperedToken = testToken.slice(0, -5) + 'xxxxx';

      await expect(authService.verifyToken(tamperedToken)).rejects.toMatchObject({
        code: AUTH_ERRORS.AUTH001,
      });
    });

    it('should prevent session fixation attacks', async () => {
      // Setup session with different user
      mockRedisClient.exists.mockResolvedValue(0);
      mockRedisClient.get.mockResolvedValue(
        JSON.stringify({
          userId: 'different-user-id',
          sessionId: 'test-session',
          lastActivity: Date.now(),
        })
      );

      const token = generateTestToken({
        userId: mockUser.id,
        email: mockUser.email,
      });

      await expect(authService.verifyToken(token)).rejects.toMatchObject({
        code: AUTH_ERRORS.AUTH004,
      });
    });
  });
});