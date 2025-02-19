import { Request, Response, NextFunction } from 'express';
import { authenticate, authorize, handleTokenRefresh } from '../../../backend/src/api-gateway/src/middleware/auth.middleware';
import { MockAuthService, mockToken, mockUser } from '../../mocks/auth-service.mock';
import { AUTH_ERRORS, HTTP_STATUS_CODES } from '../../../backend/src/shared/constants/error-codes';
import winston from 'winston';

describe('API Gateway Authentication Middleware', () => {
  let mockAuthService: MockAuthService;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockLogger: winston.Logger;

  beforeEach(() => {
    // Initialize mock logger
    mockLogger = winston.createLogger({
      transports: [new winston.transports.Console()],
      silent: true // Suppress logs during tests
    });

    // Initialize mock service
    mockAuthService = new MockAuthService({ maxSessions: 3 });

    // Initialize mock request
    mockRequest = {
      headers: {
        authorization: `Bearer ${mockToken}`,
        'x-correlation-id': 'test-correlation-id'
      },
      originalUrl: '/api/test',
      method: 'GET',
      ip: '127.0.0.1'
    };

    // Initialize mock response
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn()
    };

    // Initialize next function
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockAuthService.clearMockData();
  });

  describe('authenticate middleware', () => {
    it('should validate JWT token with RS256 signature', async () => {
      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user).toBeDefined();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject tokens with invalid signature', async () => {
      mockRequest.headers!.authorization = 'Bearer invalid.token';

      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS_CODES.UNAUTHORIZED);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: AUTH_ERRORS.AUTH001,
          type: 'https://auth.api.startup-metrics.com/errors/auth-failed'
        })
      );
    });

    it('should handle missing Authorization header', async () => {
      delete mockRequest.headers!.authorization;

      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS_CODES.UNAUTHORIZED);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: AUTH_ERRORS.AUTH003
        })
      );
    });

    it('should check concurrent session limits', async () => {
      // Create maximum allowed sessions
      for (let i = 0; i < 3; i++) {
        await mockAuthService.handleGoogleCallback('test-code', 'test-state');
      }

      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS_CODES.UNAUTHORIZED);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: AUTH_ERRORS.AUTH005
        })
      );
    });
  });

  describe('authorize middleware', () => {
    beforeEach(() => {
      mockRequest.user = {
        ...mockUser,
        permissions: ['read', 'write']
      };
    });

    it('should validate user roles against required permissions', async () => {
      const authMiddleware = authorize(['USER'], {
        permissions: ['read'],
        requireAll: true
      });

      await authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access for insufficient permissions', async () => {
      const authMiddleware = authorize(['ADMIN'], {
        permissions: ['admin'],
        requireAll: true
      });

      await authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS_CODES.FORBIDDEN);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: AUTH_ERRORS.AUTH002
        })
      );
    });

    it('should handle custom authorization checks', async () => {
      const authMiddleware = authorize(['USER'], {
        customCheck: (req) => req.method === 'GET'
      });

      await authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('handleTokenRefresh middleware', () => {
    it('should refresh tokens near expiration', async () => {
      const expiredToken = await mockAuthService.refreshToken(mockToken);
      mockRequest.headers!.authorization = `Bearer ${expiredToken}`;

      await handleTokenRefresh(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Refresh-Token',
        expect.any(String)
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('should maintain session data during refresh', async () => {
      const originalSession = mockRequest.user;
      await handleTokenRefresh(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toEqual(originalSession);
    });

    it('should handle refresh failures gracefully', async () => {
      mockRequest.headers!.authorization = 'Bearer invalid.token';

      await handleTokenRefresh(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS_CODES.UNAUTHORIZED);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: AUTH_ERRORS.AUTH001
        })
      );
    });
  });

  describe('security audit logging', () => {
    it('should log all authentication attempts', async () => {
      const logSpy = jest.spyOn(mockLogger, 'info');

      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(logSpy).toHaveBeenCalledWith(
        'Authentication successful',
        expect.objectContaining({
          correlationId: 'test-correlation-id',
          userId: mockUser.id
        })
      );
    });

    it('should log authorization decisions', async () => {
      const logSpy = jest.spyOn(mockLogger, 'info');
      const authMiddleware = authorize(['USER']);

      await authMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(logSpy).toHaveBeenCalledWith(
        'Authorization successful',
        expect.objectContaining({
          correlationId: 'test-correlation-id',
          userId: mockUser.id,
          role: mockUser.role
        })
      );
    });

    it('should log security failures with required context', async () => {
      const logSpy = jest.spyOn(mockLogger, 'error');
      mockRequest.headers!.authorization = 'Bearer invalid.token';

      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(logSpy).toHaveBeenCalledWith(
        'Authentication failed',
        expect.objectContaining({
          correlationId: 'test-correlation-id',
          error: expect.any(String),
          request: {
            method: 'GET',
            url: '/api/test',
            ip: '127.0.0.1'
          }
        })
      );
    });
  });
});