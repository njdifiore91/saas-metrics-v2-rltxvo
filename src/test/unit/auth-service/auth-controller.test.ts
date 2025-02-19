import { Request, Response } from 'express';
import { jest } from '@jest/globals'; // v29.0.0
import supertest from 'supertest'; // v6.3.3
import { AuthController } from '../../../backend/src/auth-service/src/controllers/auth.controller';
import { AuthService } from '../../../backend/src/auth-service/src/services/auth.service';
import { generateTestToken, generateExpiredToken } from '../../utils/jwt-helpers';
import { UserRole } from '../../../backend/src/shared/interfaces/user.interface';
import { AUTH_ERRORS, HTTP_STATUS_CODES } from '../../../backend/src/shared/constants/error-codes';

describe('AuthController', () => {
  let authController: AuthController;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockRateLimiter: any;
  let mockLogger: any;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    // Mock AuthService
    mockAuthService = {
      initiateGoogleAuth: jest.fn(),
      handleGoogleCallback: jest.fn(),
      refreshToken: jest.fn(),
      invalidateToken: jest.fn(),
      validateConcurrentSessions: jest.fn(),
      checkRateLimit: jest.fn(),
      logAuthEvent: jest.fn()
    } as any;

    // Mock RateLimiter
    mockRateLimiter = {
      consume: jest.fn().mockResolvedValue(true),
      penalty: jest.fn()
    };

    // Mock Logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    // Initialize controller
    authController = new AuthController(
      mockAuthService,
      mockRateLimiter,
      mockLogger
    );

    // Mock request and response objects
    mockRequest = {
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'test-agent'
      },
      cookies: {},
      query: {}
    };

    mockResponse = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      redirect: jest.fn(),
      end: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initiateGoogleAuth', () => {
    it('should redirect to Google OAuth URL with correct parameters', async () => {
      const mockAuthUrl = 'https://accounts.google.com/oauth2/v2/auth';
      mockAuthService.initiateGoogleAuth.mockResolvedValue(mockAuthUrl);

      await authController.initiateGoogleAuth(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockRateLimiter.consume).toHaveBeenCalledWith(mockRequest.ip);
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'csrf_token',
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          secure: expect.any(Boolean)
        })
      );
      expect(mockResponse.redirect).toHaveBeenCalledWith(mockAuthUrl);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Initiating Google OAuth flow',
        expect.any(Object)
      );
    });

    it('should handle rate limiting correctly', async () => {
      mockRateLimiter.consume.mockRejectedValue(new Error('Rate limit exceeded'));

      await authController.initiateGoogleAuth(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS_CODES.RATE_LIMIT);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'SYS001'
        })
      );
    });
  });

  describe('handleGoogleCallback', () => {
    const mockCode = 'valid-auth-code';
    const mockState = Buffer.from(JSON.stringify({
      csrfToken: 'valid-csrf',
      timestamp: Date.now()
    })).toString('base64');

    beforeEach(() => {
      mockRequest.query = { code: mockCode, state: mockState };
      mockRequest.cookies = { csrf_token: 'valid-csrf-hash' };
    });

    it('should process valid OAuth callback successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: UserRole.USER,
        lastActivity: new Date()
      };

      mockAuthService.handleGoogleCallback.mockResolvedValue({
        token: 'valid-jwt',
        user: mockUser,
        sessionId: 'session-123'
      });

      await authController.handleGoogleCallback(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'auth_token',
        'valid-jwt',
        expect.any(Object)
      );
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('csrf_token');
      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS_CODES.OK);
      expect(mockResponse.json).toHaveBeenCalledWith({
        user: expect.objectContaining({
          id: mockUser.id,
          email: mockUser.email
        }),
        sessionId: 'session-123'
      });
    });

    it('should reject invalid CSRF tokens', async () => {
      mockRequest.cookies.csrf_token = 'invalid-csrf-hash';

      await authController.handleGoogleCallback(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS_CODES.UNAUTHORIZED);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: AUTH_ERRORS.AUTH003
        })
      );
    });
  });

  describe('refreshToken', () => {
    it('should refresh valid tokens successfully', async () => {
      const validToken = generateTestToken({
        userId: 'user-123',
        email: 'test@example.com'
      });

      mockRequest.cookies = { auth_token: validToken };
      
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: UserRole.USER,
        lastActivity: new Date()
      };

      mockAuthService.refreshToken.mockResolvedValue({
        token: 'new-jwt',
        user: mockUser,
        sessionId: 'session-123'
      });

      await authController.refreshToken(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'auth_token',
        'new-jwt',
        expect.any(Object)
      );
      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS_CODES.OK);
    });

    it('should reject expired tokens', async () => {
      const expiredToken = generateExpiredToken({
        userId: 'user-123',
        email: 'test@example.com'
      });

      mockRequest.cookies = { auth_token: expiredToken };
      mockAuthService.refreshToken.mockRejectedValue(new Error(AUTH_ERRORS.AUTH001));

      await authController.refreshToken(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS_CODES.UNAUTHORIZED);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: AUTH_ERRORS.AUTH001
        })
      );
    });
  });

  describe('logout', () => {
    it('should handle logout successfully', async () => {
      const validToken = generateTestToken({
        userId: 'user-123',
        email: 'test@example.com'
      });

      mockRequest.cookies = { auth_token: validToken };

      await authController.logout(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockAuthService.invalidateToken).toHaveBeenCalledWith(validToken);
      expect(mockResponse.clearCookie).toHaveBeenCalledWith(
        'auth_token',
        expect.any(Object)
      );
      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS_CODES.NO_CONTENT);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User logged out',
        expect.any(Object)
      );
    });

    it('should handle logout without active session', async () => {
      mockRequest.cookies = {};

      await authController.logout(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockAuthService.invalidateToken).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS_CODES.NO_CONTENT);
    });
  });

  describe('Security Controls', () => {
    it('should enforce rate limiting across all endpoints', async () => {
      mockRateLimiter.consume.mockRejectedValue(new Error('Rate limit exceeded'));

      await authController.initiateGoogleAuth(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS_CODES.RATE_LIMIT);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Authentication error',
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'SYS001'
          })
        })
      );
    });

    it('should validate secure cookie attributes', async () => {
      const mockAuthUrl = 'https://accounts.google.com/oauth2/v2/auth';
      mockAuthService.initiateGoogleAuth.mockResolvedValue(mockAuthUrl);

      await authController.initiateGoogleAuth(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          secure: expect.any(Boolean),
          sameSite: 'strict'
        })
      );
    });

    it('should maintain comprehensive audit logs', async () => {
      await authController.initiateGoogleAuth(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          ip: mockRequest.ip,
          userAgent: mockRequest.headers['user-agent'],
          timestamp: expect.any(String)
        })
      );
    });
  });
});